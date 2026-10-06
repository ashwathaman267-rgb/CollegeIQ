import { z } from 'zod';

import { env } from '@/lib/env';
import { analyzeJobText, analyzeResumeText, matchTexts } from './engine';
import type { AIService, JobAnalysis, MatchResult, ResumeAnalysis } from './types';

/**
 * Shared plumbing for the cloud providers.
 *
 * Both implementations follow the same rules:
 *  • the key is read from the server environment on every call (never bundled
 *    into client code);
 *  • a hard timeout prevents a hung provider from blocking a request;
 *  • any failure — network, auth, rate limit, malformed JSON — degrades to the
 *    local analysis engine so the student still gets a usable result.
 */

const skillHitSchema = z.object({
  name: z.string(),
  category: z.string().catch('TOOL'),
  demand: z.number().catch(3),
  mentions: z.number().catch(1),
  evidence: z.string().optional(),
});

const resumeSchema = z.object({
  summary: z.string().optional(),
  headlineRole: z.string().optional(),
  education: z.array(z.object({
    qualification: z.string(),
    institution: z.string().optional(),
    year: z.string().optional(),
    score: z.string().optional(),
  })).optional(),
  experience: z.array(z.object({
    role: z.string(),
    organisation: z.string().optional(),
    duration: z.string().optional(),
    months: z.number().optional(),
  })).optional(),
  totalExperienceMonths: z.number().optional(),
  skills: z.array(skillHitSchema).optional(),
  projects: z.array(z.string()).optional(),
  certifications: z.array(z.string()).optional(),
  strengths: z.array(z.string()).optional(),
  improvements: z.array(z.string()).optional(),
  qualityScore: z.number().optional(),
});

const jobSchema = z.object({
  summary: z.string().optional(),
  role: z.string().optional(),
  company: z.string().optional(),
  seniority: z.enum(['INTERN', 'ENTRY', 'MID', 'SENIOR', 'UNKNOWN']).optional(),
  technicalSkills: z.array(skillHitSchema).optional(),
  experienceYears: z.number().optional(),
  education: z.array(z.string()).optional(),
  responsibilities: z.array(z.string()).optional(),
  requirements: z.array(z.string()).optional(),
  niceToHave: z.array(z.string()).optional(),
});

const matchSchema = z.object({
  score: z.number().min(0).max(100),
  verdict: z.enum(['EXCELLENT', 'STRONG', 'MODERATE', 'WEAK', 'POOR']).optional(),
  summary: z.string().optional(),
  matchedSkills: z.array(skillHitSchema).optional(),
  missingSkills: z.array(skillHitSchema).optional(),
  partialSkills: z.array(skillHitSchema).optional(),
  breakdown: z.array(z.object({
    label: z.string(),
    score: z.number(),
    weight: z.number(),
    detail: z.string(),
  })).optional(),
  recommendations: z.array(z.object({
    title: z.string(),
    detail: z.string(),
    priority: z.enum(['HIGH', 'MEDIUM', 'LOW']).catch('MEDIUM'),
    effort: z.string().optional(),
    skill: z.string().optional(),
  })).optional(),
});

export async function callJson<T>(
  url: string,
  init: RequestInit,
  timeoutMs = env().AI_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`AI provider responded ${response.status}: ${body.slice(0, 200)}`);
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/** Merge a validated provider payload over the local engine's analysis. */
export function mergeResumeAnalysis(local: ResumeAnalysis, remote: unknown, provider: ResumeAnalysis['provider'], model?: string): ResumeAnalysis {
  const parsed = resumeSchema.safeParse(remote);
  if (!parsed.success) return { ...local, provider };
  const r = parsed.data;
  return {
    ...local,
    provider,
    model,
    summary: r.summary ?? local.summary,
    headlineRole: r.headlineRole ?? local.headlineRole,
    education: r.education ?? local.education,
    experience: r.experience ?? local.experience,
    totalExperienceMonths: r.totalExperienceMonths ?? local.totalExperienceMonths,
    skills: (r.skills?.length ? r.skills : local.skills) as ResumeAnalysis['skills'],
    projects: r.projects ?? local.projects,
    certifications: r.certifications ?? local.certifications,
    strengths: r.strengths ?? local.strengths,
    improvements: r.improvements ?? local.improvements,
    qualityScore: r.qualityScore ?? local.qualityScore,
  };
}

export function mergeJobAnalysis(local: JobAnalysis, remote: unknown, provider: JobAnalysis['provider'], model?: string): JobAnalysis {
  const parsed = jobSchema.safeParse(remote);
  if (!parsed.success) return { ...local, provider };
  const j = parsed.data;
  const skills = (j.technicalSkills?.length ? j.technicalSkills : local.technicalSkills) as JobAnalysis['technicalSkills'];
  const byCat = (cats: string[]) => skills.filter((s) => cats.includes(s.category)).map((s) => s.name);
  return {
    ...local,
    provider,
    model,
    summary: j.summary ?? local.summary,
    role: j.role ?? local.role,
    company: j.company ?? local.company,
    seniority: j.seniority ?? local.seniority,
    technicalSkills: skills,
    languages: byCat(['PROGRAMMING_LANGUAGE']),
    frameworks: byCat(['FRAMEWORK', 'LIBRARY']),
    tools: byCat(['TOOL', 'PLATFORM', 'CERTIFICATION']),
    databases: byCat(['DATABASE']),
    cloud: byCat(['CLOUD']),
    softSkills: byCat(['SOFT_SKILL']),
    experienceYears: j.experienceYears ?? local.experienceYears,
    education: j.education ?? local.education,
    responsibilities: j.responsibilities ?? local.responsibilities,
    requirements: j.requirements ?? local.requirements,
    niceToHave: j.niceToHave ?? local.niceToHave,
  };
}

export function mergeMatch(local: MatchResult, remote: unknown, provider: MatchResult['provider'], model?: string): MatchResult {
  const parsed = matchSchema.safeParse(remote);
  if (!parsed.success) return { ...local, provider };
  const m = parsed.data;
  return {
    ...local,
    provider,
    model,
    score: Math.max(0, Math.min(100, Math.round(m.score))),
    verdict: m.verdict ?? local.verdict,
    summary: m.summary ?? local.summary,
    matchedSkills: (m.matchedSkills ?? local.matchedSkills) as MatchResult['matchedSkills'],
    missingSkills: (m.missingSkills ?? local.missingSkills) as MatchResult['missingSkills'],
    partialSkills: (m.partialSkills ?? local.partialSkills) as MatchResult['partialSkills'],
    breakdown: m.breakdown ?? local.breakdown,
    recommendations: (m.recommendations ?? local.recommendations).map((r) => ({
      ...r,
      effort: r.effort ?? '',
    })),
    verdictLabel:
      m.verdict && m.verdict !== local.verdict
        ? local.verdictLabel
        : local.verdictLabel,
  };
}

/** Run a provider call; on any failure return the deterministic local result. */
export async function withFallback<T>(remote: () => Promise<T>, fallback: () => T): Promise<T> {
  try {
    return await remote();
  } catch (err) {
    console.warn('[ai] provider call failed, falling back to the local engine:', (err as Error).message);
    return fallback();
  }
}

export { analyzeJobText, analyzeResumeText, matchTexts };
