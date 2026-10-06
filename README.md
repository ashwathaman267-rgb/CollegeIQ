# CampusIQ

**Intelligent Solutions for a Smarter Campus.**

CampusIQ is a full-stack campus management web app that unifies four modules under one roof — and one login:

| Module | What it does |
| --- | --- |
| **Intelligent Attendance** | Fast per-class marking, student-wise & subject-wise dashboards, at-risk detection, monthly trends, distribution — all driven by **configurable thresholds** (safe / fine / debar). |
| **Timetable Scheduler** | Constraint-aware weekly generation (faculty, room & lab conflicts, availability, weekly periods, break protection, per-day spread) with editing, a conflict report, export and Class/Faculty/Room views. |
| **Academic Performance & Results** | IA-1/IA-2 entry and class analytics (improving / declining / needs-attention cohorts), university result-sheet upload with parsing, GPA trends and an arrear timeline. |
| **AI Resume–Job Matching** | Upload a resume, paste or upload a job description, and get a **resume-to-JD alignment score** with matched/missing skills, resume evidence and a tracked skill-gap plan. |

Built with **Next.js 14 (App Router) · TypeScript · PostgreSQL · Prisma (query-compiler + pg adapter) · Tailwind CSS · TanStack Query · Recharts · Zod**.

---

## Quick start

```bash
npm install
npm run setup     # .env → embedded PostgreSQL → migrations → seed
npm run dev       # http://localhost:3000
```

`npm run setup` is idempotent and safe to re-run. To use your own PostgreSQL instead of the bundled embedded server, set `CAMPUSIQ_EXTERNAL_DB=1` and `DATABASE_URL` in `.env` before running setup.

### Demo accounts

| Role | Email | Password |
| --- | --- | --- |
| **Admin** | `admin@campusiq.edu.in` | `Admin@2026` |
| **Faculty** | `priya.menon@campusiq.edu.in` | `Faculty@2026` |
| **Student** | `arjun.nair@campusiq.edu.in` | `Student@2026` |

The seed also creates 4 more faculty, 59 students, 4 departments, 16 subjects, 5 classes, 4 weeks of attendance, IA-1/IA-2 marks, two published university results with arrears, 4 published timetables, and sample resumes, job descriptions and match analyses.

> Re-seed any time with `npm run db:seed`. It clears CampusIQ data and rebuilds the same demo data deterministically.

---

## The four modules, in detail

### 1 · Intelligent Attendance

- **Students** see overall %, subject-wise bars with the classes needed to get back to safe, monthly trend, risk status and full history.
- **Faculty** mark in one flow: date → department → year/class → section → subject → period → student list, with *Mark all present*, per-student overrides, save, edit and undo.
- **Analytics** show subject-wise averages, monthly trend, class average, class-to-class comparison, at-risk students and the attendance distribution.
- **Thresholds are configuration, not code.** Safe ≥ 80%, fine < 75%, debarred < 70% are the defaults — change them under *Settings → Attendance thresholds* and every dashboard, badge and alert follows.

### 2 · Intelligent Timetable Scheduler

The generator places every subject's weekly periods into a working-day grid (default: 50-minute periods, 09:00–17:00, breaks 10:40–10:55 / 12:35–13:15 / 14:50–15:00 — all configurable) while respecting:

- **Hard constraints** — no faculty double-booking, no room/lab double-booking, faculty availability, lab periods contiguous.
- **Soft constraints** — max two periods of one subject per day, spread across the week, no back-to-back repeats, labs after the morning midpoint.

Publish, regenerate, hand-edit slots (conflicts re-evaluated live), inspect the conflict report, and export. Views for Class, Faculty and Room keep everyone's week in one screen.

### 3 · Academic Performance & University Results

- **IA marks**: faculty enter or upload IA-1/IA-2 marks per class & subject; the class view surfaces the average, top performers, improvers, decliners and students needing attention, with an IA-1-vs-latest trend per subject.
- **University results**: upload a result sheet (PDF/CSV/JSON) — CampusIQ extracts and matches register numbers, stores per-subject grades, computes GPA and opens arrears. If the file is unreadable it falls back to a clearly-labelled simulated extraction so analytics stay usable.
- **Arrear timeline** tracks every fail: open, attempts, cleared.

### 4 · AI Resume–Job Matching & Skill Gaps

- Upload a resume (PDF/TXT/DOC/DOCX) or paste the text; save job descriptions the same way.
- **Match** runs your resume against the posting and reports an **alignment score 0–100**:

  > ⚠️ *The score measures how closely your resume matches the wording and requirements of that specific job description. It is never a prediction of hiring, and it is displayed with that disclaimer on every report.*

- The report shows matched / partially-matched / missing skills, **quoted evidence from your resume**, a weighted score breakdown, ranked recommendations and a **skill-gap plan** you can mark *in progress* / *covered* as you learn.

#### AI architecture (provider-swappable)

All analysis goes through one contract — the frontend and API never change when the provider does:

```ts
interface AIService {
  analyzeResume(resume: string): Promise<ResumeAnalysis>;
  analyzeJobDescription(job: string): Promise<JobAnalysis>;
  matchResumeToJob(resume: string, job: string): Promise<MatchResult>;
}
```

| Provider | Status |
| --- | --- |
| `MockAIService` (built-in deterministic engine) | **Default — the app runs fully with no API key** |
| `GeminiAIService` | Enabled by setting `AI_PROVIDER=gemini` + `AI_API_KEY` |
| `OpenAIService` / custom endpoint | `AI_PROVIDER=openai` (or `custom`) + `AI_API_KEY` / `AI_API_URL` |

Cloud failures fall back to the built-in engine automatically, and the active provider is shown in the top bar. **API keys live in server environment variables only — they are never sent to the browser.**

---

## Roles & permissions

| | Student | Faculty | Admin |
| --- | --- | --- | --- |
| Own attendance / academics / results | ✅ | — | — |
| Mark attendance, enter marks, upload results, build timetables | — | ✅ | ✅ |
| View students they teach / all students | Self | Own classes | All |
| Manage students, faculty, departments, subjects, classes, rooms | — | — | ✅ |
| Analytics & audit log | — | Analytics | Both |
| Institution settings | Read | Read | Read + Write |

Authorization is enforced **in the API layer** (role guards + per-route ownership checks + a shared capability matrix the UI mirrors) — editing frontend requests can never grant access.

---

## Project structure

```
prisma/
  schema.prisma            # 40 models — people, academics, attendance,
  seed.ts                  #   timetables, results, career, files, audit
  migrations/              # deterministic init migration (applied by scripts/db.mjs)
scripts/
  setup.sh                 # .env → embedded PG → client → migrate → seed
  pg.mjs                   # embedded PostgreSQL lifecycle (init/start/stop)
  db.mjs                   # migration runner (no native engines needed)
  prisma.mjs               # prisma CLI wrapper (WASM schema engine, offline)
src/
  app/
    (auth)/                # login, register, forgot & reset password
    (app)/                 # dashboard, attendance, timetable, academics,
    api/                   #   results, career, students, faculty,
                           #   departments, subjects, classes, rooms,
                           #   analytics, audit-logs, settings, profile,
                           #   notifications + every REST endpoint
  components/              # UI kit (panels, tables, charts, dialogs, forms…),
  features/                #   app shell, auth shell
    attendance/  timetable/  academics/  results/  career/
    people/      structure/  admin/      profile/  notifications/  dashboard/
  hooks/                   # use-api (TanStack Query), use-session,
                           # use-theme, use-confirm
  lib/                     # prisma client, api client, permissions,
    ai/                    #   navigation, storage, formatting
      types.ts             #   + the AIService contract
      engine.ts            #   deterministic scoring engine
      mock.ts gemini.ts openai.ts index.ts
  server/
    api/                   # apiHandler, error envelope
    auth/                  # JWT cookie sessions, password hashing, guards
    middleware/            # sliding-window rate limiter
    services/              # attendance, timetable (+scheduler, grid),
                           #   academics, results (+result-parser), career,
                           #   people, dashboard, analytics, search,
                           #   settings, notifications, audit, auth
  types/  validations/     # shared types + zod schemas (client & server)
```

**API conventions** — every endpoint returns `{ data, meta? }` or `{ error: { status, code, message, details? } }`; writes return `201`; pagination is `page/pageSize/search/sortBy/sortDir`; auth endpoints are rate-limited.

---

## Environment

Copy `.env.example` to `.env` (or let `npm run setup` do it).

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `CAMPUSIQ_EXTERNAL_DB` | `1` = use your own Postgres instead of the embedded one |
| `AUTH_SECRET` | JWT signing secret (32+ random chars) |
| `SESSION_TTL_DAYS`, `COOKIE_SECURE` | Session lifetime & cookie security |
| `AI_PROVIDER`, `AI_API_KEY`, `AI_API_URL`, `AI_MODEL`, `AI_TIMEOUT_MS` | Optional cloud AI (mock is default) |
| `FILE_STORAGE_DRIVER`, `FILE_STORAGE_URL/KEY/BUCKET/REGION`, `UPLOAD_DIR`, `MAX_UPLOAD_MB` | Local (default) or S3-compatible object storage |
| `SMTP_*`, `MAIL_FROM`, `APP_URL` | Optional — password-reset links are logged when unset |

---

## Scripts

| Command | What it does |
| --- | --- |
| `npm run setup` | One-shot: `.env` → embedded PG → Prisma client → migrations → seed |
| `npm run dev` | Dev server on `0.0.0.0:3000` |
| `npm run build` / `npm start` | Production build / serve |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:seed` | Re-seed demo data (idempotent) |
| `npm run db:reset [--seed]` | Drop & rebuild schema |
| `npm run db:status` / `db:migrate` | Migration status / apply |
| `npm run pg:start` / `pg:stop` / `pg:status` | Embedded PostgreSQL lifecycle |

---

## Security & quality notes

- **Passwords**: bcrypt-hashed; login is rate-limited with a 15-minute lockout after 5 failures; admin unlock & one-time password resets are audited.
- **Sessions**: signed JWT in an httpOnly cookie; revocable per-session; "sign out everywhere" on password change.
- **Authorization**: enforced server-side on every route; students cannot read another student's records, faculty only their classes.
- **Uploads**: type + size validation in the browser *and* the API; stored under a traversal-safe key; results/resumes/jobs each have distinct limits.
- **No secrets in the frontend**: AI keys and storage credentials are read only from server env vars.
- **Audit log**: who, what, when, from which IP — with previous/new values for settings and structural changes.
- **Accessibility**: semantic landmarks, keyboard-operable dialogs/menus, visible focus rings, ARIA labels, status never conveyed by colour alone.
- **Responsive**: desktop sidebar, tablet icon rail, mobile top bar + bottom navigation; every table degrades to labelled cards on phones.

---

## License

MIT — use it, break it, learn from it.
