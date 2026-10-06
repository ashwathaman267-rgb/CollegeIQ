#!/usr/bin/env bash
#
# CampusIQ one-shot setup:
#   .env (from template) → embedded PostgreSQL → Prisma client → migrations → seed
#
# After it finishes: `npm run dev` (or `npm run build && npm start`).
set -euo pipefail
cd "$(dirname "$0")/.."

step() { printf '\n\033[1;35m[campusiq]\033[0m %s\n' "$*"; }

# 1 ── Environment ────────────────────────────────────────────────────────
if [[ ! -f .env ]]; then
  step "Creating .env from .env.example"
  cp .env.example .env
  # Give the auth secret a real random value on first run.
  if command -v openssl >/dev/null 2>&1; then
    secret="$(openssl rand -base64 48 | tr -d '\n')"
    if sed --version >/dev/null 2>&1; then # GNU sed
      sed -i "s|^AUTH_SECRET=.*|AUTH_SECRET=\"$secret\"|" .env
    else # macOS/BSD sed
      sed -i '' "s|^AUTH_SECRET=.*|AUTH_SECRET=\"$secret\"|" .env
    fi
  fi
  echo "     Use a different DATABASE_URL in .env to point at your own PostgreSQL."
else
  step ".env already present — leaving it untouched"
fi

# 2 ── Database server ─────────────────────────────────────────────────────
if [[ "${CAMPUSIQ_EXTERNAL_DB:-0}" == "1" ]] || grep -q '^CAMPUSIQ_EXTERNAL_DB=1' .env 2>/dev/null; then
  step "CAMPUSIQ_EXTERNAL_DB=1 — expecting an external PostgreSQL, skipping embedded server"
else
  step "Starting embedded PostgreSQL (first run initialises the cluster)"
  npm run pg:start
fi

# 3 ── Prisma client ───────────────────────────────────────────────────────
step "Generating Prisma client"
npm run db:generate

# 4 ── Schema ──────────────────────────────────────────────────────────────
step "Applying migrations"
npm run db:migrate

# 5 ── Demo data ───────────────────────────────────────────────────────────
step "Seeding demo data (admin, faculty, students, timetables, results…)"
npm run db:seed

cat <<'BANNER'

──────────────────────────────────────────────────────────────
 ✔ CampusIQ is ready.

   Start the app:        npm run dev
   Then open:            http://localhost:3000

   Demo accounts:
     Admin     admin@campusiq.edu.in        / Admin@2026
     Faculty   priya.menon@campusiq.edu.in  / Faculty@2026
     Student   arjun.nair@campusiq.edu.in   / Student@2026
──────────────────────────────────────────────────────────────
BANNER
