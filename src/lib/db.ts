import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

/**
 * Single shared Prisma client.
 *
 * CampusIQ runs Prisma's query compiler against PostgreSQL through the `pg`
 * driver adapter (no native engine binaries). In development Next.js reloads
 * modules on every edit, so the instance is cached on `globalThis` to avoid
 * exhausting the connection pool.
 */
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function connectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Copy .env.example to .env and run `npm run setup`.',
    );
  }
  return url;
}

function createPrismaClient(): PrismaClient {
  const url = connectionString();
  const schema = new URL(url.replace(/\?.*$/, '') + '?x=1').searchParams.get('schema') ?? 'public';
  const adapter = new PrismaPg({ connectionString: url, max: 12 }, { schema });

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === 'development' && process.env.PRISMA_LOG === '1'
        ? ['warn', 'error']
        : ['error'],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

