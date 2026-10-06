import type { JobType, Prisma } from '@prisma/client';

import { prisma } from '@/lib/db';
import { badRequest, forbidden, notFound } from '@/server/api/errors';
import { clamp, round } from '@/lib/utils';
import { SKILL_TAXONOMY } from '@/lib/ai/skills';
import { getAIService, describeAiProvider } from '@/lib/ai';
import type { MatchResult, ResumeAnalysis, JobAnalysis } from '@/lib/ai/types';
import { extractText } from './document.service';
import { storage, storageKey, validateUpload } from '@/lib/storage';
import { storeUpload } from './file.service';
import { notify } from './notification.service';
import { audit } from './audit.service';

/**
 * Career module: resumes, job descriptions and AI matching.
 *
 * All analysis goes through `getAIService()`, so switching from the built-in
 * engine to Gemini/OpenAI later is an environment change only.
 */

export async function syncSkillTaxonomy() {
  let created = 0;
  for (const skill of SKILL_TAXONOMY) {
    const existing = await prisma.skill.findUnique({ where: { name: skill.name } });
    if (existing) {
      await prisma.skill.update({
        where: { id: existing.id },
        data: { category: skill.category, aliases: skill.aliases, demand: skill.demand },
      });
    } else {
      await prisma.skill.create({
        data: { name: skill.name, category: skill.category, aliases: skill.aliases, demand: skill.demand },
      });
      created += 1;
    }
  }
  return { created, total: SKILL_TAXONOMY.length };
}

async function skillIdByName(name: string) {
  const skill = await prisma.skill.findUnique({ where: { name } });
  if (skill) return skill.id;
  const created = await prisma.skill.create({
    data: { name, category: 'TOOL', aliases: [], demand: 3 },
  });
  return created.id;
}

// ─────────────────────────────────────────────────────────────────────────
// Resumes
// ─────────────────────────────────────────────────────────────────────────

export interface CreateResumeInput {
  studentId: string;
  title?: string;
  text?: string;
  file?: { buffer: Buffer; mimeType: string; filename: string; sizeBytes: number };
}

export async function createResume(input: CreateResumeInput, actorUserId: string) {
  let content = input.text?.trim() ?? '';
  let fileAssetId: string | null = null;

  if (input.file) {
    const check = validateUpload('resume', input.file.mimeType, input.file.sizeBytes);
    if (!check.ok) throw badRequest(check.reason);
    const extracted = await extractText(input.file.buffer, input.file.mimeType);
    if (!extracted || extracted.length < 40) {
      throw badRequest('No readable text was found in that file. Try a text-based PDF or paste your resume instead.');
    }
    content = extracted;
    const stored = await storeUpload({
      buffer: input.file.buffer,
      mimeType: input.file.mimeType,
      filename: input.file.filename,
      sizeBytes: input.file.sizeBytes,
      kind: 'RESUME',
      ownerId: actorUserId,
    });
    fileAssetId = stored.assetId;
  }

  if (content.length < 40) throw badRequest('Add your resume text or upload a file.');

  const service = getAIService();
  const analysis: ResumeAnalysis = await service.analyzeResume(content);

  const existingCount = await prisma.resume.count({ where: { studentId: input.studentId } });

  const resume = await prisma.resume.create({
    data: {
      studentId: input.studentId,
      title: input.title?.trim() || (fileAssetId ? input.file!.filename.replace(/\.[^.]+$/, '') : `Resume v${existingCount + 1}`),
      content,
      version: existingCount + 1,
      isPrimary: existingCount === 0,
      wordCount: analysis.wordCount,
      parsedData: analysis as unknown as Prisma.InputJsonValue,
      fileAssetId,
      analyses: {
        create: {
          provider: analysis.provider,
          model: analysis.model,
          summary: analysis as unknown as Prisma.InputJsonValue,
          durationMs: analysis.durationMs,
        },
      },
    },
  });

  // Link detected skills to the catalogue (ids resolved one by one).
  for (const hit of analysis.skills.slice(0, 60)) {
    const skillId = await skillIdByName(hit.name);
    await prisma.resumeSkill.upsert({
      where: { resumeId_skillId: { resumeId: resume.id, skillId } },
      create: { resumeId: resume.id, skillId, evidence: hit.evidence ?? null, mentions: hit.mentions },
      update: { evidence: hit.evidence ?? null, mentions: hit.mentions },
    });
  }

  audit({
    action: 'resume.create',
    resourceType: 'Resume',
    resourceId: resume.id,
    description: `Uploaded resume "${resume.title}" (${analysis.skills.length} skills detected)`,
    newValue: { wordCount: analysis.wordCount, qualityScore: analysis.qualityScore },
    userId: actorUserId,
  });

  return { resumeId: resume.id, analysis };
}

export async function listResumes(studentId: string) {
  const resumes = await prisma.resume.findMany({
    where: { studentId, deletedAt: null },
    orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
    include: {
      fileAsset: { select: { id: true, originalName: true, mimeType: true, sizeBytes: true } },
      skills: { include: { skill: true }, take: 40 },
      _count: { select: { matches: true } },
    },
  });
  return resumes.map((r) => ({
    id: r.id,
    title: r.title,
    version: r.version,
    isPrimary: r.isPrimary,
    wordCount: r.wordCount,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    fileName: r.fileAsset?.originalName ?? null,
    fileSize: r.fileAsset?.sizeBytes ?? null,
    fileAssetId: r.fileAssetId,
    matchCount: r._count.matches,
    analysis: r.parsedData as unknown as ResumeAnalysis | null,
    skills: r.skills.map((s) => ({ name: s.skill.name, category: s.skill.category, mentions: s.mentions })),
  }));
}

export async function getResume(id: string, studentId?: string) {
  const resume = await prisma.resume.findUnique({
    where: { id },
    include: {
      student: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
      fileAsset: true,
      skills: { include: { skill: true } },
      analyses: { orderBy: { createdAt: 'desc' }, take: 1 },
      matches: { orderBy: { createdAt: 'desc' }, take: 5, include: { jobDescription: { select: { id: true, title: true, company: true } } } },
    },
  });
  if (!resume || resume.deletedAt) throw notFound('That resume does not exist.');
  if (studentId && resume.studentId !== studentId) throw forbidden('You can only view your own resumes.');

  return {
    id: resume.id,
    title: resume.title,
    content: resume.content,
    version: resume.version,
    isPrimary: resume.isPrimary,
    wordCount: resume.wordCount,
    createdAt: resume.createdAt.toISOString(),
    studentId: resume.studentId,
    studentName: `${resume.student.user.firstName} ${resume.student.user.lastName}`,
    fileName: resume.fileAsset?.originalName ?? null,
    fileAssetId: resume.fileAssetId,
    analysis: (resume.analyses[0]?.summary ?? resume.parsedData) as unknown as ResumeAnalysis | null,
    skills: resume.skills.map((s) => ({
      name: s.skill.name,
      category: s.skill.category,
      demand: s.skill.demand,
      mentions: s.mentions,
      evidence: s.evidence,
    })),
    recentMatches: resume.matches.map((m) => ({
      id: m.id,
      score: m.score,
      verdict: m.verdict,
      createdAt: m.createdAt.toISOString(),
      jobTitle: m.jobDescription.title,
      company: m.jobDescription.company,
    })),
  };
}

export async function updateResume(id: string, studentId: string, patch: { title?: string; isPrimary?: boolean; text?: string }) {
  const resume = await prisma.resume.findUnique({ where: { id } });
  if (!resume || resume.deletedAt) throw notFound('That resume does not exist.');
  if (resume.studentId !== studentId) throw forbidden('You can only edit your own resumes.');

  const data: Prisma.ResumeUpdateInput = {
    ...(patch.title !== undefined ? { title: patch.title } : {}),
  };

  if (patch.isPrimary) {
    await prisma.resume.updateMany({ where: { studentId }, data: { isPrimary: false } });
    data.isPrimary = true;
  }

  if (patch.text && patch.text.trim().length >= 40) {
    const service = getAIService();
    const analysis = await service.analyzeResume(patch.text);
    data.content = patch.text;
    data.wordCount = analysis.wordCount;
    data.parsedData = analysis as unknown as Prisma.InputJsonValue;
    data.version = resume.version + 1;
    await prisma.resumeAnalysis.create({
      data: {
        resumeId: id,
        provider: analysis.provider,
        model: analysis.model,
        summary: analysis as unknown as Prisma.InputJsonValue,
        durationMs: analysis.durationMs,
      },
    });
    await prisma.resumeSkill.deleteMany({ where: { resumeId: id } });
    for (const hit of analysis.skills.slice(0, 60)) {
      const skillId = await skillIdByName(hit.name);
      await prisma.resumeSkill.create({
        data: { resumeId: id, skillId, evidence: hit.evidence ?? null, mentions: hit.mentions },
      });
    }
  }

  const updated = await prisma.resume.update({ where: { id }, data });
  return { id: updated.id, title: updated.title, version: updated.version, isPrimary: updated.isPrimary };
}

export async function deleteResume(id: string, studentId: string, actorUserId: string) {
  const resume = await prisma.resume.findUnique({ where: { id }, include: { fileAsset: true } });
  if (!resume) throw notFound('That resume does not exist.');
  if (resume.studentId !== studentId) throw forbidden('You can only delete your own resumes.');
  await prisma.resume.update({ where: { id }, data: { deletedAt: new Date(), isPrimary: false } });
  audit({ action: 'resume.delete', resourceType: 'Resume', resourceId: id, description: `Deleted resume "${resume.title}"`, userId: actorUserId });
  return { deleted: true };
}

// ─────────────────────────────────────────────────────────────────────────
// Job descriptions
// ─────────────────────────────────────────────────────────────────────────

export interface CreateJobInput {
  title?: string;
  company?: string;
  location?: string;
  jobType?: JobType;
  sourceUrl?: string;
  description?: string;
  studentId?: string;
  file?: { buffer: Buffer; mimeType: string; filename: string; sizeBytes: number };
}

export async function createJobDescription(input: CreateJobInput, actorUserId: string) {
  let description = input.description?.trim() ?? '';
  let fileAssetId: string | null = null;

  if (input.file) {
    const check = validateUpload('job', input.file.mimeType, input.file.sizeBytes);
    if (!check.ok) throw badRequest(check.reason);
    const extracted = await extractText(input.file.buffer, input.file.mimeType);
    if (!extracted || extracted.length < 40) {
      throw badRequest('No readable text was found in that job description file.');
    }
    description = description ? `${description}\n\n${extracted}` : extracted;
    const stored = await storeUpload({
      buffer: input.file.buffer,
      mimeType: input.file.mimeType,
      filename: input.file.filename,
      sizeBytes: input.file.sizeBytes,
      kind: 'JOB_DESCRIPTION',
      ownerId: actorUserId,
    });
    fileAssetId = stored.assetId;
  }

  if (description.length < 40) throw badRequest('Paste the job description text or upload a file.');

  const service = getAIService();
  const analysis: JobAnalysis = await service.analyzeJobDescription(description);

  const job = await prisma.jobDescription.create({
    data: {
      title: input.title?.trim() || analysis.role || 'Untitled role',
      company: input.company?.trim() || analysis.company || null,
      location: input.location?.trim() || null,
      jobType: input.jobType ?? 'FULL_TIME',
      sourceUrl: input.sourceUrl?.trim() || null,
      description,
      minExperience: analysis.experienceYears,
      wordCount: description.split(/\s+/).length,
      parsedData: analysis as unknown as Prisma.InputJsonValue,
      studentId: input.studentId ?? null,
      fileAssetId,
      analyses: {
        create: {
          provider: analysis.provider,
          model: analysis.model,
          summary: analysis as unknown as Prisma.InputJsonValue,
          durationMs: analysis.durationMs,
        },
      },
    },
  });

  return { jobDescriptionId: job.id, analysis };
}

export async function listJobDescriptions(filter: { studentId?: string; search?: string; page?: number; pageSize?: number } = {}) {
  const page = Math.max(1, filter.page ?? 1);
  const pageSize = clamp(filter.pageSize ?? 12, 1, 50);
  const where: Prisma.JobDescriptionWhereInput = {
    deletedAt: null,
    ...(filter.studentId ? { studentId: filter.studentId } : {}),
    ...(filter.search
      ? {
          OR: [
            { title: { contains: filter.search, mode: 'insensitive' } },
            { company: { contains: filter.search, mode: 'insensitive' } },
            { description: { contains: filter.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.jobDescription.count({ where }),
    prisma.jobDescription.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { _count: { select: { matches: true } }, student: { select: { id: true } } },
    }),
  ]);
  return {
    items: rows.map((j) => ({
      id: j.id,
      title: j.title,
      company: j.company,
      location: j.location,
      jobType: j.jobType,
      minExperience: j.minExperience,
      wordCount: j.wordCount,
      createdAt: j.createdAt.toISOString(),
      matchCount: j._count.matches,
      ownedByMe: filter.studentId ? j.studentId === filter.studentId : false,
      analysis: j.parsedData as unknown as JobAnalysis | null,
    })),
    meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  };
}

export async function getJobDescription(id: string) {
  const job = await prisma.jobDescription.findUnique({
    where: { id },
    include: { analyses: { orderBy: { createdAt: 'desc' }, take: 1 }, fileAsset: true },
  });
  if (!job || job.deletedAt) throw notFound('That job description does not exist.');
  return {
    id: job.id,
    title: job.title,
    company: job.company,
    location: job.location,
    jobType: job.jobType,
    sourceUrl: job.sourceUrl,
    description: job.description,
    minExperience: job.minExperience,
    createdAt: job.createdAt.toISOString(),
    fileName: job.fileAsset?.originalName ?? null,
    analysis: (job.analyses[0]?.summary ?? job.parsedData) as unknown as JobAnalysis | null,
  };
}

export async function deleteJobDescription(id: string, studentId: string | null, role: string, actorUserId: string) {
  const job = await prisma.jobDescription.findUnique({ where: { id } });
  if (!job) throw notFound('That job description does not exist.');
  if (role === 'STUDENT' && job.studentId !== studentId) throw forbidden('You can only delete job descriptions you added.');
  await prisma.jobDescription.update({ where: { id }, data: { deletedAt: new Date() } });
  audit({ action: 'job.delete', resourceType: 'JobDescription', resourceId: id, description: `Deleted job "${job.title}"`, userId: actorUserId });
  return { deleted: true };
}

// ─────────────────────────────────────────────────────────────────────────
// Matching
// ─────────────────────────────────────────────────────────────────────────

export async function analyzeMatch(input: {
  resumeId: string;
  jobDescriptionId: string;
  studentId: string;
  actorUserId: string;
}) {
  const [resume, job] = await Promise.all([
    prisma.resume.findUnique({ where: { id: input.resumeId } }),
    prisma.jobDescription.findUnique({ where: { id: input.jobDescriptionId } }),
  ]);
  if (!resume || resume.deletedAt) throw notFound('That resume does not exist.');
  if (!job || job.deletedAt) throw notFound('That job description does not exist.');
  if (resume.studentId !== input.studentId) throw forbidden('You can only match your own resumes.');

  const service = getAIService();
  const result: MatchResult = await service.matchResumeToJob(resume.content, job.description);

  const match = await prisma.resumeJobMatch.create({
    data: {
      resumeId: resume.id,
      jobDescriptionId: job.id,
      studentId: input.studentId,
      score: result.score,
      verdict: result.verdict as never,
      provider: result.provider,
      model: result.model,
      matchedSkills: result.matchedSkills as unknown as Prisma.InputJsonValue,
      missingSkills: result.missingSkills as unknown as Prisma.InputJsonValue,
      partialSkills: result.partialSkills as unknown as Prisma.InputJsonValue,
      resumeEvidence: result.evidence as unknown as Prisma.InputJsonValue,
      gapAnalysis: { breakdown: result.breakdown, summary: result.summary } as unknown as Prisma.InputJsonValue,
      recommendations: result.recommendations as unknown as Prisma.InputJsonValue,
      breakdown: result.breakdown as unknown as Prisma.InputJsonValue,
      disclaimer: result.disclaimer,
      durationMs: result.durationMs,
    },
  });

  // Persist the skill gaps so they can be tracked over time.
  await prisma.skillGap.deleteMany({ where: { matchId: match.id } });
  for (const skill of result.missingSkills.slice(0, 25)) {
    const recommendation = result.recommendations.find((r) => r.skill === skill.name);
    const existingSkill = await prisma.skill.findUnique({ where: { name: skill.name }, select: { id: true } });
    await prisma.skillGap.create({
      data: {
        matchId: match.id,
        studentId: input.studentId,
        skillName: skill.name,
        skillId: existingSkill?.id ?? null,
        severity: skill.demand >= 4 ? 'HIGH' : skill.demand >= 3 ? 'MEDIUM' : 'LOW',
        category: skill.category,
        recommendation: recommendation?.detail ?? recommendation?.title ?? null,
        status: 'OPEN',
      },
    });
  }

  await notify(input.actorUserId, {
    type: 'CAREER_INSIGHT',
    title: `Resume match: ${result.score}% for ${job.title}`,
    message:
      result.missingSkills.length > 0
        ? `Your resume is missing ${result.missingSkills.length} skill${result.missingSkills.length === 1 ? '' : 's'} this job asks for: ${result.missingSkills.slice(0, 3).map((s) => s.name).join(', ')}.`
        : 'Your resume covers every skill this job asks for.',
    link: `/career/matches/${match.id}`,
  });

  audit({
    action: 'career.match',
    resourceType: 'ResumeJobMatch',
    resourceId: match.id,
    description: `Matched "${resume.title}" against "${job.title}" — ${result.score}% (${result.provider})`,
    newValue: { score: result.score, verdict: result.verdict, provider: result.provider },
    userId: input.actorUserId,
  });

  return { matchId: match.id, result, provider: describeAiProvider() };
}

export async function listMatches(studentId: string) {
  const matches = await prisma.resumeJobMatch.findMany({
    where: { studentId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    take: 25,
    include: {
      resume: { select: { id: true, title: true } },
      jobDescription: { select: { id: true, title: true, company: true, jobType: true } },
    },
  });
  return matches.map((m) => ({
    id: m.id,
    score: m.score,
    verdict: m.verdict,
    provider: m.provider,
    createdAt: m.createdAt.toISOString(),
    resumeId: m.resumeId,
    resumeTitle: m.resume.title,
    jobId: m.jobDescriptionId,
    jobTitle: m.jobDescription.title,
    company: m.jobDescription.company,
  }));
}

export async function getMatch(id: string, studentId: string, role: string) {
  const match = await prisma.resumeJobMatch.findUnique({
    where: { id },
    include: {
      resume: { select: { id: true, title: true, studentId: true } },
      jobDescription: { select: { id: true, title: true, company: true, location: true, jobType: true, description: true } },
      skillGaps: true,
    },
  });
  if (!match || match.deletedAt) throw notFound('That analysis does not exist.');
  if (role === 'STUDENT' && match.studentId !== studentId) throw forbidden('You can only view your own analyses.');

  return {
    id: match.id,
    score: match.score,
    verdict: match.verdict,
    provider: match.provider,
    model: match.model,
    createdAt: match.createdAt.toISOString(),
    disclaimer: match.disclaimer,
    matchedSkills: match.matchedSkills as unknown as MatchResult['matchedSkills'],
    missingSkills: match.missingSkills as unknown as MatchResult['missingSkills'],
    partialSkills: (match.partialSkills as unknown as MatchResult['partialSkills']) ?? [],
    breakdown: (match.breakdown as unknown as MatchResult['breakdown']) ?? [],
    evidence: (match.resumeEvidence as unknown as MatchResult['evidence']) ?? [],
    recommendations: (match.recommendations as unknown as MatchResult['recommendations']) ?? [],
    summary: (match.gapAnalysis as unknown as { summary?: string })?.summary ?? '',
    resume: match.resume,
    job: match.jobDescription,
    skillGaps: match.skillGaps.map((g) => ({
      id: g.id,
      skillName: g.skillName,
      severity: g.severity,
      category: g.category,
      recommendation: g.recommendation,
      status: g.status,
    })),
  };
}

export async function deleteMatch(id: string, studentId: string) {
  const match = await prisma.resumeJobMatch.findUnique({ where: { id } });
  if (!match) throw notFound('That analysis does not exist.');
  if (match.studentId !== studentId) throw forbidden('You can only delete your own analyses.');
  await prisma.resumeJobMatch.update({ where: { id }, data: { deletedAt: new Date() } });
  return { deleted: true };
}

/**
 * Update the tracked status of every gap for one skill. A student who starts
 * learning React should see that reflected across all of their analyses.
 */
export async function updateSkillGapsForSkill(studentId: string, skillName: string, status: string) {
  const result = await prisma.skillGap.updateMany({
    where: { studentId, skillName: { equals: skillName, mode: 'insensitive' } },
    data: { status },
  });
  if (result.count === 0) throw notFound('That skill gap does not exist.');
  return { skillName, status, updated: result.count };
}

export async function updateSkillGapStatus(gapId: string, studentId: string, status: string) {
  const gap = await prisma.skillGap.findUnique({ where: { id: gapId } });
  if (!gap) throw notFound('That skill gap does not exist.');
  if (gap.studentId !== studentId) throw forbidden('You can only update your own skill gaps.');
  const updated = await prisma.skillGap.update({ where: { id: gapId }, data: { status } });
  return { id: updated.id, status: updated.status };
}

/** Aggregate open skill gaps across all of a student's analyses. */
export async function studentSkillGaps(studentId: string) {
  const gaps = await prisma.skillGap.findMany({
    where: { studentId },
    orderBy: { createdAt: 'desc' },
    include: { match: { select: { id: true, score: true, jobDescription: { select: { title: true, company: true } } } } },
  });

  const bySkill = new Map<
    string,
    {
      skillName: string;
      category: string | null;
      severity: string;
      count: number;
      status: string;
      recommendation: string | null;
      lastSeen: string;
      matchId: string;
      jobTitle: string;
      company: string | null;
    }
  >();

  const severityRank: Record<string, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };

  for (const gap of gaps) {
    const existing = bySkill.get(gap.skillName);
    if (existing) {
      existing.count += 1;
      if (gap.status === 'OPEN') existing.status = 'OPEN';
      else if (gap.status === 'IN_PROGRESS' && existing.status !== 'OPEN') existing.status = 'IN_PROGRESS';
      if ((severityRank[gap.severity] ?? 0) > (severityRank[existing.severity] ?? 0)) existing.severity = gap.severity;
      if (gap.createdAt.toISOString() > existing.lastSeen) {
        existing.lastSeen = gap.createdAt.toISOString();
        existing.matchId = gap.matchId;
        existing.jobTitle = gap.match.jobDescription.title;
        existing.company = gap.match.jobDescription.company;
        if (gap.recommendation) existing.recommendation = gap.recommendation;
      }
    } else {
      bySkill.set(gap.skillName, {
        skillName: gap.skillName,
        category: gap.category,
        severity: gap.severity,
        count: 1,
        status: gap.status,
        recommendation: gap.recommendation,
        lastSeen: gap.createdAt.toISOString(),
        matchId: gap.matchId,
        jobTitle: gap.match.jobDescription.title,
        company: gap.match.jobDescription.company,
      });
    }
  }

  const items = Array.from(bySkill.values()).sort((a, b) => b.count - a.count);
  return {
    open: items.filter((i) => i.status === 'OPEN').length,
    closed: items.filter((i) => i.status === 'CLOSED').length,
    inProgress: items.filter((i) => i.status === 'IN_PROGRESS').length,
    items,
    bestScore: gaps.length ? Math.max(...gaps.map((g) => g.match.score)) : null,
    averageScore: gaps.length ? round(gaps.reduce((a, g) => a + g.match.score, 0) / gaps.length, 0) : null,
  };
}

/** Download a stored resume/job file. */
export async function downloadAsset(assetId: string) {
  const asset = await prisma.fileAsset.findUnique({ where: { id: assetId } });
  if (!asset || asset.deletedAt) throw notFound('That file is no longer available.');
  const buffer = await storage().get(asset.storageKey);
  return { buffer, filename: asset.originalName, mimeType: asset.mimeType };
}

export { storageKey, describeAiProvider };
