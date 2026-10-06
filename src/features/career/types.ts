import type { JobAnalysis, ResumeAnalysis } from '@/lib/ai/types';

/**
 * Shared shapes for the career module. They mirror exactly what
 * `/api/resumes`, `/api/jobs`, `/api/ai/matches` and `/api/ai/gaps` return,
 * so the UI never guesses at the server contract.
 */

export type Tone = 'neutral' | 'brand' | 'ok' | 'warn' | 'danger' | 'info' | 'accent';

export interface ResumeSummary {
  id: string;
  title: string;
  version: number;
  isPrimary: boolean;
  wordCount: number;
  createdAt: string;
  updatedAt: string;
  fileName: string | null;
  fileSize: number | null;
  fileAssetId: string | null;
  matchCount: number;
  analysis: ResumeAnalysis | null;
  skills: { name: string; category: string; mentions: number }[];
}

export interface JobSummary {
  id: string;
  title: string;
  company: string | null;
  location: string | null;
  jobType: string;
  minExperience: number;
  wordCount: number;
  createdAt: string;
  matchCount: number;
  ownedByMe: boolean;
  analysis: JobAnalysis | null;
}

export interface MatchSummary {
  id: string;
  score: number;
  verdict: string;
  provider: string;
  createdAt: string;
  resumeId: string;
  resumeTitle: string;
  jobId: string;
  jobTitle: string;
  company: string | null;
}

export interface GapItem {
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

export interface GapBoard {
  open: number;
  closed: number;
  inProgress: number;
  items: GapItem[];
  bestScore: number | null;
  averageScore: number | null;
}

export const JOB_TYPE_LABEL: Record<string, string> = {
  FULL_TIME: 'Full time',
  PART_TIME: 'Part time',
  INTERNSHIP: 'Internship',
  CONTRACT: 'Contract',
  REMOTE: 'Remote',
  HYBRID: 'Hybrid',
  ON_SITE: 'On site',
  RESEARCH: 'Research',
  OTHER: 'Other',
};

export const SKILL_CATEGORY_LABEL: Record<string, string> = {
  PROGRAMMING_LANGUAGE: 'Language',
  FRAMEWORK: 'Framework',
  LIBRARY: 'Library',
  TOOL: 'Tool',
  DATABASE: 'Database',
  CLOUD: 'Cloud',
  PLATFORM: 'Platform',
  DOMAIN: 'Domain',
  SOFT_SKILL: 'Soft skill',
  CERTIFICATION: 'Certification',
};

export const GAP_STATUS_LABEL: Record<string, string> = {
  OPEN: 'Not started',
  IN_PROGRESS: 'In progress',
  CLOSED: 'Closed',
};

export const VERDICT_TONE: Record<string, Tone> = {
  EXCELLENT: 'ok',
  STRONG: 'ok',
  MODERATE: 'warn',
  WEAK: 'danger',
  POOR: 'danger',
};

export const VERDICT_LABEL: Record<string, string> = {
  EXCELLENT: 'Exceptional alignment',
  STRONG: 'Strong alignment',
  MODERATE: 'Moderate alignment',
  WEAK: 'Weak alignment',
  POOR: 'Low alignment',
};

export function scoreTone(score: number): 'ok' | 'warn' | 'danger' {
  if (score >= 70) return 'ok';
  if (score >= 50) return 'warn';
  return 'danger';
}

export function severityTone(severity: string): Tone {
  if (severity === 'HIGH') return 'danger';
  if (severity === 'MEDIUM') return 'warn';
  return 'info';
}
