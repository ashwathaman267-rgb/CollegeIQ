import {
  CATEGORY_LABEL,
  SKILL_TAXONOMY,
  skillMatcher,
  type SkillDefinition,
} from './skills';
import {
  MATCH_DISCLAIMER,
  VERDICT_LABEL,
  verdictForScore,
  type EducationEntry,
  type ExperienceEntry,
  type JobAnalysis,
  type MatchResult,
  type Recommendation,
  type ResumeAnalysis,
  type ScoreBreakdown,
  type Seniority,
  type SkillCategory,
  type SkillHit,
} from './types';
import { clamp, round, unique } from '@/lib/utils';

/**
 * Deterministic text-analysis engine.
 *
 * This is what powers `MockAIService`, and it is also the graceful fallback for
 * the cloud providers: if a remote call fails or returns something we cannot
 * validate, the engine still produces a useful, honest analysis offline.
 */

const SECTION_HEADINGS: { name: string; pattern: RegExp }[] = [
  { name: 'Summary', pattern: /^\s*(?:profile\s*)?(?:summary|objective|about me|career objective|professional summary)\s*:?$/im },
  { name: 'Education', pattern: /^\s*(?:education|academic(?:s| qualifications?)?|qualifications?)\s*:?$/im },
  { name: 'Experience', pattern: /^\s*(?:work\s+)?(?:experience|employment|internships?|professional experience|work history)\s*:?$/im },
  { name: 'Projects', pattern: /^\s*(?:projects?|academic projects?|personal projects?|key projects?)\s*:?$/im },
  { name: 'Skills', pattern: /^\s*(?:technical\s+)?(?:skills?|competencies|technologies|tech stack)\s*:?$/im },
  { name: 'Certifications', pattern: /^\s*(?:certifications?|licenses?|courses?|certificates?)\s*:?$/im },
  { name: 'Achievements', pattern: /^\s*(?:achievements?|awards?|honours?|honors?|accomplishments?)\s*:?$/im },
  { name: 'Responsibilities', pattern: /^\s*(?:responsibilities|what you(?:'ll| will) do|role and responsibilities|key responsibilities|duties)\s*:?$/im },
  { name: 'Requirements', pattern: /^\s*(?:requirements?|qualifications|what we(?:'re| are) looking for|skills required|required skills|must have|eligibility)\s*:?$/im },
  { name: 'Preferred', pattern: /^\s*(?:preferred qualifications?|nice to have|good to have|bonus points?|preferred skills?)\s*:?$/im },
];

export function normalizeText(input: string): string {
  return input
    .replace(/\r/g, '')
    .replace(/[\u00a0\u2007\u202f]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function splitLines(text: string): string[] {
  return text
    .split(/\n+/)
    .map((l) => l.replace(/^[\s•·*\-–—\d.)\]]+\s*/, '').trim())
    .filter((l) => l.length > 1);
}

export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 3);
}

/** Section boundaries detected from heading-like lines. */
export function extractSections(text: string): { name: string; content: string }[] {
  const lines = text.split('\n');
  const found: { name: string; start: number }[] = [];

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (line.length === 0 || line.length > 60) return;
    const isHeadingish =
      /^(?:[A-Z][A-Za-z &/'-]{2,40})\s*:?$/.test(line) ||
      /^[A-Z][A-Z &/'-]{2,40}\s*:?$/.test(line);
    if (!isHeadingish) return;
    for (const heading of SECTION_HEADINGS) {
      if (heading.pattern.test(line)) {
        found.push({ name: heading.name, start: index });
        break;
      }
    }
  });

  if (found.length === 0) return [];

  const sections: { name: string; content: string }[] = [];
  found.forEach((f, i) => {
    const end = i + 1 < found.length ? found[i + 1].start : lines.length;
    const body = lines
      .slice(f.start + 1, end)
      .join('\n')
      .trim();
    if (body) sections.push({ name: f.name, content: body });
  });
  return sections;
}

function sectionText(text: string, name: string): string {
  const sections = extractSections(text);
  const match = sections.find((s) => s.name === name);
  return match?.content ?? '';
}

function sentenceAround(text: string, index: number, length: number): string {
  const start = Math.max(0, text.lastIndexOf('\n', index) + 1);
  let end = text.indexOf('\n', index);
  if (end === -1) end = Math.min(text.length, index + length + 40);
  const raw = text.slice(start, Math.min(end, index + length + 40)).replace(/\s+/g, ' ').trim();
  return raw.length > 180 ? `${raw.slice(0, 177)}…` : raw;
}

export interface FindSkillsOptions {
  /** Cap the number of returned skills (most relevant first). */
  limit?: number;
  categories?: SkillCategory[];
}

/** Locate taxonomy skills in free text, with mention counts and evidence. */
export function findSkills(text: string, options: FindSkillsOptions = {}): SkillHit[] {
  if (!text) return [];
  const haystack = normalizeText(text);
  const lower = ` ${haystack.toLowerCase()} `;
  const hits: SkillHit[] = [];

  for (const skill of SKILL_TAXONOMY) {
    if (options.categories && !options.categories.includes(skill.category)) continue;
    const regex = skillMatcher(skill);
    regex.lastIndex = 0;
    let count = 0;
    let firstIndex = -1;
    let match: RegExpExecArray | null;
    // Guard against pathological overlap on huge documents.
    while ((match = regex.exec(lower)) !== null && count < 200) {
      if (match[0].length === 0) {
        regex.lastIndex += 1;
        continue;
      }
      count += 1;
      if (firstIndex === -1) firstIndex = match.index;
    }
    if (count === 0) continue;
    hits.push({
      name: skill.name,
      category: skill.category,
      demand: skill.demand,
      mentions: count,
      evidence: firstIndex >= 0 ? sentenceAround(haystack, firstIndex, 120) : undefined,
    });
  }

  hits.sort((a, b) => b.demand - a.demand || b.mentions - a.mentions || a.name.localeCompare(b.name));
  return options.limit ? hits.slice(0, options.limit) : hits;
}

const DEGREE_PATTERNS: { label: string; pattern: RegExp; level: number }[] = [
  { label: 'Ph.D', pattern: /\bph\.?\s?d\b|doctorate|doctor of philosophy/i, level: 5 },
  { label: 'M.Tech', pattern: /\bm\.?\s?tech\b|master of technology/i, level: 4 },
  { label: 'M.E', pattern: /\bm\.?\s?e\b|master of engineering/i, level: 4 },
  { label: 'M.Sc', pattern: /\bm\.?\s?sc\b|master of science/i, level: 4 },
  { label: 'MCA', pattern: /\bmca\b|master of computer applications/i, level: 4 },
  { label: 'MBA', pattern: /\bmba\b|master of business administration/i, level: 4 },
  { label: 'B.Tech', pattern: /\bb\.?\s?tech\b|bachelor of technology/i, level: 3 },
  { label: 'B.E', pattern: /\bb\.?\s?e\b|bachelor of engineering/i, level: 3 },
  { label: 'B.Sc', pattern: /\bb\.?\s?sc\b|bachelor of science/i, level: 3 },
  { label: 'BCA', pattern: /\bbca\b|bachelor of computer applications/i, level: 3 },
  { label: 'B.Com', pattern: /\bb\.?\s?com\b|bachelor of commerce/i, level: 3 },
  { label: 'Diploma', pattern: /\bdiploma\b|\bpolytechnic\b/i, level: 2 },
  { label: 'High School', pattern: /\b(?:class|grade)\s*(?:xii|12)\b|\bhsc\b|\bhigher secondary\b/i, level: 1 },
];

export function extractEducation(text: string): EducationEntry[] {
  const scope = sectionText(text, 'Education') || text;
  const entries: EducationEntry[] = [];

  for (const line of splitLines(scope)) {
    if (line.length > 220) continue;
    const degree = DEGREE_PATTERNS.find((d) => d.pattern.test(line));
    if (!degree) continue;
    const yearMatch = line.match(/\b(19|20)\d{2}\b/g);
    const scoreMatch = line.match(
      /(?:cgpa|gpa|percentage|marks?)\s*(?:of|:|=|-)?\s*(\d{1,3}(?:\.\d{1,2})?)\s*(%|\/\s*10)?/i,
    ) ?? line.match(/\b(\d{1,2}\.\d{1,2})\s*(?:cgpa|gpa)/i) ?? line.match(/\b(\d{2,3}(?:\.\d)?)\s*%/);
    const institution =
      line
        .replace(degree.pattern, ' ')
        .split(/[|,•·]/)
        .map((p) => p.trim())
        .find((p) => /[A-Za-z]{3,}/.test(p) && !/^\d/.test(p) && !/(cgpa|gpa|percentage|marks|year|grade)/i.test(p)) ??
      undefined;

    entries.push({
      qualification: degree.label,
      institution: institution && institution.length < 80 ? institution : undefined,
      year: yearMatch ? yearMatch[yearMatch.length - 1] : undefined,
      score: scoreMatch ? `${scoreMatch[1]}${scoreMatch[2] === '%' || !scoreMatch[2] ? '' : ''}${/cgpa|gpa/i.test(line) ? ' CGPA' : '%'}` : undefined,
    });
  }

  // Deduplicate by qualification, keeping the highest level occurrence first.
  const seen = new Map<string, EducationEntry>();
  for (const entry of entries) {
    if (!seen.has(entry.qualification)) seen.set(entry.qualification, entry);
  }
  return Array.from(seen.values()).slice(0, 6);
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function monthsBetween(from: string, to: string): number | undefined {
  const parse = (value: string) => {
    const m = value.match(/([a-z]{3})[a-z]*\s*(20\d{2}|\d{2})/i) ?? value.match(/(20\d{2})/);
    if (!m) return undefined;
    if (m[2]) return { month: MONTHS[m[1].slice(0, 3).toLowerCase()] ?? 1, year: Number(m[2]) };
    return { month: 1, year: Number(m[1]) };
  };
  const a = parse(from);
  const b = /present|current|now|ongoing/i.test(to)
    ? { month: new Date().getMonth() + 1, year: new Date().getFullYear() }
    : parse(to);
  if (!a || !b) return undefined;
  const months = (b.year - a.year) * 12 + (b.month - a.month);
  return months >= 0 ? months : undefined;
}

export function extractExperience(text: string): { entries: ExperienceEntry[]; months: number } {
  const scope = sectionText(text, 'Experience') || text;
  const entries: ExperienceEntry[] = [];

  const rolePattern =
    /((?:senior|junior|lead|principal|associate)?\s*(?:software|frontend|front-end|backend|back-end|full[- ]?stack|data|ml|ai|devops|qa|cloud|mobile|android|ios|site reliability|security|support)?\s*(?:engineer|developer|analyst|scientist|architect|consultant|intern|trainee|associate))/gi;

  for (const line of splitLines(scope)) {
    if (line.length > 240) continue;
    const roleMatch = rolePattern.exec(line);
    rolePattern.lastIndex = 0;
    const rangeMatch = line.match(/((?:[A-Za-z]{3,9}\s*)?(?:20\d{2}|\d{2}))\s*(?:-|–|—|to)\s*((?:[A-Za-z]{3,9}\s*)?(?:20\d{2}|\d{2})|present|current)/i);
    const yearsMatch = line.match(/(\d+(?:\.\d+)?)\s*\+?\s*(?:years?|yrs?)\b/i);
    const organisation =
      line
        .split(/[|,•·]/)
        .map((p) => p.trim())
        .find((p) => /(technologies|solutions|systems|labs|inc|pvt|ltd|llp|corp|company|consulting|digital|software|infotech)/i.test(p)) ??
      undefined;

    if (roleMatch) {
      const months = yearsMatch
        ? Math.round(parseFloat(yearsMatch[1]) * 12)
        : rangeMatch
          ? monthsBetween(rangeMatch[1], rangeMatch[2])
          : undefined;
      entries.push({
        role: roleMatch[1].replace(/\s+/g, ' ').trim().replace(/\b\w/g, (c) => c.toUpperCase()),
        organisation: organisation && organisation.length < 70 ? organisation : undefined,
        duration: rangeMatch ? `${rangeMatch[1].trim()} – ${rangeMatch[2].trim()}` : yearsMatch ? `${yearsMatch[1]} years` : undefined,
        months,
      });
    } else if (yearsMatch && /experience/i.test(line)) {
      entries.push({
        role: `${yearsMatch[1]}+ years of experience`,
        months: Math.round(parseFloat(yearsMatch[1]) * 12),
        duration: `${yearsMatch[1]} years`,
      });
    }
  }

  const months = entries.reduce((max, e) => Math.max(max, e.months ?? 0), 0);
  return { entries: entries.slice(0, 8), months };
}

export function extractProjects(text: string): string[] {
  const scope = sectionText(text, 'Projects');
  const source = scope || text;
  const projects: string[] = [];
  for (const line of splitLines(source)) {
    if (line.length < 12 || line.length > 220) continue;
    if (/\b(?:built|developed|designed|implemented|created|engineered|delivered)\b/i.test(line)) {
      projects.push(line.replace(/\s+/g, ' ').trim());
    }
    if (projects.length >= 8) break;
  }
  return unique(projects).slice(0, 6);
}

export function extractCertifications(text: string): string[] {
  const scope = sectionText(text, 'Certifications');
  if (!scope) {
    const skills = findSkills(text, { categories: ['CERTIFICATION'] });
    return skills.map((s) => s.name);
  }
  return splitLines(scope)
    .filter((l) => l.length > 4 && l.length < 160)
    .slice(0, 6);
}

export function hasContactInfo(text: string) {
  return /\S+@\S+\.\S+/.test(text) || /(\+?\d[\d\s-]{8,15})/.test(text);
}

const ACTION_VERBS = /\b(led|built|developed|designed|implemented|optimi[sz]ed|automated|reduced|increased|improved|delivered|architected|mentored|coordinated|analysed|analyzed|launched|shipped|refactored|scaled)\b/gi;

export function analyzeResumeText(text: string, provider: ResumeAnalysis['provider'], model?: string): ResumeAnalysis {
  const started = Date.now();
  const normalized = normalizeText(text);
  const sections = extractSections(normalized);
  const skills = findSkills(normalized);
  const education = extractEducation(normalized);
  const { entries: experience, months } = extractExperience(normalized);
  const projects = extractProjects(normalized);
  const certifications = extractCertifications(normalized);
  const wordCount = normalized.split(/\s+/).filter(Boolean).length;

  const strengths: string[] = [];
  const improvements: string[] = [];

  const languages = skills.filter((s) => s.category === 'PROGRAMMING_LANGUAGE');
  const frameworks = skills.filter((s) => s.category === 'FRAMEWORK' || s.category === 'LIBRARY');
  const tools = skills.filter((s) => s.category === 'TOOL' || s.category === 'CLOUD' || s.category === 'PLATFORM');
  const databases = skills.filter((s) => s.category === 'DATABASE');

  if (languages.length >= 3) strengths.push(`Covers ${languages.length} programming languages (${languages.slice(0, 3).map((l) => l.name).join(', ')})`);
  if (frameworks.length >= 3) strengths.push(`Names ${frameworks.length} frameworks and libraries recruiters search for`);
  if (databases.length >= 1) strengths.push(`Shows database experience (${databases.map((d) => d.name).join(', ')})`);
  if (tools.length >= 2) strengths.push(`Includes tooling and deployment (${tools.slice(0, 3).map((t) => t.name).join(', ')})`);
  if (projects.length >= 2) strengths.push(`${projects.length} concrete projects with build evidence`);
  if (months >= 6) strengths.push(`${Math.round(months / 12 * 10) / 10} years of hands-on experience`);
  if (certifications.length > 0) strengths.push(`${certifications.length} certification(s) listed`);

  if (wordCount < 250) improvements.push(`Only ${wordCount} words — add measurable detail to your projects and coursework`);
  if (wordCount > 1100) improvements.push(`${wordCount} words is long; tighten it to one page of high-signal content`);
  if (projects.length === 0) improvements.push('No projects detected — add 2–3 projects with the problem, your stack and the outcome');
  if (!hasContactInfo(normalized)) improvements.push('No email or phone number detected in the parsed text');
  if (!ACTION_VERBS.test(normalized)) improvements.push('Use action verbs (built, led, optimised) and quantify impact');
  ACTION_VERBS.lastIndex = 0;
  if (tools.length === 0) improvements.push('No deployment or tooling skills (Git, Docker, CI/CD, cloud) detected');
  if (education.length === 0) improvements.push('Add an education section with your degree, institution and year');

  const verbs = (normalized.match(ACTION_VERBS) ?? []).length;
  ACTION_VERBS.lastIndex = 0;
  let quality = 34;
  quality += clamp(Math.min(skills.length / 18, 1) * 22, 0, 22);
  quality += projects.length > 0 ? clamp(projects.length * 4, 0, 12) : 0;
  quality += education.length > 0 ? 8 : 0;
  quality += wordCount >= 300 && wordCount <= 1000 ? 10 : wordCount >= 180 ? 5 : 0;
  quality += hasContactInfo(normalized) ? 5 : 0;
  quality += clamp(verbs * 1.5, 0, 9);
  quality = clamp(Math.round(quality), 0, 100);

  const headlineRole =
    experience[0]?.role ??
    (skills.some((s) => /Machine Learning|Data Analysis|NLP/i.test(s.name))
      ? 'Aspiring Data / ML Engineer'
      : skills.some((s) => /React|Node.js|JavaScript|TypeScript/i.test(s.name))
        ? 'Aspiring Full-Stack Developer'
        : education[0]?.qualification
          ? `${education[0].qualification} candidate`
          : 'Student');

  const summary = `${headlineRole}. Resume parsed ${wordCount} words with ${skills.length} recognised skills, ${projects.length} project${projects.length === 1 ? '' : 's'} and ${education.length} education entr${education.length === 1 ? 'y' : 'ies'}. Document quality ${quality}/100.`;

  return {
    provider,
    model,
    summary,
    headlineRole,
    sections,
    education,
    experience,
    totalExperienceMonths: months,
    skills,
    projects,
    certifications,
    strengths: strengths.slice(0, 6),
    improvements: improvements.slice(0, 6),
    wordCount,
    qualityScore: quality,
    durationMs: Date.now() - started,
  };
}

function detectRole(text: string): string {
  const labelled = text.match(/(?:role|position|job\s*title|designation|opening\s*for|hiring)\s*[:\-–]\s*([^\n]{3,80})/i);
  if (labelled) return labelled[1].trim().replace(/\s+/g, ' ');
  const title =
    /((?:senior |junior |lead |associate )?(?:software|frontend|front-end|backend|back-end|full[- ]?stack|data|ml|ai|devops|qa|cloud|mobile|android|ios|security|business)\s*(?:engineer|developer|analyst|scientist|architect|consultant|intern|trainee))/i.exec(
      text,
    );
  if (title) return title[1].replace(/\s+/g, ' ').trim().replace(/\b\w/g, (c) => c.toUpperCase());
  const firstLine = splitLines(text)[0];
  return firstLine && firstLine.length < 80 ? firstLine : 'Unknown role';
}

function detectCompany(text: string): string | undefined {
  const labelled = text.match(/(?:company|organisation|organization|employer|about)\s*[:\-–]\s*([^\n]{2,70})/i);
  if (labelled) return labelled[1].trim();
  const suffix = /([A-Z][A-Za-z0-9&.']*(?:\s+[A-Z][A-Za-z0-9&.']*)?\s+(?:Technologies|Solutions|Systems|Labs|Software|Infotech|Digital|Analytics|Consulting|Inc|Pvt\.?\s*Ltd))/i.exec(text);
  return suffix?.[1]?.trim();
}

function detectSeniority(text: string, years: number): Seniority {
  if (/\bintern(ship)?\b|\bfresher\b|\bgraduate hire\b|\btrainee\b/i.test(text) && years <= 1) return 'INTERN';
  if (years <= 2) return 'ENTRY';
  if (years <= 6) return 'MID';
  if (years > 6) return 'SENIOR';
  if (/\bsenior\b|\bstaff\b|\bprincipal\b|\blead\b/i.test(text)) return 'SENIOR';
  return 'UNKNOWN';
}

function detectExperienceYears(text: string): number {
  const explicit = text.match(/(\d{1,2})\s*\+?\s*(?:-|–|to)\s*(\d{1,2})\s*\+?\s*(?:years?|yrs?)/i);
  if (explicit) return Number(explicit[1]);
  const single = text.match(/(\d{1,2})\s*\+?\s*(?:years?|yrs?)\s*(?:of|in)?/i);
  if (single) return Number(single[1]);
  if (/\bfresher\b|\bno experience\b|\b0 years\b/i.test(text)) return 0;
  return 0;
}

function bulletLines(text: string, headings: string[]): string[] {
  const out: string[] = [];
  for (const heading of headings) {
    const body = sectionText(text, heading);
    if (body) out.push(...splitLines(body));
  }
  return out.filter((l) => l.length > 8 && l.length < 240);
}

export function analyzeJobText(text: string, provider: JobAnalysis['provider'], model?: string): JobAnalysis {
  const started = Date.now();
  const normalized = normalizeText(text);
  const skills = findSkills(normalized);
  const experienceYears = detectExperienceYears(normalized);
  const role = detectRole(normalized);
  const seniority = detectSeniority(normalized, experienceYears);

  const requirements = bulletLines(normalized, ['Requirements']);
  const responsibilities = bulletLines(normalized, ['Responsibilities']);
  const preferred = bulletLines(normalized, ['Preferred']);

  const requirementText = requirements.join('\n') || normalized;
  const preferredText = preferred.join('\n');

  const categorise = (categories: SkillCategory[]) =>
    skills.filter((s) => categories.includes(s.category)).map((s) => s.name);

  const education = unique(
    DEGREE_PATTERNS.filter((d) => d.pattern.test(normalized)).map((d) => d.label),
  ).slice(0, 4);

  const niceToHave = unique([
    ...preferred.slice(0, 5),
    ...splitLines(normalized).filter((l) => /\b(preferred|plus|bonus|nice to have|good to have|advantage)\b/i.test(l)).slice(0, 4),
  ]).slice(0, 6);

  const summary = `${role}${seniority !== 'UNKNOWN' ? ` (${seniorityLabel(seniority)})` : ''} — ${skills.length} recognised skills, ${experienceYears} year(s) of experience expected${education.length ? `, ${education.join(' / ')} preferred` : ''}.`;

  return {
    provider,
    model,
    summary,
    role,
    company: detectCompany(normalized),
    seniority,
    technicalSkills: skills,
    languages: categorise(['PROGRAMMING_LANGUAGE']),
    frameworks: categorise(['FRAMEWORK', 'LIBRARY']),
    tools: categorise(['TOOL', 'PLATFORM', 'CERTIFICATION']),
    databases: categorise(['DATABASE']),
    cloud: categorise(['CLOUD']),
    softSkills: categorise(['SOFT_SKILL']),
    experienceYears,
    education,
    responsibilities: responsibilities.slice(0, 8),
    requirements: (requirements.length ? requirements : splitLines(requirementText)).slice(0, 10),
    niceToHave,
    durationMs: Date.now() - started,
  };
}

function seniorityLabel(seniority: Seniority) {
  return seniority === 'INTERN' ? 'Internship' : seniority === 'ENTRY' ? 'Entry level' : seniority === 'MID' ? 'Mid level' : 'Senior';
}

/**
 * Score a resume against a job description.
 *
 * Weights are explicit and reported back to the user in the breakdown so the
 * number is explainable rather than magic.
 */
export function matchTexts(resumeText: string, jobText: string, provider: MatchResult['provider'], model?: string): MatchResult {
  const started = Date.now();
  const resume = analyzeResumeText(resumeText, provider);
  const job = analyzeJobText(jobText, provider);

  const resumeByName = new Map(resume.skills.map((s) => [s.name.toLowerCase(), s]));

  // Preferred/“nice to have” items weigh less than hard requirements.
  const niceToHave = new Set(job.niceToHave.join(' ').toLowerCase().split(/\W+/));
  const weightOf = (skill: SkillHit) => skill.demand * (niceToHave.has(skill.name.toLowerCase()) ? 0.5 : 1);

  const matched: SkillHit[] = [];
  const partial: SkillHit[] = [];
  const missing: SkillHit[] = [];
  let earned = 0;
  let totalWeight = 0;

  for (const skill of job.technicalSkills) {
    const w = weightOf(skill);
    totalWeight += w;
    const hit = resumeByName.get(skill.name.toLowerCase());
    if (!hit) {
      missing.push({ ...skill });
      continue;
    }
    if (hit.mentions === 1 && skill.demand >= 3) {
      partial.push({ ...hit, demand: skill.demand });
      earned += w * 0.6;
    } else {
      matched.push({ ...hit, demand: skill.demand });
      earned += w;
    }
  }

  const skillsScore = totalWeight > 0 ? clamp((earned / totalWeight) * 100, 0, 100) : 70;

  // Experience
  const requiredMonths = job.experienceYears * 12;
  let experienceScore: number;
  let experienceDetail: string;
  if (requiredMonths === 0) {
    experienceScore = resume.totalExperienceMonths > 0 || resume.projects.length > 0 ? 100 : 82;
    experienceDetail = 'No minimum experience stated — project work counts in your favour.';
  } else if (resume.totalExperienceMonths >= requiredMonths) {
    experienceScore = 100;
    experienceDetail = `You meet the ${job.experienceYears} year requirement (${round(resume.totalExperienceMonths / 12, 1)} years detected).`;
  } else {
    experienceScore = clamp((resume.totalExperienceMonths / requiredMonths) * 100, 8, 95);
    experienceDetail = `${Math.round(resume.totalExperienceMonths / 12 * 10) / 10} years detected against ${job.experienceYears} required.`;
  }

  // Education
  let educationScore = 70;
  if (job.education.length === 0) {
    educationScore = 90;
  } else if (resume.education.length === 0) {
    educationScore = 35;
  } else {
    const wanted = job.education.map((e) => e.toLowerCase());
    const have = resume.education.map((e) => e.qualification.toLowerCase());
    educationScore = wanted.some((w) => have.some((h) => h.includes(w) || w.includes(h))) ? 100 : 60;
  }

  // Keyword / role alignment (beyond the taxonomy)
  const jobTokens = new Set(
    normalizeText(jobText)
      .toLowerCase()
      .split(/[^a-z0-9+#.]+/)
      .filter((t) => t.length > 3),
  );
  const resumeTokens = new Set(
    normalizeText(resumeText)
      .toLowerCase()
      .split(/[^a-z0-9+#.]+/)
      .filter((t) => t.length > 3),
  );
  const STOP = new Set(['with', 'this', 'that', 'have', 'will', 'your', 'you', 'our', 'for', 'and', 'the', 'are', 'from', 'work', 'team', 'role', 'able', 'strong', 'good', 'plus', 'must', 'should', 'would', 'using', 'into', 'about', 'years', 'experience', 'skills', 'knowledge', 'ability', 'understanding', 'excellent', 'related', 'other', 'well', 'part', 'full', 'time', 'join', 'looking', 'required', 'requirements']);
  const meaningful = Array.from(jobTokens).filter((t) => !STOP.has(t));
  const overlap = meaningful.filter((t) => resumeTokens.has(t)).length;
  const keywordScore = meaningful.length ? clamp((overlap / meaningful.length) * 130, 0, 100) : 60;

  // Soft skills
  const softRequired = job.softSkills;
  const softHave = resume.skills.filter((s) => s.category === 'SOFT_SKILL').map((s) => s.name);
  const softScore =
    softRequired.length === 0
      ? 75
      : clamp((softRequired.filter((s) => softHave.includes(s)).length / softRequired.length) * 100, 0, 100);

  const breakdown: ScoreBreakdown[] = [
    {
      label: 'Technical skills',
      score: round(skillsScore, 0),
      weight: 0.55,
      detail: `${matched.length + partial.length} of ${job.technicalSkills.length} required skills appear in your resume${missing.length ? `, ${missing.length} missing` : ''}.`,
    },
    {
      label: 'Experience',
      score: round(experienceScore, 0),
      weight: 0.15,
      detail: experienceDetail,
    },
    {
      label: 'Education',
      score: round(educationScore, 0),
      weight: 0.1,
      detail:
        job.education.length === 0
          ? 'No specific qualification required.'
          : `Looking for ${job.education.join(' or ')}; resume lists ${resume.education.map((e) => e.qualification).join(', ') || 'nothing parsed'}.`,
    },
    {
      label: 'Keyword alignment',
      score: round(keywordScore, 0),
      weight: 0.12,
      detail: `${overlap} of ${meaningful.length} distinctive job keywords also appear in your resume.`,
    },
    {
      label: 'Soft skills',
      score: round(softScore, 0),
      weight: 0.08,
      detail: softRequired.length ? `Requested: ${softRequired.join(', ')}.` : 'No explicit soft-skill requirement detected.',
    },
  ];

  const score = round(
    clamp(breakdown.reduce((acc, b) => acc + b.score * b.weight, 0), 0, 100),
    0,
  );
  const verdict = verdictForScore(score);

  missing.sort((a, b) => b.demand - a.demand || a.name.localeCompare(b.name));

  const recommendations: Recommendation[] = missing.slice(0, 7).map((skill, index) => {
    const def = lookup(skill.name);
    return {
      title: `Add ${skill.name} to your resume`,
      detail:
        def?.learn ??
        `The job mentions ${skill.name}; include a concrete example of using it.`,
      priority: skill.demand >= 4 || index < 2 ? 'HIGH' : skill.demand >= 3 ? 'MEDIUM' : 'LOW',
      effort: skill.demand >= 4 ? '1–3 weeks of focused practice' : 'A weekend project',
      skill: skill.name,
    };
  });

  if (resume.projects.length === 0) {
    recommendations.push({
      title: 'Add a projects section',
      detail: 'Two or three projects with the problem, your stack and the outcome make every skill claim verifiable.',
      priority: 'HIGH',
      effort: '1–2 weeks',
    });
  }
  if (resume.qualityScore < 55) {
    recommendations.push({
      title: 'Tighten resume structure',
      detail: 'Use clear headings (Summary, Education, Projects, Skills), action verbs and numbers so both recruiters and parsers can read it.',
      priority: 'MEDIUM',
      effort: '2–3 hours',
    });
  }
  if (partial.length > 0) {
    recommendations.push({
      title: `Strengthen ${partial.slice(0, 3).map((p) => p.name).join(', ')}`,
      detail: 'These appear once in your resume. Add a project bullet or metric that proves real usage.',
      priority: 'MEDIUM',
      effort: 'A few hours',
    });
  }

  const evidence = matched
    .filter((m) => m.evidence)
    .slice(0, 10)
    .map((m) => ({ skill: m.name, snippet: m.evidence as string }));

  const summary =
    `Your resume matches ${round(score, 0)}% of what this ${job.role} description asks for. ` +
    `${matched.length} required skill${matched.length === 1 ? '' : 's'} are clearly evidenced` +
    (partial.length ? `, ${partial.length} are mentioned but thin` : '') +
    (missing.length ? `, and ${missing.length} are missing (${missing.slice(0, 3).map((m) => m.name).join(', ')}${missing.length > 3 ? ', …' : ''}).` : '.');

  return {
    provider,
    model,
    score,
    verdict,
    verdictLabel: VERDICT_LABEL[verdict],
    summary,
    matchedSkills: matched,
    missingSkills: missing,
    partialSkills: partial,
    breakdown,
    evidence,
    recommendations: recommendations.slice(0, 8),
    disclaimer: MATCH_DISCLAIMER,
    durationMs: Date.now() - started,
  };
}

function lookup(name: string): SkillDefinition | undefined {
  return SKILL_TAXONOMY.find((s) => s.name.toLowerCase() === name.toLowerCase());
}

export function categoryLabel(category: SkillCategory) {
  return CATEGORY_LABEL[category] ?? category;
}
