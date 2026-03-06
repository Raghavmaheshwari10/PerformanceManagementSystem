# Design: Migrate from Supabase to Local PostgreSQL + Auth.js

**Date:** 2026-03-06
**Status:** Approved
**Approach:** Layer-by-layer (3 phases)

---

## Context

The app currently uses Supabase for:
- Authentication (email/password, magic links, Google OAuth)
- Database (PostgreSQL with Row-Level Security)
- Admin operations via service role key
- 4 PL/pgSQL RPC functions
- Cookie/session management via `@supabase/ssr`

**Scope:** ~121 Supabase calls across 40 files, 14 tables, 4 RPCs.

---

## Architecture After Migration

| Layer | Before | After |
|-------|--------|-------|
| Database | Supabase hosted Postgres | Local Postgres 16 (Docker) |
| ORM | None (raw Supabase JS client) | Prisma 7 |
| Auth | Supabase Auth (JWT + custom claims) | Auth.js v5 (NextAuth) |
| Session | Supabase SSR cookie management | Auth.js JWT cookies |
| Authorization | PostgreSQL RLS policies | TypeScript role guards in server actions |
| Elevated ops | `SUPABASE_SERVICE_ROLE_KEY` client | Direct Prisma (server is trusted) |

---

## Phase 1: Local PostgreSQL + Prisma Migrations

### Goal
Get a working local database that the app can eventually point to.

### Changes
1. **`docker-compose.yml`** at repo root — Postgres 16 with volume persistence
   - `DATABASE_URL=postgresql://pms:pms@localhost:5432/pms`
2. **`prisma/schema.prisma`** — add `password_hash String?` to `User` model
3. **`prisma.config.ts`** — update to use standard URL (no NeonDB adapter for local)
4. **`.env.local`** — add `DATABASE_URL` and `DIRECT_URL` pointing to Docker
5. Run `npx prisma migrate dev --name init` to create all tables

### Success criteria
- `docker compose up -d` starts Postgres
- `npx prisma migrate dev` completes without errors
- Prisma Studio (`npx prisma studio`) shows all 15 tables

---

## Phase 2: Auth Layer (Auth.js v5)

### Goal
Replace all `supabase.auth.*` calls with Auth.js. App data still uses Supabase during this phase.

### New files
- **`src/auth.ts`** — Auth.js config:
  - `CredentialsProvider` — verify `password_hash` with bcrypt
  - `GoogleProvider` — OAuth (same Google client ID/secret)
  - `ResendProvider` — magic link via Resend (already installed)
  - JWT callback: embed `id`, `role`, `full_name` from `users` table
  - Session callback: forward JWT fields to session
- **`src/app/api/auth/[...nextauth]/route.ts`** — Auth.js route handler
- **`AUTH_SECRET`** env var — random secret for JWT signing

### Files replaced
| File | Change |
|------|--------|
| `src/lib/auth.ts` | Rewrite: `getCurrentUser()` uses `auth()` + Prisma |
| `src/lib/supabase/middleware.ts` | Delete — replaced by Auth.js `auth` middleware export |
| `middleware.ts` | Rewrite: use Auth.js `auth` export for session checks |
| `src/app/login/page.tsx` | Rewrite: call `signIn("credentials"/"google"/"resend")` |
| `src/app/auth/callback/route.ts` | Delete — Auth.js handles OAuth callbacks automatically |

### Session shape
```ts
session.user = {
  id: string        // users.id (UUID)
  email: string
  name: string      // full_name
  role: UserRole    // 'employee' | 'manager' | 'hrbp' | 'admin'
}
```

### Success criteria
- Login with email/password works
- Google OAuth redirect works
- `auth()` returns correct session in server components
- Role is available in session without extra DB call

---

## Phase 3: Data Layer (Prisma replaces all supabase.from/rpc calls)

### Goal
Replace every `supabase.from()`, `supabase.rpc()`, `supabase.auth.getUser()` data call with Prisma. Remove Supabase packages entirely at the end.

### Auth guard pattern (replaces supabase.auth.getUser in every action)
```ts
// src/lib/auth.ts — shared helpers
export async function requireAuth() {
  const session = await auth()
  if (!session?.user) redirect('/login')
  return session.user
}

export async function requireRole(roles: UserRole[]) {
  const user = await requireAuth()
  if (!roles.includes(user.role)) redirect('/unauthorized')
  return user
}
```

### RPC replacements

**`bulk_lock_appraisals(cycle_id)`** → Prisma transaction:
```ts
await prisma.$transaction(async (tx) => {
  const config = await tx.payoutConfig.findMany()
  const cycle = await tx.cycle.findUnique({ where: { id: cycleId } })
  // compute multipliers, updateMany appraisals
})
```

**`apply_kpi_template(role, cycle_id, employee_id)`** → Prisma createMany:
```ts
const templates = await prisma.kpiTemplate.findMany({ where: { role_slug: role, is_active: true } })
await prisma.kpi.createMany({ data: templates.map(t => ({ ...t, cycle_id, employee_id, manager_id })) })
```

**`resolve_feature_flag(key, user_id, role)`** → TypeScript priority logic:
```ts
// user override → role override → org override → default
```

**`bulk_update_manager_links(zimyo_ids, manager_ids)`** → Prisma updateMany per pair in transaction.

### Authorization pattern (replaces RLS)
Each server action validates role + ownership before querying. Example:
```ts
// manager can only see/edit their own employees
const session = await requireRole(['manager'])
const employee = await prisma.user.findUnique({ where: { id: employeeId } })
if (employee?.manager_id !== session.id) throw new Error('Forbidden')
```

### Files changed
- All 13 server action files — swap client creation + queries
- All ~20 page components — swap queries
- `src/lib/feature-flags.ts` — rewrite with Prisma + TypeScript RPC
- `src/app/api/payroll-export/route.ts` — rewrite query

### Files removed after Phase 3
- `src/lib/supabase/` (entire directory)
- `@supabase/ssr`, `@supabase/supabase-js` packages
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` env vars

### Success criteria
- All pages load without Supabase imports
- Full user flow works: login → dashboard → all CRUD operations
- `npm ls | grep supabase` returns nothing
- Zimyo sync works with Prisma upserts
- Manual user creation hashes password with bcrypt

---

## Environment Variables

### Remove
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

### Add
```
DATABASE_URL=postgresql://pms:pms@localhost:5432/pms
DIRECT_URL=postgresql://pms:pms@localhost:5432/pms
AUTH_SECRET=<random 32-char string>
AUTH_GOOGLE_ID=<keep existing>
AUTH_GOOGLE_SECRET=<keep existing>
AUTH_RESEND_KEY=<Resend API key>
```

---

## Dependencies

### Add
- `next-auth@5` (Auth.js v5)
- `bcryptjs` + `@types/bcryptjs`

### Remove
- `@supabase/ssr`
- `@supabase/supabase-js`

### Already present
- `prisma`, `@prisma/client`, `@prisma/adapter-neon`, `@neondatabase/serverless`
- `resend` (for magic links)

---

## Constraints & Risks

- **No data migration needed** — starting fresh with local dev DB (seed data from `00017_seed_test_data.sql`)
- **Zimyo sync preserved** — keep `triggerZimyoSync()`, just replace Supabase calls with Prisma
- **No RLS at DB level** — authorization lives entirely in TypeScript; trust the server boundary
- **Phase 2 hybrid state** — during Phase 2, auth uses Auth.js but data still uses Supabase. This is intentional and temporary.
