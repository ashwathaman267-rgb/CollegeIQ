import 'dotenv/config';
import path from 'node:path';
import { defineConfig } from 'prisma/config';
import { PrismaPg } from '@prisma/adapter-pg';

/**
 * Prisma 6 configuration.
 *
 * CampusIQ runs the Prisma **query compiler** (`engineType = "client"` in
 * schema.prisma) together with the `pg` driver adapter. That combination needs
 * no native engine binaries at runtime, which keeps installs small and portable
 * (it also runs on serverless/edge-style Node hosts).
 *
 * `engine: 'js'` selects Prisma's WASM schema engine for the CLI so that
 * `prisma migrate diff`, `prisma generate` and friends work without downloading
 * the Rust `schema-engine` binary.
 */
const connectionString =
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@127.0.0.1:5432/campusiq?schema=public';

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  engine: 'js',
  experimental: { adapter: true },
  adapter: async () => new PrismaPg({ connectionString }),
  migrations: {
    path: path.join('prisma', 'migrations'),
    seed: 'tsx prisma/seed.ts',
  },
});
