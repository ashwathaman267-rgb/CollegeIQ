import { analyzeJobText, analyzeResumeText, matchTexts } from './engine';
import type { AIService, JobAnalysis, MatchResult, ResumeAnalysis } from './types';

/**
 * Default provider: fully local, deterministic analysis.
 * No API key, no network, no cost — and the output shape is identical to the
 * cloud providers, so nothing else in the app changes when a key is added.
 */
export class MockAIService implements AIService {
  readonly name = 'MOCK' as const;
  readonly model = 'campusiq-analysis-engine-v1';

  async analyzeResume(resume: string): Promise<ResumeAnalysis> {
    return analyzeResumeText(resume, 'MOCK', this.model);
  }

  async analyzeJobDescription(job: string): Promise<JobAnalysis> {
    return analyzeJobText(job, 'MOCK', this.model);
  }

  async matchResumeToJob(resume: string, job: string): Promise<MatchResult> {
    return matchTexts(resume, job, 'MOCK', this.model);
  }
}
