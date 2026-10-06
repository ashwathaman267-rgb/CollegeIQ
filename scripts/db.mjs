#!/usr/bin/env node
/**
 * CampusIQ migration runner.
 *
 * Applies the SQL files under `prisma/migrations/<name>/migration.sql` to the
 * database and records them in Prisma's own `_prisma_migrations` bookkeeping
 * table, so `prisma migrate status` / `prisma migrate deploy` stay compatible
 * wherever the native Prisma engines are available.
 *
 * Why a runner? CampusIQ ships with the Rust-free Prisma setup (query compiler
 * + `pg` driver adapter + WASM schema engine). Migration *files* are still
 * produced by the official CLI (`npm run db:create` → `prisma migrate diff`),
 * but applying them needs no engine binary at all — plain SQL over `pg`.
 *
 *   node scripts/db.mjs migrate          # apply pending migrations
 *   node scripts/db.mjs status           # show applied / pending
 *   node scripts/db.mjs create <name>    # generate a new migration from the schema
 *   node scripts/db.mjs reset [--seed]   # drop everything, re-apply, optionally seed
 */
import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const migrationsDir = path.join(repoRoot, 'prisma', 'migrations');
const connectionString =
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@127.0.0.1:5432/campusiq?schema=public';

const BOOKKEEPING_DDL = `
CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id"                  VARCHAR(36)  NOT NULL PRIMARY KEY,
    "checksum"            VARCHAR(64)  NOT NULL,
    "finished_at"         TIMESTAMPTZ,
    "migration_name"      VARCHAR(255) NOT NULL,
    "logs"                TEXT,
    "rolled_back_at"      TIMESTAMPTZ,
    "started_at"          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    "applied_steps_count" INTEGER      NOT NULL DEFAULT 0
);`;

function readMigrations() {
  if (!fs.existsSync(migrationsDir)) return [];
  return fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
    .map((d) => d.name)
    .sort()
    .map((name) => {
      const file = path.join(migrationsDir, name, 'migration.sql');
      return { name, file, exists: fs.existsSync(file) };
    })
    .filter((m) => m.exists);
}

async function connect() {
  const client = new pg.Client({ connectionString });
  await client.connect();
  return client;
}

async function ensureDatabase() {
  const url = new URL(connectionString.replace(/\?.*$/, ''));
  const target = url.pathname.replace(/^\//, '') || 'campusiq';
  const admin = new pg.Client({
    connectionString: connectionString.replace(/\/[^/?]+(\?|$)/, '/postgres$1'),
  });
  try {
    await admin.connect();
    const { rows } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [target]);
    if (rows.length === 0) {
      await admin.query(`CREATE DATABASE "${target}"`);
      console.log(`✓ created database "${target}"`);
    }
  } catch (err) {
    console.error(
      `✗ cannot reach PostgreSQL (${err.message}).\n  Start it with \`npm run pg:start\` or point DATABASE_URL at your server.`,
    );
    process.exit(1);
  } finally {
    await admin.end().catch(() => {});
  }
}

async function appliedNames(client) {
  await client.query(BOOKKEEPING_DDL);
  const { rows } = await client.query(
    'SELECT migration_name, checksum FROM "_prisma_migrations" WHERE rolled_back_at IS NULL ORDER BY migration_name',
  );
  return new Map(rows.map((r) => [r.migration_name, r.checksum]));
}

async function applyMigration(client, migration) {
  const sql = fs.readFileSync(migration.file, 'utf8');
  const checksum = crypto.createHash('sha256').update(sql).digest('hex');
  const id = crypto.randomUUID();
  const started = new Date();
  await client.query('BEGIN');
  try {
    await client.query(sql);
    await client.query(
      `INSERT INTO "_prisma_migrations"
         (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
       VALUES ($1,$2,$3,$4,$5,NULL,$6,1)`,
      [id, checksum, new Date(), migration.name, null, started],
    );
    await client.query('COMMIT');
    console.log(`  ✓ ${migration.name}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`  ✗ ${migration.name}\n    ${err.message}`);
    throw err;
  }
}

const [, , command = 'migrate', ...rest] = process.argv;

await ensureDatabase();

if (command === 'migrate' || command === 'deploy') {
  const migrations = readMigrations();
  if (migrations.length === 0) {
    console.error(
      'No migrations found in prisma/migrations.\n' +
        '  create one with:  npm run db:create -- init',
    );
    process.exit(1);
  }
  const client = await connect();
  try {
    const applied = await appliedNames(client);
    const pending = migrations.filter((m) => !applied.has(m.name));
    if (pending.length === 0) {
      console.log('✓ database schema is up to date');
    } else {
      console.log(`→ applying ${pending.length} migration(s)`);
      for (const m of pending) await applyMigration(client, m);
      console.log('✓ migrations applied');
    }
  } finally {
    await client.end();
  }
} else if (command === 'status') {
  const migrations = readMigrations();
  const client = await connect();
  try {
    const applied = await appliedNames(client);
    for (const m of migrations) {
      console.log(`${applied.has(m.name) ? '✓ applied ' : '○ pending '} ${m.name}`);
    }
    if (migrations.length === 0) console.log('(no migration files)');
  } finally {
    await client.end();
  }
} else if (command === 'reset') {
  const client = await connect();
  try {
    console.log('→ dropping schema "public"');
    await client.query('DROP SCHEMA IF EXISTS "public" CASCADE');
    await client.query('CREATE SCHEMA "public"');
    await client.query('GRANT ALL ON SCHEMA "public" TO PUBLIC');
  } finally {
    await client.end();
  }
  const migrations = readMigrations();
  const client2 = await connect();
  try {
    await client2.query(BOOKKEEPING_DDL);
    for (const m of migrations) await applyMigration(client2, m);
  } finally {
    await client2.end();
  }
  if (rest.includes('--seed')) {
    const r = spawnSync('npm', ['run', 'db:seed'], { stdio: 'inherit', cwd: repoRoot, shell: process.platform === 'win32' });
    process.exit(r.status ?? 1);
  }
  console.log('✓ reset complete');
} else if (command === 'create') {
  const name = rest[0];
  if (!name) {
    console.error('usage: node scripts/db.mjs create <migration_name>');
    process.exit(1);
  }
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  const dir = path.join(migrationsDir, `${stamp}_${name}`);
  fs.mkdirSync(dir, { recursive: true });
  const out = path.join(dir, 'migration.sql');
  const existing = readMigrations().filter((m) => !m.name.startsWith(stamp));

  const args = ['migrate', 'diff'];
  if (existing.length === 0) {
    args.push('--from-empty');
  } else {
    // Diff against the live database when it already holds the previous state.
    args.push('--from-url', connectionString);
  }
  args.push('--to-schema-datamodel', path.join(repoRoot, 'prisma', 'schema.prisma'), '--script', '--output', out);

  console.log(`→ prisma ${args.join(' ')}`);
  const r = spawnSync(process.execPath, [path.join(repoRoot, 'scripts', 'prisma.mjs'), ...args], {
    stdio: 'inherit',
    cwd: repoRoot,
  });
  if (r.status !== 0 || !fs.existsSync(out) || fs.readFileSync(out, 'utf8').trim() === '') {
    fs.rmSync(dir, { recursive: true, force: true });
    console.error(
      '\nCould not compute a diff against the live database.\n' +
        'Fall back to generating the full schema from scratch:\n' +
        `  node scripts/prisma.mjs migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script --output ${out}\n`,
    );
    process.exit(1);
  }
  console.log(`✓ created ${path.relative(repoRoot, out)}`);
} else {
  console.error('usage: db.mjs <migrate|status|create <name>|reset [--seed]>');
  process.exit(1);
}
