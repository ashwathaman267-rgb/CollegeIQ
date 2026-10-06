#!/usr/bin/env node
/**
 * Thin wrapper around the Prisma CLI.
 *
 * CampusIQ uses the Rust-free configuration (`engineType = "client"` +
 * `engine: 'js'` in prisma.config.ts), so no engine binaries are ever executed.
 * The CLI nevertheless resolves engine paths up-front and tries to download them
 * from binaries.prisma.sh. On machines without that network route the download
 * fails and the command aborts before doing any work.
 *
 * Setting PRISMA_*_BINARY to an existing file short-circuits the download. This
 * wrapper creates a harmless stub and points the CLI at it, so `prisma generate`
 * and `prisma migrate diff` work fully offline. Real binaries — if present —
 * always win.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function engineStub() {
  const dir = path.join(repoRoot, 'node_modules', '.cache', 'campusiq');
  const file = path.join(dir, 'engine-stub');
  try {
    if (!fs.existsSync(file)) {
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(file, '#!/bin/sh\n# CampusIQ Prisma engine stub (never executed)\nexit 0\n');
      fs.chmodSync(file, 0o755);
    }
  } catch {
    /* fall through — the CLI will report the real error */
  }
  return file;
}

const stub = engineStub();
const env = { ...process.env };
for (const key of [
  'PRISMA_SCHEMA_ENGINE_BINARY',
  'PRISMA_QUERY_ENGINE_LIBRARY',
  'PRISMA_QUERY_ENGINE_BINARY',
]) {
  if (!env[key]) env[key] = stub;
}

const cli = path.join(repoRoot, 'node_modules', 'prisma', 'build', 'index.js');
const args = process.argv.slice(2);

const result = fs.existsSync(cli)
  ? spawnSync(process.execPath, [cli, ...args], { stdio: 'inherit', env, cwd: repoRoot })
  : spawnSync('npx', ['prisma', ...args], { stdio: 'inherit', env, cwd: repoRoot, shell: process.platform === 'win32' });

process.exit(result.status ?? 1);
