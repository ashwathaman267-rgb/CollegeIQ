import { env } from '@/lib/env';
import { analyzeJobText, analyzeResumeText, matchTexts } from './engine';
import { callJson, mergeJobAnalysis, mergeMatch, mergeResumeAnalysis, withFallback } from './http';
import type { AIService, JobAnalysis, MatchResult, ResumeAnalysis } from './types';

const RESUME_PROMPT = `You are a technical resume parser. Return ONLY valid JSON with these keys:
summary (1-2 sentences), headlineRole, education[{qualification,institution,year,score}],
experience[{role,organisation,duration,months}], totalExperienceMonths (number),
skills[{name,category,demand(1-5),mentions,evidence}], projects[string], certifications[string],
strengths[string], improvements[string], qualityScore (0-100).
Categories: PROGRAMMING_LANGUAGE, FRAMEWORK, LIBRARY, TOOL, DATABASE, CLOUD, PLATFORM, DOMAIN, SOFT_SKILL, CERTIFICATION.`;

const JOB_PROMPT = `You are a job description analyser. Return ONLY valid JSON with these keys:
summary, role, company, seniority (INTERN|ENTRY|MID|SENIOR|UNKNOWN),
technicalSkills[{name,category,demand(1-5),mentions}], experienceYears (number),
education[string], responsibilities[string], requirements[string], niceToHave[string].`;

const MATCH_PROMPT = `You compare a resume with a job description. Return ONLY valid JSON:
score (0-100 alignment between the resume text and the job description text — never a hiring probability),
verdict (EXCELLENT|STRONG|MODERATE|WEAK|POOR), summary (2 sentences, factual, no promises),
matchedSkills[{name,category,demand,mentions,evidence}], missingSkills[{name,category,demand,mentions}],
partialSkills[{name,category,demand,mentions}], breakdown[{label,score,weight,detail}],
recommendations[{title,detail,priority(HIGH|MEDIUM|LOW),effort,skill}].`;

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  error?: { message?: string };
}

export class GeminiAIService implements AIService {
  readonly name = 'GEMINI' as const;
  readonly model: string;

  constructor() {
    const { AI_MODEL, AI_API_URL } = env();
    this.model = AI_MODEL || 'gemini-2.0-flash';
    this.baseUrl = (AI_API_URL || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/$/, '');
  }

  private baseUrl: string;

  private async generate(system: string, content: string): Promise<unknown> {
    const { AI_API_KEY } = env();
    if (!AI_API_KEY) throw new Error('AI_API_KEY is not configured');

    const body = {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: content.slice(0, 60_000) }] }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
        maxOutputTokens: 4096,
      },
    };

    const data = await callJson<GeminiResponse>(
      `${this.baseUrl}/models/${this.model}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': AI_API_KEY,
        },
        body: JSON.stringify(body),
      },
    );

    if (data.error?.message) throw new Error(data.error.message);
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    if (!text) throw new Error('Gemini returned an empty completion');
    return JSON.parse(text);
  }

  async analyzeResume(resume: string): Promise<ResumeAnalysis> {
    const local = analyzeResumeText(resume, 'MOCK', this.model);
    return withFallback(
      async () => mergeResumeAnalysis(local, await this.generate(RESUME_PROMPT, resume), 'GEMINI', this.model),
      () => ({ ...local, provider: 'MOCK' }),
    );
  }

  async analyzeJobDescription(job: string): Promise<JobAnalysis> {
    const local = analyzeJobText(job, 'MOCK', this.model);
    return withFallback(
      async () => mergeJobAnalysis(local, await this.generate(JOB_PROMPT, job), 'GEMINI', this.model),
      () => ({ ...local, provider: 'MOCK' }),
    );
  }

  async matchResumeToJob(resume: string, job: string): Promise<MatchResult> {
    const local = matchTexts(resume, job, 'MOCK', this.model);
    return withFallback(
      async () =>
        mergeMatch(
          local,
          await this.generate(MATCH_PROMPT, `# RESUME\n${resume}\n\n# JOB DESCRIPTION\n${job}`),
          'GEMINI',
          this.model,
        ),
      () => ({ ...local, provider: 'MOCK' }),
    );
  }
}
