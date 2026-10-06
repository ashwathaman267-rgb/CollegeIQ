import { env, hasAiProvider } from '@/lib/env';
import { GeminiAIService } from './gemini';
import { MockAIService } from './mock';
import { OpenAIService } from './openai';
import type { AIService, AnalysisProvider } from './types';

let cached: AIService | null = null;

/**
 * Resolve the active AI provider from the server environment.
 *
 * The application never requires an external key: with `AI_PROVIDER=mock` (or no
 * key configured) the deterministic local engine is used, and cloud providers
 * fall back to it automatically on any failure.
 */
export function getAIService(): AIService {
  if (cached) return cached;
  const { AI_PROVIDER } = env();

  if (!hasAiProvider()) {
    cached = new MockAIService();
    return cached;
  }

  switch (AI_PROVIDER) {
    case 'gemini':
      cached = new GeminiAIService();
      break;
    case 'openai':
      cached = new OpenAIService();
      break;
    case 'custom':
      // A custom endpoint is expected to speak the OpenAI chat-completions shape.
      cached = new OpenAIService();
      break;
    default:
      cached = new MockAIService();
  }
  return cached;
}

export interface AiProviderStatus {
  provider: AnalysisProvider;
  label: string;
  model: string;
  live: boolean;
  reason: string;
}

/** Shown in the UI so users always know which engine produced a result. */
export function describeAiProvider(): AiProviderStatus {
  const service = getAIService();
  const configured = env().AI_PROVIDER;
  const live = hasAiProvider();
  return {
    provider: service.name,
    label:
      service.name === 'MOCK'
        ? 'CampusIQ local engine'
        : service.name === 'GEMINI'
          ? 'Google Gemini'
          : service.name === 'OPENAI'
            ? 'OpenAI'
            : 'Custom AI endpoint',
    model: service.model ?? 'campusiq-analysis-engine-v1',
    live,
    reason: live
      ? `Connected to ${configured} — results come from the configured provider, with automatic local fallback.`
      : `No AI_API_KEY configured (AI_PROVIDER=${configured}). Analysis runs on CampusIQ's built-in engine; add a key to switch providers without changing any code.`,
  };
}

export * from './types';
export { MockAIService, GeminiAIService, OpenAIService };
