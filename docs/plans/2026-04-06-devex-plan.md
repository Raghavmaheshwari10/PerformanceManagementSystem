# Developer Experience Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add GitHub Actions CI, a structured logger that auto-reports to Sentry, and a `.env.example` + staging guide for easy onboarding.

**Architecture:** Purely additive — no logic changes to existing features. CI runs the already-passing Vitest suite. Logger wraps `captureServerActionError` (already in `src/lib/sentry.ts`). All console calls in server actions replaced in-place.

**Tech Stack:** Next.js 16, TypeScript, Vitest, ESLint 9, GitHub Actions, NeonDB, Vercel

---

## Task 1: Add `type-check` and `test` Scripts to `package.json`

**Files:**
- Modify: `package.json`

**Step 1: Open `package.json` and find the scripts section**

Current scripts block:
```json
"scripts": {
  "dev": "next dev",
  "build": "prisma generate && next build",
  "start": "next start",
  "lint": "eslint",
  "db:seed": "tsx prisma/seed.ts",
  "db:reset": "npx prisma db push --force-reset && npm run db:seed"
}
```

**Step 2: Add the two new scripts**

Replace the scripts block with:
```json
"scripts": {
  "dev": "next dev",
  "build": "prisma generate && next build",
  "start": "next start",
  "lint": "eslint",
  "type-check": "tsc --noEmit",
  "test": "vitest run",
  "db:seed": "tsx prisma/seed.ts",
  "db:reset": "npx prisma db push --force-reset && npm run db:seed"
}
```

**Step 3: Verify each script runs cleanly**

```bash
cd "C:\Users\Raghav Maheshwari\Performance-System-hRMS\.claude\worktrees\charming-bouman"
npm run type-check
npm run test
```

Expected for type-check: exits 0, zero errors.
Expected for test: `13 passed` (or similar), exits 0.

**Step 4: Commit**

```bash
git add package.json
git commit -m "chore(dx): add type-check and test scripts to package.json"
```

---

## Task 2: Create GitHub Actions CI Pipeline

**Files:**
- Create: `.github/workflows/ci.yml`

**Step 1: Create the directory and file**

```bash
mkdir -p .github/workflows
```

**Step 2: Write `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [master]
  pull_request:
    branches: [master]

jobs:
  ci:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Restore node_modules cache
        uses: actions/cache@v4
        with:
          path: ~/.npm
          key: ${{ runner.os }}-node-${{ hashFiles('package-lock.json') }}
          restore-keys: |
            ${{ runner.os }}-node-

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Type check
        run: npm run type-check

      - name: Test
        run: npm run test
```

**Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "chore(dx): add GitHub Actions CI pipeline (lint + typecheck + test)"
```

---

## Task 3: Create Structured Logger

**Files:**
- Create: `src/lib/logger.ts`

**Step 1: Write `src/lib/logger.ts`**

The logger must:
- Output JSON in production (NODE_ENV === 'production'), pretty colour output in dev
- Work in Node.js AND Edge runtimes (zero external deps)
- Auto-call `captureServerActionError` when `error` argument is provided

```typescript
import { captureServerActionError } from '@/lib/sentry'

type LogLevel = 'info' | 'warn' | 'error'

interface LogEntry {
  level: LogLevel
  action: string
  message: string
  context?: Record<string, unknown>
  error?: string
  timestamp: string
}

const isProd = process.env.NODE_ENV === 'production'

function formatError(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return String(error)
}

function emit(entry: LogEntry): void {
  if (isProd) {
    // Structured JSON for Vercel log drain
    console[entry.level](JSON.stringify(entry))
  } else {
    // Pretty output for local development
    const colour = entry.level === 'error' ? '\x1b[31m' : entry.level === 'warn' ? '\x1b[33m' : '\x1b[36m'
    const reset = '\x1b[0m'
    const prefix = `${colour}[${entry.level.toUpperCase()}]${reset} [${entry.action}]`
    const contextStr = entry.context ? ` ${JSON.stringify(entry.context)}` : ''
    const errorStr = entry.error ? ` error="${entry.error}"` : ''
    console[entry.level](`${prefix} ${entry.message}${contextStr}${errorStr}`)
  }
}

const logger = {
  info(action: string, message: string, context?: Record<string, unknown>): void {
    emit({ level: 'info', action, message, context, timestamp: new Date().toISOString() })
  },

  warn(action: string, message: string, context?: Record<string, unknown>): void {
    emit({ level: 'warn', action, message, context, timestamp: new Date().toISOString() })
  },

  error(action: string, message: string, context?: Record<string, unknown>, error?: unknown): void {
    const entry: LogEntry = {
      level: 'error',
      action,
      message,
      context,
      timestamp: new Date().toISOString(),
    }
    if (error !== undefined) {
      entry.error = formatError(error)
      // Auto-report to Sentry — one call does both Vercel logs AND Sentry
      captureServerActionError(action, error, context)
    }
    emit(entry)
  },
}

export default logger
```

**Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: zero errors.

**Step 3: Commit**

```bash
git add src/lib/logger.ts
git commit -m "feat(dx): add structured logger with Sentry auto-reporting"
```

---

## Task 4: Replace console Calls in Server Action Files

**Files:**
- Modify: `src/app/(dashboard)/admin/users/upload/actions.ts`
- Modify: `src/app/(dashboard)/admin/actions.ts`
- Modify: `src/app/(dashboard)/admin/competencies/actions.ts`

### 4a — `upload/actions.ts` (line 242)

This file already imports `captureServerActionError`. The `console.error` at line 242 is a duplicate log — just replace it with `logger.error` so it goes to Vercel logs (Sentry is already called on line 241).

**Step 1: Add logger import** (after existing imports at top of file)

Find:
```typescript
import { captureServerActionError } from '@/lib/sentry'
```

Replace with:
```typescript
import { captureServerActionError } from '@/lib/sentry'
import logger from '@/lib/logger'
```

**Step 2: Replace the console.error call** (line 242)

Find:
```typescript
      console.error(`Failed to send invite email to ${email}:`, err)
```

Replace with:
```typescript
      logger.error('uploadUsersWithMapping', `Failed to send invite email to ${email}`, { email }, err)
```

Note: Do NOT add another `captureServerActionError` call — it is already on line 241. The logger.error here only provides the Vercel log; internally it would call captureServerActionError again which is fine (Sentry deduplicates), but to be clean, since `error` arg is provided to `logger.error` it will call capture. Either approach is acceptable — the important thing is removing the raw `console.error`.

### 4b — `admin/actions.ts` (line 399)

**Step 1: Add logger import** at top of file (after last existing import)

```typescript
import logger from '@/lib/logger'
```

**Step 2: Replace the console.error** (line 399)

Find:
```typescript
    console.error('Failed to delete cycle:', e)
```

Replace with:
```typescript
    logger.error('deleteCycle', 'Failed to delete cycle', undefined, e)
```

### 4c — `competencies/actions.ts` (line 140)

**Step 1: Add logger import** at top of file

```typescript
import logger from '@/lib/logger'
```

**Step 2: Replace the console.warn** (line 140)

Find:
```typescript
    console.warn(`Cannot delete competency ${id}: used by ${usageCount} review questions`)
```

Replace with:
```typescript
    logger.warn('deleteCompetency', `Cannot delete competency: in use by ${usageCount} review questions`, { id, usageCount })
```

**Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: zero errors.

**Step 4: Commit**

```bash
git add "src/app/(dashboard)/admin/users/upload/actions.ts" \
        "src/app/(dashboard)/admin/actions.ts" \
        "src/app/(dashboard)/admin/competencies/actions.ts"
git commit -m "refactor(dx): replace console calls with structured logger in admin actions"
```

---

## Task 5: Replace console Calls in Cycles and Payout Actions

**Files:**
- Modify: `src/app/(dashboard)/admin/cycles/[id]/actions.ts`
- Modify: `src/app/(dashboard)/admin/payout-config/actions.ts`

### 5a — `cycles/[id]/actions.ts` (lines 38, 117)

Both are `.catch(console.error)` patterns on fire-and-forget notification dispatches.

**Step 1: Add logger import** at top of file

```typescript
import logger from '@/lib/logger'
```

**Step 2: Replace line 38**

Find:
```typescript
    dispatchPendingNotifications(u.id).catch(console.error)
```

Replace with:
```typescript
    dispatchPendingNotifications(u.id).catch(err => logger.error('dispatchNotifications', 'Failed to dispatch pending notifications', { userId: u.id }, err))
```

**Step 3: Replace line 117**

Find:
```typescript
    dispatchPendingNotifications(id).catch(console.error)
```

Replace with:
```typescript
    dispatchPendingNotifications(id).catch(err => logger.error('dispatchNotifications', 'Failed to dispatch pending notifications', { userId: id }, err))
```

### 5b — `payout-config/actions.ts` (line 43)

**Step 1: Add logger import** at top of file

```typescript
import logger from '@/lib/logger'
```

**Step 2: Replace line 43**

Find:
```typescript
    console.error('Audit log write failed:', e)
```

Replace with:
```typescript
    logger.error('savePayoutConfig', 'Audit log write failed', undefined, e)
```

**Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: zero errors.

**Step 4: Commit**

```bash
git add "src/app/(dashboard)/admin/cycles/[id]/actions.ts" \
        "src/app/(dashboard)/admin/payout-config/actions.ts"
git commit -m "refactor(dx): replace console calls with structured logger in cycles and payout actions"
```

---

## Task 6: Replace console Call in `email.ts`

**Files:**
- Modify: `src/lib/email.ts`

**Context:** `email.ts` already imports `captureServerActionError` from `@/lib/sentry`. There is one remaining `console.error` on line 470 — a `.catch(console.error)` on a fire-and-forget notification dispatch.

**Step 1: Add logger import** at top of file (after the existing sentry import)

Find:
```typescript
import { captureServerActionError } from '@/lib/sentry'
```

Replace with:
```typescript
import { captureServerActionError } from '@/lib/sentry'
import logger from '@/lib/logger'
```

**Step 2: Replace line 470**

Find:
```typescript
    dispatchPendingNotifications(id).catch(console.error)
```

Replace with:
```typescript
    dispatchPendingNotifications(id).catch(err => logger.error('dispatchNotifications', 'Failed to dispatch pending notifications', { userId: id }, err))
```

**Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: zero errors.

**Step 4: Commit**

```bash
git add src/lib/email.ts
git commit -m "refactor(dx): replace console call with structured logger in email.ts"
```

---

## Task 7: Create `.env.example`

**Files:**
- Create: `.env.example` (in repo root)

**Step 1: Write `.env.example`**

```bash
# ── Auth (NextAuth) ─────────────────────────────────────────────────────────
# Generate with: openssl rand -base64 32
NEXTAUTH_SECRET=<generate with: openssl rand -base64 32>
NEXTAUTH_URL=http://localhost:3000

# ── Database (NeonDB + Prisma) ───────────────────────────────────────────────
# Pooled connection string — used at runtime by the Prisma client
DATABASE_URL=<neon pooled connection string>
# Direct (non-pooled) connection string — used by Prisma for migrations
DIRECT_URL=<neon direct connection string>

# ── Google OAuth ─────────────────────────────────────────────────────────────
# From Google Cloud Console → APIs & Services → Credentials
GOOGLE_CLIENT_ID=<from Google Cloud Console>
GOOGLE_CLIENT_SECRET=<from Google Cloud Console>

# ── Email (Resend) ────────────────────────────────────────────────────────────
# From resend.com → API Keys
RESEND_API_KEY=<from resend.com>

# ── Sentry ────────────────────────────────────────────────────────────────────
# From sentry.io → Project Settings → Client Keys (DSN)
NEXT_PUBLIC_SENTRY_DSN=<from sentry.io project settings>
# From sentry.io → Organization Settings
SENTRY_ORG=<sentry org slug>
SENTRY_PROJECT=<sentry project slug>
# From sentry.io → Settings → Auth Tokens (needs project:releases scope)
SENTRY_AUTH_TOKEN=<from sentry.io auth tokens>

# ── App ────────────────────────────────────────────────────────────────────────
# Public base URL (used in email links, PDF URLs, etc.)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Step 2: Verify the file lists all vars used in the codebase**

```bash
grep -r "process\.env\." src/ --include="*.ts" --include="*.tsx" -h \
  | grep -oP 'process\.env\.\K[A-Z_]+' | sort -u
```

Compare the output against the vars in `.env.example`. All vars should be documented.

**Step 3: Commit**

```bash
git add .env.example
git commit -m "chore(dx): add .env.example with all required environment variables"
```

---

## Task 8: Create `docs/STAGING.md` + Full Build + Push

**Files:**
- Create: `docs/STAGING.md`

**Step 1: Write `docs/STAGING.md`**

```markdown
# Staging Environment Setup

This guide sets up a NeonDB staging branch wired to Vercel preview deployments. Run it once — every subsequent PR gets a preview deployment automatically pointed at staging.

## 1. Create NeonDB Staging Branch

1. Open [NeonDB Console](https://console.neon.tech) → select your project
2. Go to **Branches** → **New Branch**
3. Branch from: `main`
4. Name: `staging`
5. Click **Create Branch**
6. Copy the **pooled connection string** and **direct connection string** for the `staging` branch

## 2. Add Staging Env Vars to Vercel

1. Open [Vercel](https://vercel.com) → your project → **Settings** → **Environment Variables**
2. Add `DATABASE_URL`:
   - Value: the staging **pooled** connection string
   - Environment: **Preview** only (uncheck Production and Development)
3. Add `DIRECT_URL`:
   - Value: the staging **direct** connection string
   - Environment: **Preview** only

Every PR will now create a Vercel preview deployment that points at the staging NeonDB branch.

## 3. Keep Schema in Sync

After running `npx prisma migrate dev` on your local/production DB, push the same schema to staging:

```bash
DATABASE_URL=<staging_direct_url> npx prisma db push
```

Or use the direct connection string from your `.env.local` by temporarily overriding:

```bash
DATABASE_URL="postgresql://..." DIRECT_URL="postgresql://..." npx prisma db push
```

## 4. Seed Staging Data (Optional)

```bash
DATABASE_URL=<staging_direct_url> npm run db:seed
```
```

**Step 2: TypeScript check**

```bash
cd "C:\Users\Raghav Maheshwari\Performance-System-hRMS\.claude\worktrees\charming-bouman"
npx tsc --noEmit
```

Expected: zero errors.

**Step 3: Full build**

```bash
npx next build 2>&1 | tail -30
```

Expected: clean build, exit code 0.

**Step 4: Commit and push**

```bash
git add docs/STAGING.md
git commit -m "chore(dx): add staging environment setup guide"
git push origin claude/charming-bouman:master
```

---

## Verification Checklist

1. `npm run type-check` → zero TypeScript errors
2. `npm run test` → all tests pass
3. `npm run lint` → zero lint errors
4. `npx next build` → clean build
5. `.github/workflows/ci.yml` exists and references `npm run lint`, `npm run type-check`, `npm run test`
6. `src/lib/logger.ts` exports a default `logger` with `info`, `warn`, `error` methods
7. `logger.error(...)` with an `error` arg calls `captureServerActionError` automatically
8. Zero `console.error` / `console.warn` calls remain in the 6 server action files (upload, admin, competencies, cycles/[id], payout-config, email.ts)
9. `.env.example` covers all `process.env.*` vars used in `src/`
10. `docs/STAGING.md` exists with NeonDB branch + Vercel preview instructions
