import { env } from '@/lib/env';
import { analyzeJobText, analyzeResumeText, matchTexts } from './engine';
import { callJson, mergeJobAnalysis, mergeMatch, mergeResumeAnalysis, withFallback } from './http';
import type { AIService, JobAnalysis, MatchResult, ResumeAnalysis } from './types';

const SYSTEM = `You are CampusIQ's career analysis engine. You always answer with a single valid JSON object and nothing else — no prose, no markdown fences. Scores describe how well a resume matches a job description's stated requirements; they are never a prediction of hiring outcomes.`;

interface ChatResponse {
  choices?: { message?: { content?: string } }[];
  error?: { message?: string };
}

export class OpenAIService implements AIService {
  readonly name = 'OPENAI' as const;
  readonly model: string;
  private baseUrl: string;

  constructor() {
    const { AI_MODEL, AI_API_URL } = env();
    this.model = AI_MODEL || 'gpt-4o-mini';
    this.baseUrl = (AI_API_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  }

  private async generate(instructions: string, content: string): Promise<unknown> {
    const { AI_API_KEY } = env();
    if (!AI_API_KEY) throw new Error('AI_API_KEY is not configured');

    const data = await callJson<ChatResponse>(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${AI_API_KEY}`,
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: `${instructions}\n\n${content.slice(0, 60_000)}` },
        ],
      }),
    });

    if (data.error?.message) throw new Error(data.error.message);
    const text = data.choices?.[0]?.message?.content ?? '';
    if (!text) throw new Error('OpenAI returned an empty completion');
    return JSON.parse(text);
  }

  async analyzeResume(resume: string): Promise<ResumeAnalysis> {
    const local = analyzeResumeText(resume, 'MOCK', this.model);
    return withFallback(
      async () =>
        mergeResumeAnalysis(
          local,
          await this.generate(
            'Return JSON: {summary, headlineRole, education[], experience[], totalExperienceMonths, skills[{name,category,demand,mentions,evidence}], projects[], certifications[], strengths[], improvements[], qualityScore}.',
            resume,
          ),
          'OPENAI',
          this.model,
        ),
      () => ({ ...local, provider: 'MOCK' }),
    );
  }

  async analyzeJobDescription(job: string): Promise<JobAnalysis> {
    const local = analyzeJobText(job, 'MOCK', this.model);
    return withFallback(
      async () =>
        mergeJobAnalysis(
          local,
          await this.generate(
            'Return JSON: {summary, role, company, seniority, technicalSkills[{name,category,demand,mentions}], experienceYears, education[], responsibilities[], requirements[], niceToHave[]}.',
            job,
          ),
          'OPENAI',
          this.model,
        ),
      () => ({ ...local, provider: 'MOCK' }),
    );
  }

  async matchResumeToJob(resume: string, job: string): Promise<MatchResult> {
    const local = matchTexts(resume, job, 'MOCK', this.model);
    return withFallback(
      async () =>
        mergeMatch(
          local,
          await this.generate(
            'Return JSON: {score(0-100 alignment), verdict, summary, matchedSkills[], missingSkills[], partialSkills[], breakdown[{label,score,weight,detail}], recommendations[{title,detail,priority,effort,skill}]}.',
            `# RESUME\n${resume}\n\n# JOB DESCRIPTION\n${job}`,
          ),
          'OPENAI',
          this.model,
        ),
      () => ({ ...local, provider: 'MOCK' }),
    );
  }
}
