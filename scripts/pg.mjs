#!/usr/bin/env node
/**
 * CampusIQ — embedded PostgreSQL controller.
 *
 * The project targets a real PostgreSQL server (see `DATABASE_URL`). For local
 * development and demos we ship `@embedded-postgres/linux-x64`, which provides
 * genuine PostgreSQL binaries through npm, so `npm run setup` works out of the
 * box without a system-wide install.
 *
 *   node scripts/pg.mjs start   # initdb (once) + start server + create database
 *   node scripts/pg.mjs stop
 *   node scripts/pg.mjs status
 *   node scripts/pg.mjs logs
 *
 * Set PGDATA / DATABASE_URL to point at an external server instead — in that
 * case set CAMPUSIQ_EXTERNAL_DB=1 and this script becomes a no-op.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Load .env without a dependency
function loadEnv() {
  for (const file of ['.env.local', '.env']) {
    const p = path.join(repoRoot, file);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (!m) continue;
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (process.env[m[1]] === undefined) process.env[m[1]] = v;
    }
  }
}
loadEnv();

const EXTERNAL = process.env.CAMPUSIQ_EXTERNAL_DB === '1';
const dataDir = process.env.PGDATA || path.join(repoRoot, '.data', 'pgdata');
const logFile = path.join(dataDir, 'server.log');
const pidFile = path.join(dataDir, 'postmaster.pid');

function parseUrl() {
  const raw =
    process.env.DATABASE_URL ||
    'postgresql://postgres:postgres@127.0.0.1:5432/campusiq?schema=public';
  const clean = raw.replace(/\?.*$/, '');
  const u = new URL(clean);
  return {
    user: decodeURIComponent(u.username || 'postgres'),
    password: decodeURIComponent(u.password || ''),
    host: u.hostname || '127.0.0.1',
    port: Number(u.port || 5432),
    database: u.pathname.replace(/^\//, '') || 'campusiq',
  };
}

function binaries() {
  const candidates = [
    '@embedded-postgres/linux-x64',
    '@embedded-postgres/linux-arm64',
    '@embedded-postgres/darwin-x64',
    '@embedded-postgres/darwin-arm64',
    '@embedded-postgres/windows-x64',
  ];
  for (const pkg of candidates) {
    // direct lookup — these packages use an `exports` map, so resolving
    // `<pkg>/package.json` is not possible
    const direct = path.join(repoRoot, 'node_modules', pkg, 'native', 'bin');
    if (fs.existsSync(direct)) return direct;
    try {
      let dir = path.dirname(require.resolve(pkg));
      for (let i = 0; i < 6; i += 1) {
        const bin = path.join(dir, 'native', 'bin');
        if (fs.existsSync(bin)) return bin;
        const parent = path.dirname(dir);
        if (parent === dir) break;
        dir = parent;
      }
    } catch {
      /* not installed for this platform */
    }
  }
  // fall back to a system installation
  for (const dir of ['/usr/lib/postgresql/17/bin', '/usr/lib/postgresql/16/bin', '/usr/lib/postgresql/15/bin', '/usr/bin']) {
    if (fs.existsSync(path.join(dir, 'initdb'))) return dir;
  }
  return null;
}

const cfg = parseUrl();
const bin = binaries();

function run(prog, args, opts = {}) {
  return spawnSync(path.join(bin, prog), args, { stdio: 'inherit', ...opts });
}

function isRunning() {
  if (!fs.existsSync(pidFile)) return false;
  const pid = Number(fs.readFileSync(pidFile, 'utf8').split('\n')[0]);
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function ensureDatabase() {
  // single-user mode: no psql binary is bundled with @embedded-postgres
  const res = spawnSync(
    path.join(bin, 'postgres'),
    ['--single', '-D', dataDir, 'postgres'],
    { input: `CREATE DATABASE ${cfg.database};\n`, encoding: 'utf8' },
  );
  const out = `${res.stdout || ''}${res.stderr || ''}`;
  if (res.status === 0 && !/ERROR/i.test(out)) {
    console.log(`  ✓ database "${cfg.database}" created`);
  } else if (/already exists/i.test(out)) {
    console.log(`  ✓ database "${cfg.database}" already exists`);
  } else {
    console.warn(`  ! could not create database: ${out.slice(0, 300)}`);
  }
}

/** True when the target database already exists (checked in single-user mode). */
function databaseExists() {
  const res = spawnSync(
    path.join(bin, 'postgres'),
    ['--single', '-D', dataDir, 'postgres'],
    { input: `SELECT datname FROM pg_database;\n`, encoding: 'utf8' },
  );
  return new RegExp(`\\b${cfg.database}\\b`).test(`${res.stdout || ''}`);
}

const action = process.argv[2] || 'status';

if (EXTERNAL) {
  console.log('CAMPUSIQ_EXTERNAL_DB=1 → using the PostgreSQL server at', `${cfg.host}:${cfg.port}`);
  process.exit(0);
}

if (!bin) {
  console.error(
    'No PostgreSQL binaries found. Run `npm install` (installs @embedded-postgres/*) ' +
      'or install PostgreSQL 15+ and put it on PATH.',
  );
  process.exit(1);
}

switch (action) {
  case 'start': {
    if (isRunning()) {
      console.log(`✓ PostgreSQL already running on port ${cfg.port}`);
      break;
    }
    if (!fs.existsSync(path.join(dataDir, 'PG_VERSION'))) {
      console.log(`→ initialising data directory ${dataDir}`);
      fs.mkdirSync(dataDir, { recursive: true });
      const r = run('initdb', [
        '-D', dataDir,
        '-U', cfg.user,
        '--auth=trust',
        '--auth-local=trust',
        '--auth-host=trust',
        '-E', 'UTF8',
        '--locale=C',
        '--no-sync',
      ]);
      if (r.status !== 0) process.exit(r.status ?? 1);
      ensureDatabase();
    } else if (!databaseExists()) {
      ensureDatabase();
    }
    console.log(`→ starting PostgreSQL on 127.0.0.1:${cfg.port}`);
    const r = run('pg_ctl', [
      '-D', dataDir,
      '-l', logFile,
      '-w',
      '-t', '60',
      '-o', `-p ${cfg.port} -k /tmp -c listen_addresses=127.0.0.1 -c unix_socket_directories=/tmp -c fsync=off -c synchronous_commit=off -c full_page_writes=off`,
      'start',
    ]);
    if (r.status !== 0) {
      console.error('Failed to start PostgreSQL. Log tail:');
      if (fs.existsSync(logFile)) {
        console.error(fs.readFileSync(logFile, 'utf8').split('\n').slice(-25).join('\n'));
      }
      process.exit(r.status ?? 1);
    }
    console.log(`✓ PostgreSQL ready — postgresql://${cfg.user}@127.0.0.1:${cfg.port}/${cfg.database}`);
    break;
  }
  case 'stop': {
    if (!isRunning()) {
      console.log('PostgreSQL is not running');
      break;
    }
    run('pg_ctl', ['-D', dataDir, '-m', 'fast', '-w', 'stop']);
    break;
  }
  case 'status': {
    console.log(isRunning() ? `running on port ${cfg.port}` : 'stopped');
    break;
  }
  case 'logs': {
    if (fs.existsSync(logFile)) process.stdout.write(fs.readFileSync(logFile, 'utf8'));
    else console.log('no logs yet');
    break;
  }
  case 'reset': {
    if (isRunning()) run('pg_ctl', ['-D', dataDir, '-m', 'immediate', '-w', 'stop']);
    fs.rmSync(dataDir, { recursive: true, force: true });
    console.log('data directory removed — run `npm run pg:start` to re-initialise');
    break;
  }
  default:
    console.error('usage: pg.mjs <start|stop|status|logs|reset>');
    process.exit(1);
}
