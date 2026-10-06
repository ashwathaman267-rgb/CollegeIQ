import { apiHandler, ok } from '@/server/api/handler';
import { RATE_LIMITS } from '@/server/middleware/rate-limit';
import { getAIService } from '@/lib/ai';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const schema = z.object({
  kind: z.enum(['resume', 'job']),
  text: z.string().trim().min(40, 'Add at least a paragraph of text').max(120000),
});

export const POST = apiHandler(async ({ body }) => {
  const { kind, text } = schema.parse(body);
  const service = getAIService();
  const analysis = kind === 'resume' ? await service.analyzeResume(text) : await service.analyzeJobDescription(text);
  return ok({ kind, analysis });
}, { rateLimit: RATE_LIMITS.ai });
