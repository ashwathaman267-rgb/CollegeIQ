/**
 * AI service contract.
 *
 * Every provider (mock, Gemini, OpenAI, custom) implements `AIService`, so the
 * API routes and the whole frontend stay identical when a real API key is
 * supplied later. Keys are read from the server environment only — they are
 * never sent to the browser.
 */

export type AnalysisProvider = 'MOCK' | 'GEMINI' | 'OPENAI' | 'CUSTOM';

export type SkillCategory =
  | 'PROGRAMMING_LANGUAGE'
  | 'FRAMEWORK'
  | 'LIBRARY'
  | 'TOOL'
  | 'DATABASE'
  | 'CLOUD'
  | 'PLATFORM'
  | 'DOMAIN'
  | 'SOFT_SKILL'
  | 'CERTIFICATION';

export type MatchVerdict = 'EXCELLENT' | 'STRONG' | 'MODERATE' | 'WEAK' | 'POOR';

export type Seniority = 'INTERN' | 'ENTRY' | 'MID' | 'SENIOR' | 'UNKNOWN';

export interface SkillHit {
  name: string;
  category: SkillCategory;
  demand: number;
  mentions: number;
  /** Where the skill showed up in the source document. */
  evidence?: string;
}

export interface EducationEntry {
  qualification: string;
  institution?: string;
  year?: string;
  score?: string;
}

export interface ExperienceEntry {
  role: string;
  organisation?: string;
  duration?: string;
  months?: number;
}

export interface ResumeAnalysis {
  provider: AnalysisProvider;
  model?: string;
  summary: string;
  headlineRole?: string;
  sections: { name: string; content: string }[];
  education: EducationEntry[];
  experience: ExperienceEntry[];
  totalExperienceMonths: number;
  skills: SkillHit[];
  projects: string[];
  certifications: string[];
  strengths: string[];
  improvements: string[];
  wordCount: number;
  /** Document quality 0-100 (structure, evidence, keywords) — not a job score. */
  qualityScore: number;
  durationMs: number;
}

export interface JobAnalysis {
  provider: AnalysisProvider;
  model?: string;
  summary: string;
  role: string;
  company?: string;
  seniority: Seniority;
  technicalSkills: SkillHit[];
  languages: string[];
  frameworks: string[];
  tools: string[];
  databases: string[];
  cloud: string[];
  softSkills: string[];
  experienceYears: number;
  education: string[];
  responsibilities: string[];
  requirements: string[];
  niceToHave: string[];
  durationMs: number;
}

export interface ScoreBreakdown {
  label: string;
  score: number; // 0-100 for this component
  weight: number; // 0-1 contribution to the total
  detail: string;
}

export interface Recommendation {
  title: string;
  detail: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  effort: string;
  skill?: string;
}

export interface MatchResult {
  provider: AnalysisProvider;
  model?: string;
  /** Resume-to-job-description alignment, 0-100. */
  score: number;
  verdict: MatchVerdict;
  verdictLabel: string;
  summary: string;
  matchedSkills: SkillHit[];
  missingSkills: SkillHit[];
  partialSkills: SkillHit[];
  breakdown: ScoreBreakdown[];
  evidence: { skill: string; snippet: string }[];
  recommendations: Recommendation[];
  /** Always present — the score is alignment, never a hiring promise. */
  disclaimer: string;
  durationMs: number;
}

export interface AIService {
  readonly name: AnalysisProvider;
  readonly model?: string;
  analyzeResume(resume: string): Promise<ResumeAnalysis>;
  analyzeJobDescription(job: string): Promise<JobAnalysis>;
  matchResumeToJob(resume: string, job: string): Promise<MatchResult>;
}

export const MATCH_DISCLAIMER =
  'This score measures how closely your resume matches the wording and requirements of this job description. It is not a prediction of whether you will be hired, and it cannot see factors such as interviews, referrals or the number of other applicants.';

export const VERDICT_LABEL: Record<MatchVerdict, string> = {
  EXCELLENT: 'Exceptional alignment',
  STRONG: 'Strong alignment',
  MODERATE: 'Moderate alignment',
  WEAK: 'Weak alignment',
  POOR: 'Low alignment',
};

export function verdictForScore(score: number): MatchVerdict {
  if (score >= 85) return 'EXCELLENT';
  if (score >= 70) return 'STRONG';
  if (score >= 50) return 'MODERATE';
  if (score >= 30) return 'WEAK';
  return 'POOR';
}
