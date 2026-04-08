# Design: Developer Experience

**Date:** 2026-04-06
**Status:** Approved
**Stack:** Next.js 16, React 19, TypeScript, Vitest, ESLint 9, GitHub Actions, NeonDB, Vercel

---

## Scope

Three targeted improvements:

1. GitHub Actions CI — lint + typecheck + test on every push/PR
2. Structured logger — replaces scattered console calls, auto-reports to Sentry
3. `.env.example` + staging guide — onboarding and staging DB documentation

Explicitly out of scope: API docs (no external consumers), E2E tests (Playwright already installed but no tests written), custom ESLint rules.

Already done: Sentry error monitoring (`src/lib/sentry.ts`, `captureServerActionError`).

---

## Part 1 — GitHub Actions CI Pipeline

**File:** `.github/workflows/ci.yml`

**Triggers:** `push` and `pull_request` on `master` branch.

**Job:** Single job `ci` on `ubuntu-latest`, Node 20, with `node_modules` cached via `actions/cache` (cache key: `package-lock.json` hash).

**Steps in order:**
1. Checkout code
2. Setup Node 20
3. Restore cache
4. `npm ci` (clean install)
5. `npm run lint` — ESLint (fast, fails early)
6. `npm run type-check` — `tsc --noEmit` (catches type errors)
7. `npm run test` — `vitest run` (13 unit tests, no DB needed)

**`package.json` additions:**
- `"type-check": "tsc --noEmit"`
- `"test": "vitest run"`

No secrets required — all existing tests are pure unit tests with no Prisma/DB calls.

---

## Part 2 — Structured Logger

**File:** `src/lib/logger.ts`

**Design:** Zero external dependencies. Works in Node.js server runtime and Edge runtime. Outputs structured JSON in production (captured by Vercel logs), pretty-printed coloured output in development.

**Interface:**
```ts
logger.info(action: string, message: string, context?: Record<string, unknown>): void
logger.warn(action: string, message: string, context?: Record<string, unknown>): void
logger.error(action: string, message: string, context?: Record<string, unknown>, error?: unknown): void
```

**Log shape (production):**
```json
{
  "level": "error",
  "action": "uploadUsersWithMapping",
  "message": "Import failed",
  "context": { "source": "csv", "rows": 42 },
  "error": "Connection timeout",
  "timestamp": "2026-04-06T10:23:45.123Z"
}
```

**Sentry integration:** `logger.error()` automatically calls `captureServerActionError(action, error, context)` when an `error` argument is provided — so errors go to both Vercel logs AND Sentry in one call. No double-instrumentation needed.

**Replace in these files:**
- `src/app/(dashboard)/admin/users/upload/actions.ts` — `console.error` in catch block
- `src/app/(dashboard)/admin/actions.ts` — `console.error`
- `src/app/(dashboard)/admin/competencies/actions.ts` — `console.warn`
- `src/app/(dashboard)/admin/cycles/[id]/actions.ts` — `console.error`
- `src/app/(dashboard)/admin/payout-config/actions.ts` — `console.error`
- `src/lib/mis-sync.ts` — `console.error` (already has Sentry, logger replaces raw console)
- `src/lib/email.ts` — `console.error` (already has Sentry)

---

## Part 3 — `.env.example` + Staging Guide

**`.env.example`** — committed to git root. Mirrors `.env.local` with all real values replaced by `<placeholder>` strings and one-line comments. Grouped into sections:

```
# ── Auth (NextAuth) ─────────────────────────────────────────────────────────
NEXTAUTH_SECRET=<generate with: openssl rand -base64 32>
NEXTAUTH_URL=http://localhost:3000

# ── Database (NeonDB + Prisma) ───────────────────────────────────────────────
DATABASE_URL=<neon pooled connection string>
DIRECT_URL=<neon direct connection string>

# ── Google OAuth ─────────────────────────────────────────────────────────────
GOOGLE_CLIENT_ID=<from Google Cloud Console>
GOOGLE_CLIENT_SECRET=<from Google Cloud Console>

# ── Email (Resend) ────────────────────────────────────────────────────────────
RESEND_API_KEY=<from resend.com>

# ── Sentry ────────────────────────────────────────────────────────────────────
NEXT_PUBLIC_SENTRY_DSN=<from sentry.io project settings>
SENTRY_ORG=<sentry org slug>
SENTRY_PROJECT=<sentry project slug>
SENTRY_AUTH_TOKEN=<from sentry.io auth tokens>

# ── App ────────────────────────────────────────────────────────────────────────
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**`docs/STAGING.md`** — short guide (not automation) for one-time staging setup:

1. NeonDB dashboard → Branches → New Branch from `main` → name `staging`
2. Copy the `staging` branch pooled + direct connection strings
3. Vercel → Project Settings → Environment Variables:
   - Add `DATABASE_URL` (staging value) → scope: **Preview** only
   - Add `DIRECT_URL` (staging value) → scope: **Preview** only
4. Every PR now gets a Vercel preview deployment pointed at the staging DB
5. Keep schema in sync: `DATABASE_URL=<staging_url> npx prisma db push`

---

## Files Created/Modified

| File | Change |
|------|--------|
| `.github/workflows/ci.yml` | New: CI pipeline |
| `package.json` | Add `type-check` and `test` scripts |
| `src/lib/logger.ts` | New: structured logger |
| `src/app/(dashboard)/admin/users/upload/actions.ts` | Replace console.error with logger |
| `src/app/(dashboard)/admin/actions.ts` | Replace console.error with logger |
| `src/app/(dashboard)/admin/competencies/actions.ts` | Replace console.warn with logger |
| `src/app/(dashboard)/admin/cycles/[id]/actions.ts` | Replace console.error with logger |
| `src/app/(dashboard)/admin/payout-config/actions.ts` | Replace console.error with logger |
| `src/lib/mis-sync.ts` | Replace console.error with logger |
| `src/lib/email.ts` | Replace console.error with logger |
| `.env.example` | New: documented env vars template |
| `docs/STAGING.md` | New: staging environment setup guide |
