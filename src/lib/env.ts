import { z } from 'zod';

/**
 * Runtime configuration. Everything optional-with-defaults except the database
 * URL, so the application boots (and the demo AI engine works) before any
 * external API key is supplied.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  AUTH_SECRET: z.string().min(16).default('campusiq-development-secret-change-me'),
  SESSION_TTL_DAYS: z.coerce.number().int().positive().max(365).default(7),
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  APP_URL: z.string().url().default('http://localhost:3000'),
  RATE_LIMIT_PER_MIN: z.coerce.number().int().positive().default(30),

  AI_PROVIDER: z.enum(['mock', 'gemini', 'openai', 'custom']).default('mock'),
  AI_API_KEY: z.string().optional().default(''),
  AI_API_URL: z.string().optional().default(''),
  AI_MODEL: z.string().optional().default(''),
  AI_TIMEOUT_MS: z.coerce.number().int().positive().default(20000),

  FILE_STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  FILE_STORAGE_URL: z.string().optional().default(''),
  FILE_STORAGE_KEY: z.string().optional().default(''),
  FILE_STORAGE_BUCKET: z.string().optional().default(''),
  FILE_STORAGE_REGION: z.string().optional().default(''),
  UPLOAD_DIR: z.string().default('./.data/uploads'),
  MAX_UPLOAD_MB: z.coerce.number().positive().max(100).default(10),

  SMTP_HOST: z.string().optional().default(''),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASSWORD: z.string().optional().default(''),
  MAIL_FROM: z.string().default('CampusIQ <no-reply@campusiq.local>'),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

/** Parse (once) and return validated environment configuration. */
export function env(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  • ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}\n\nSee .env.example.`);
  }
  cached = parsed.data;
  return cached;
}

/** True when a real AI provider is configured (key + provider != mock). */
export function hasAiProvider(): boolean {
  const e = env();
  return e.AI_PROVIDER !== 'mock' && e.AI_API_KEY.length > 0;
}

export const isProduction = () => env().NODE_ENV === 'production';
