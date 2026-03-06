# Supabase → Local PostgreSQL + Auth.js Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace Supabase (auth + database) with local PostgreSQL (Docker), Auth.js v5, and Prisma across all 40 files.

**Architecture:** Three independent phases — Phase 1 gets local Postgres running, Phase 2 replaces auth (Supabase Auth → Auth.js), Phase 3 replaces all data queries (supabase.from/rpc → Prisma). The app stays partially functional between phases.

**Tech Stack:** Next.js 16, Prisma 7, Auth.js v5 (next-auth), bcryptjs, PostgreSQL 16 (Docker), @neondatabase/serverless (kept for NeonDB deploy target)

---

## Phase 1 — Local PostgreSQL + Prisma

### Task 1: Create docker-compose.yml

**Files:**
- Create: `docker-compose.yml`

**Step 1: Create the file**

```yaml
# docker-compose.yml
services:
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: pms
      POSTGRES_PASSWORD: pms
      POSTGRES_DB: pms
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

**Step 2: Start the container**

```bash
docker compose up -d
```

Expected: `Container pms-db-1 Started`

**Step 3: Verify it's running**

```bash
docker compose ps
```

Expected: `pms-db-1` with status `running`

**Step 4: Commit**

```bash
git add docker-compose.yml
git commit -m "feat: add Docker Compose for local PostgreSQL 16"
```

---

### Task 2: Add password_hash to Prisma schema + fix datasource

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `prisma.config.ts`

**Step 1: Update schema.prisma datasource and User model**

In `prisma/schema.prisma`, the datasource block should stay as:
```prisma
datasource db {
  provider = "postgresql"
}
```

Find the `User` model and add `password_hash` after `is_also_employee`:
```prisma
  is_also_employee Boolean @default(false)
  password_hash    String?
```

**Step 2: Update prisma.config.ts to use local Postgres**

Replace the full content of `prisma.config.ts`:
```typescript
import { defineConfig } from "prisma/config";

export default defineConfig({
  earlyAccess: true,
  schema: "prisma/schema.prisma",
});
```

> Note: For local Postgres, we don't need the NeonDB adapter — Prisma reads `DATABASE_URL` from the environment directly. The adapter is only needed for serverless/edge deploys to NeonDB.

**Step 3: Create .env.local**

Create `.env.local` (never commit this file):
```bash
# Local PostgreSQL (Docker)
DATABASE_URL="postgresql://pms:pms@localhost:5432/pms"
DIRECT_URL="postgresql://pms:pms@localhost:5432/pms"

# Auth.js (fill in after Task 7)
AUTH_SECRET="run: openssl rand -base64 32"
AUTH_GOOGLE_ID=""
AUTH_GOOGLE_SECRET=""
AUTH_RESEND_KEY=""

# Keep for now — will be removed in Phase 3
NEXT_PUBLIC_SUPABASE_URL="placeholder"
NEXT_PUBLIC_SUPABASE_ANON_KEY="placeholder"
SUPABASE_SERVICE_ROLE_KEY="placeholder"
```

**Step 4: Verify .gitignore has .env.local**

Check `cat .gitignore | grep env.local` — it should already be there from Next.js defaults. If not, add it.

**Step 5: Commit schema changes**

```bash
git add prisma/schema.prisma prisma.config.ts .env.example
git commit -m "feat(prisma): add password_hash to User, simplify prisma.config for local Postgres"
```

---

### Task 3: Run Prisma migrations and seed test data

**Files:**
- Create: `prisma/seed.ts`
- Modify: `package.json`

**Step 1: Run migration**

```bash
npx prisma migrate dev --name init
```

Expected output: `✔ Generated Prisma Client` and all 15 tables created.

If it fails with "connection refused", ensure Docker is running: `docker compose up -d`

**Step 2: Create seed file**

Create `prisma/seed.ts`:
```typescript
import { PrismaClient, UserRole } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // Departments
  const engineering = await prisma.department.upsert({
    where: { name: 'Engineering' },
    update: {},
    create: { name: 'Engineering' },
  })
  const product = await prisma.department.upsert({
    where: { name: 'Product' },
    update: {},
    create: { name: 'Product' },
  })

  // Users — matches TEST_ACCOUNTS in login page
  const adminHash = await hash('admin123', 12)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@test.com' },
    update: {},
    create: {
      zimyo_id: 'zimyo-admin',
      email: 'admin@test.com',
      full_name: 'Admin User',
      role: UserRole.admin,
      department_id: engineering.id,
      designation: 'System Administrator',
      password_hash: adminHash,
    },
  })

  const managerHash = await hash('manager123', 12)
  const manager = await prisma.user.upsert({
    where: { email: 'manager@test.com' },
    update: {},
    create: {
      zimyo_id: 'zimyo-manager',
      email: 'manager@test.com',
      full_name: 'Alice Manager',
      role: UserRole.manager,
      department_id: engineering.id,
      designation: 'Engineering Manager',
      password_hash: managerHash,
    },
  })

  const hrbpHash = await hash('hrbp123', 12)
  const hrbp = await prisma.user.upsert({
    where: { email: 'hrbp@test.com' },
    update: {},
    create: {
      zimyo_id: 'zimyo-hrbp',
      email: 'hrbp@test.com',
      full_name: 'HRBP User',
      role: UserRole.hrbp,
      department_id: product.id,
      designation: 'HR Business Partner',
      password_hash: hrbpHash,
    },
  })

  // HRBP → department mapping
  await prisma.hrbpDepartment.upsert({
    where: { hrbp_id_department_id: { hrbp_id: hrbp.id, department_id: engineering.id } },
    update: {},
    create: { hrbp_id: hrbp.id, department_id: engineering.id },
  })

  const employees = [
    { email: 'employee@test.com', password: 'employee123', name: 'Bob Employee', zimyo: 'zimyo-bob' },
    { email: 'frank@test.com',    password: 'frank123',    name: 'Frank Employee', zimyo: 'zimyo-frank' },
    { email: 'dave@test.com',     password: 'dave123',     name: 'Dave Employee', zimyo: 'zimyo-dave' },
    { email: 'eve@test.com',      password: 'eve123',      name: 'Eve Employee', zimyo: 'zimyo-eve' },
    { email: 'grace@test.com',    password: 'grace123',    name: 'Grace Employee', zimyo: 'zimyo-grace' },
    { email: 'henry@test.com',    password: 'henry123',    name: 'Henry Employee', zimyo: 'zimyo-henry' },
    { email: 'irene@test.com',    password: 'irene123',    name: 'Irene Employee', zimyo: 'zimyo-irene' },
  ]

  for (const emp of employees) {
    const h = await hash(emp.password, 12)
    await prisma.user.upsert({
      where: { email: emp.email },
      update: {},
      create: {
        zimyo_id: emp.zimyo,
        email: emp.email,
        full_name: emp.name,
        role: UserRole.employee,
        department_id: engineering.id,
        designation: 'Software Engineer',
        manager_id: manager.id,
        password_hash: h,
        variable_pay: 50000,
      },
    })
  }

  // Payout config (mirrors 00018_pms_v3.sql seed)
  const payoutData = [
    { rating_tier: 'FEE' as const, multiplier: 1.25 },
    { rating_tier: 'EE'  as const, multiplier: 1.10 },
    { rating_tier: 'ME'  as const, multiplier: 1.00 },
    { rating_tier: 'SME' as const, multiplier: 1.00 },
    { rating_tier: 'BE'  as const, multiplier: 0.00 },
  ]
  for (const p of payoutData) {
    await prisma.payoutConfig.upsert({
      where: { rating_tier: p.rating_tier },
      update: { multiplier: p.multiplier },
      create: p,
    })
  }

  // Feature flags (mirrors 00014_feature_flags.sql seed)
  const flags = [
    { key: 'module.kpi_copy_forward',    name: 'KPI Copy-Forward',      category: 'module', default_value: true,  description: 'Suggest previous cycle KPIs' },
    { key: 'module.gamification',        name: 'Gamification',          category: 'module', default_value: false, description: 'Streak counters, leaderboards' },
    { key: 'module.360_feedback',        name: '360° Feedback',         category: 'module', default_value: false, description: 'Peer nomination and feedback' },
    { key: 'module.continuous_feedback', name: 'Continuous Feedback',   category: 'module', default_value: false, description: 'Weekly pulse check-ins' },
    { key: 'module.ai_assist',           name: 'AI Review Assistant',   category: 'module', default_value: false, description: 'Claude-powered draft suggestions' },
    { key: 'ui.compact_mode',            name: 'Compact Mode',          category: 'ui',     default_value: false, description: 'Denser layout' },
    { key: 'ui.density_toggle',          name: 'Density Toggle Button', category: 'ui',     default_value: true,  description: 'Show toggle in sidebar' },
    { key: 'ui.keyboard_shortcuts',      name: 'Keyboard Shortcuts',    category: 'ui',     default_value: true,  description: 'Command palette' },
    { key: 'notify.email',               name: 'Email Notifications',   category: 'notify', default_value: true,  description: 'Send email reminders' },
    { key: 'notify.in_app',              name: 'In-App Notifications',  category: 'notify', default_value: true,  description: 'Show notification bell' },
  ]
  for (const f of flags) {
    await prisma.featureFlag.upsert({
      where: { key: f.key },
      update: {},
      create: f,
    })
  }

  console.log('✅ Seed complete')
  console.log(`   Admin: admin@test.com / admin123`)
  console.log(`   Manager: manager@test.com / manager123`)
  console.log(`   Employee: employee@test.com / employee123`)
  console.log(`   HRBP: hrbp@test.com / hrbp123`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
```

**Step 3: Add seed script to package.json**

In `package.json`, add under `"scripts"`:
```json
"db:seed": "npx tsx prisma/seed.ts",
"db:reset": "npx prisma migrate reset --force && npm run db:seed"
```

And add the `prisma` config for Prisma's built-in seed:
```json
"prisma": {
  "seed": "tsx prisma/seed.ts"
}
```

**Step 4: Install tsx (for running TypeScript seed)**

```bash
npm install --save-dev tsx
```

**Step 5: Run the seed**

```bash
npm run db:seed
```

Expected:
```
✅ Seed complete
   Admin: admin@test.com / admin123
   Manager: manager@test.com / manager123
```

**Step 6: Verify with Prisma Studio**

```bash
npx prisma studio
```

Open http://localhost:5555 — should see `users` table with 10 rows.

**Step 7: Commit**

```bash
git add prisma/seed.ts package.json package-lock.json
git commit -m "feat(db): add Prisma seed with test accounts and payout/flag data"
```

---

## Phase 2 — Auth.js v5

### Task 4: Install Auth.js and bcryptjs

**Step 1: Install packages**

```bash
npm install next-auth@beta bcryptjs
npm install --save-dev @types/bcryptjs
```

> `next-auth@beta` is Auth.js v5. The stable `next-auth` package is v4 which has different APIs.

**Step 2: Generate AUTH_SECRET**

```bash
npx auth secret
```

Copy the output into `.env.local` as `AUTH_SECRET=<value>`.

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat(auth): install next-auth@beta (Auth.js v5) and bcryptjs"
```

---

### Task 5: Create src/auth.ts (Auth.js config)

**Files:**
- Create: `src/auth.ts`
- Create: `src/types/next-auth.d.ts`

**Step 1: Create type augmentation**

Create `src/types/next-auth.d.ts`:
```typescript
import type { UserRole } from '@prisma/client'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name: string
      role: UserRole
    }
  }
  interface User {
    role: UserRole
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: UserRole
  }
}
```

**Step 2: Create src/auth.ts**

```typescript
import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import Google from 'next-auth/providers/google'
import Resend from 'next-auth/providers/resend'
import { compare } from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import type { UserRole } from '@prisma/client'

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email:    { label: 'Email',    type: 'email'    },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const email    = credentials?.email    as string | undefined
        const password = credentials?.password as string | undefined
        if (!email || !password) return null

        const user = await prisma.user.findUnique({ where: { email } })
        if (!user || !user.password_hash || !user.is_active) return null

        const valid = await compare(password, user.password_hash)
        if (!valid) return null

        return {
          id:    user.id,
          email: user.email,
          name:  user.full_name,
          role:  user.role as UserRole,
        }
      },
    }),

    Google({
      clientId:     process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    }),

    Resend({
      apiKey: process.env.AUTH_RESEND_KEY!,
      from:   'noreply@pms.yourdomain.com',
    }),
  ],

  callbacks: {
    async signIn({ user, account }) {
      // Google OAuth: user must already exist in users table
      if (account?.provider === 'google') {
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email! },
        })
        if (!dbUser || !dbUser.is_active) {
          return '/login?error=not_provisioned'
        }
        // Inject role for JWT callback
        user.role = dbUser.role as UserRole
      }
      return true
    },

    async jwt({ token, user }) {
      if (user) {
        token.id   = user.id
        token.role = user.role
      }
      return token
    },

    async session({ session, token }) {
      session.user.id   = token.id
      session.user.role = token.role
      return session
    },
  },

  pages: {
    signIn: '/login',
    error:  '/login',
  },
})
```

**Step 3: Commit**

```bash
git add src/auth.ts src/types/next-auth.d.ts
git commit -m "feat(auth): add Auth.js v5 config with Credentials, Google, Resend providers"
```

---

### Task 6: Create Auth.js route handler and middleware

**Files:**
- Create: `src/app/api/auth/[...nextauth]/route.ts`
- Create: `middleware.ts`

**Step 1: Create route handler**

Create `src/app/api/auth/[...nextauth]/route.ts`:
```typescript
import { handlers } from '@/auth'
export const { GET, POST } = handlers
```

**Step 2: Create middleware.ts** (at repo root, same location as old one)

```typescript
export { auth as middleware } from '@/auth'

export const config = {
  // Protect all routes except: auth API, static files, login page
  matcher: [
    '/((?!api/auth|_next/static|_next/image|favicon\\.ico|login|unauthorized).*)',
  ],
}
```

**Step 3: Commit**

```bash
git add src/app/api/auth middleware.ts
git commit -m "feat(auth): add Auth.js route handler and middleware"
```

---

### Task 7: Rewrite src/lib/auth.ts

**Files:**
- Modify: `src/lib/auth.ts`

Replace the entire file:
```typescript
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import type { UserRole } from '@prisma/client'

// Full DB user type — use this when you need all user fields
export type AppUser = Awaited<ReturnType<typeof getCurrentUser>>

/**
 * Returns the full user record from DB.
 * Redirects to /login if not authenticated.
 */
export async function getCurrentUser() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  })
  if (!user || !user.is_active) redirect('/login')
  return user
}

/**
 * Returns the current user and verifies they have one of the allowed roles.
 * Redirects to /unauthorized otherwise.
 */
export async function requireRole(allowedRoles: UserRole[]) {
  const user = await getCurrentUser()
  if (!allowedRoles.includes(user.role)) {
    redirect('/unauthorized')
  }
  return user
}

/** Pure testable check — returns true if managerId matches the user's id. */
export function checkManagerOwnership(userId: string, managerId: string): boolean {
  return userId === managerId
}

/**
 * DB-backed ownership check. Fetches the employee and verifies the given managerId
 * owns that record. Redirects to /unauthorized on failure.
 */
export async function requireManagerOwnership(employeeId: string, managerId: string): Promise<void> {
  const employee = await prisma.user.findUnique({
    where: { id: employeeId },
    select: { manager_id: true },
  })
  if (!employee || employee.manager_id !== managerId) {
    redirect('/unauthorized')
  }
}

export function getRoleDashboardPath(role: UserRole): string {
  switch (role) {
    case 'employee': return '/employee'
    case 'manager':  return '/manager'
    case 'hrbp':     return '/hrbp'
    case 'admin':    return '/admin'
  }
}
```

**Verify it compiles:**
```bash
npx tsc --noEmit
```

Expected: no errors related to `src/lib/auth.ts`

**Commit:**
```bash
git add src/lib/auth.ts
git commit -m "feat(auth): rewrite auth.ts to use Auth.js session instead of Supabase"
```

---

### Task 8: Rewrite login page

**Files:**
- Modify: `src/app/login/page.tsx`
- Delete: `src/app/auth/callback/route.ts`

**Step 1: Replace login page auth calls**

The login page is `'use client'`. Replace only the three auth handler functions (keep all the CSS and JSX exactly as-is):

```typescript
// At top of file, replace supabase import:
import { signIn } from 'next-auth/react'
// Remove: import { createClient } from '@/lib/supabase/client'
```

Replace `handlePasswordLogin`:
```typescript
async function handlePasswordLogin(e: React.FormEvent) {
  e.preventDefault()
  setLoading(true); setMessage(''); setIsError(false)
  const result = await signIn('credentials', {
    email,
    password,
    redirect: false,
  })
  if (result?.error) {
    setMessage('Invalid email or password.')
    setIsError(true)
    setLoading(false)
    return
  }
  // Let middleware handle the redirect to role-specific dashboard
  window.location.href = '/'
}
```

Replace `handleMagicLink`:
```typescript
async function handleMagicLink() {
  if (!email) { setMessage('Enter your email first.'); setIsError(true); return }
  setLoading(true); setIsError(false)
  const result = await signIn('resend', { email, redirect: false })
  setMessage(result?.error ? result.error : 'Check your inbox for the login link.')
  setIsError(!!result?.error)
  setLoading(false)
}
```

Replace `handleGoogleLogin`:
```typescript
async function handleGoogleLogin() {
  setLoading(true)
  await signIn('google', { callbackUrl: '/' })
}
```

**Step 2: Delete callback route (Auth.js handles it)**

```bash
rm src/app/auth/callback/route.ts
```

**Step 3: Update page.tsx route**

The home page `src/app/page.tsx` calls `getCurrentUser()`. Since we rewrote that, it should still work. Verify it compiles:
```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/app/login/page.tsx
git rm src/app/auth/callback/route.ts
git commit -m "feat(auth): rewrite login page to use Auth.js signIn, remove Supabase callback route"
```

---

### Task 9: Remove Supabase client files and verify Phase 2 builds

**Files:**
- Delete: `src/lib/supabase/client.ts`
- Delete: `src/lib/supabase/server.ts`
- Delete: `src/lib/supabase/middleware.ts` (if it exists)

> **Note:** Only delete these once Phase 3 (all data queries) is complete. At this point in Phase 2, keep `server.ts` and `client.ts` — they're still needed by the data-layer code. This task is a placeholder to be completed at the end of Phase 3.

**Commit Phase 2 completion:**
```bash
git commit --allow-empty -m "chore: Phase 2 (Auth.js) complete — auth no longer uses Supabase"
```

---

## Phase 3 — Prisma Data Layer

> Pattern for EVERY server action:
> 1. Replace `const supabase = await createClient()` / `createServiceClient()` with `import { prisma } from '@/lib/prisma'`
> 2. Replace `supabase.auth.getUser()` with `await requireRole([...])` from `@/lib/auth`
> 3. Replace `supabase.from('table').select/insert/update/delete` with `prisma.model.findMany/create/update/delete`
> 4. Replace `supabase.rpc('...')` with the TypeScript equivalent (see Tasks 11-14)

### Task 10: Create shared RPC replacements in src/lib/db/

**Files:**
- Create: `src/lib/db/feature-flags.ts`
- Create: `src/lib/db/appraisals.ts`
- Create: `src/lib/db/kpi-templates.ts`

**Step 1: Create feature flag resolver**

Create `src/lib/db/feature-flags.ts`:
```typescript
import { prisma } from '@/lib/prisma'

/**
 * Resolves a feature flag with priority: user > role > org > default.
 * Replaces the resolve_feature_flag() PL/pgSQL RPC.
 */
export async function resolveFeatureFlag(
  key: string,
  userId: string,
  role: string
): Promise<boolean> {
  const flag = await prisma.featureFlag.findUnique({ where: { key } })
  if (!flag) return false

  // User-level override (highest priority)
  const userOverride = await prisma.featureFlagOverride.findFirst({
    where: { flag_key: key, scope: 'user', scope_id: userId },
  })
  if (userOverride) return userOverride.value

  // Role-level override
  const roleOverride = await prisma.featureFlagOverride.findFirst({
    where: { flag_key: key, scope: 'role', scope_id: role },
  })
  if (roleOverride) return roleOverride.value

  // Org-level override
  const orgOverride = await prisma.featureFlagOverride.findFirst({
    where: { flag_key: key, scope: 'org', scope_id: null },
  })
  if (orgOverride) return orgOverride.value

  return flag.default_value
}
```

**Step 2: Create bulk appraisal lock**

Create `src/lib/db/appraisals.ts`:
```typescript
import { prisma } from '@/lib/prisma'
import type { RatingTier } from '@prisma/client'

/**
 * Locks all non-final appraisals in a cycle, computing payout amounts.
 * Replaces the bulk_lock_appraisals() PL/pgSQL RPC.
 */
export async function bulkLockAppraisals(cycleId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const cycle = await tx.cycle.findUniqueOrThrow({ where: { id: cycleId } })
    const configs = await tx.payoutConfig.findMany()
    const configMap = Object.fromEntries(
      configs.map(c => [c.rating_tier, Number(c.multiplier)])
    )

    const feeMultiplier = Number(cycle.fee_multiplier ?? configMap['FEE'] ?? 1.25)
    const eeMultiplier  = Number(cycle.ee_multiplier  ?? configMap['EE']  ?? 1.10)
    const meMultiplier  = Number(cycle.me_multiplier  ?? configMap['ME']  ?? 1.00)
    const smeBase       = Number(configMap['SME'] ?? 1.00)
    const smeExtra      = Number(cycle.sme_multiplier ?? 0)
    const bizMultiplier = Number(cycle.business_multiplier ?? 1.0)

    // Lock non-final rows with a rating
    const appraisals = await tx.appraisal.findMany({
      where: {
        cycle_id: cycleId,
        is_final: false,
        OR: [
          { final_rating: { not: null } },
          { manager_rating: { not: null } },
        ],
      },
    })

    for (const a of appraisals) {
      const effectiveRating = (a.final_rating ?? a.manager_rating) as RatingTier | null
      if (!effectiveRating) continue

      const ratioMap: Record<RatingTier, number> = {
        FEE: feeMultiplier,
        EE:  eeMultiplier,
        ME:  meMultiplier,
        SME: smeBase + smeExtra,
        BE:  0,
      }
      const ratio = ratioMap[effectiveRating] ?? 0
      const payoutMultiplier = ratio * bizMultiplier
      const varPay = Number(a.snapshotted_variable_pay ?? 0)

      await tx.appraisal.update({
        where: { id: a.id },
        data: {
          final_rating:      effectiveRating,
          payout_multiplier: payoutMultiplier,
          payout_amount:     varPay * payoutMultiplier,
          locked_at:         new Date(),
        },
      })
    }

    // Lock final (HRBP-overridden) rows — just set locked_at
    await tx.appraisal.updateMany({
      where: { cycle_id: cycleId, is_final: true, locked_at: null },
      data: { locked_at: new Date() },
    })
  })
}
```

**Step 3: Create KPI template applier**

Create `src/lib/db/kpi-templates.ts`:
```typescript
import { prisma } from '@/lib/prisma'

/**
 * Creates KPIs for an employee from a role template.
 * Replaces the apply_kpi_template() PL/pgSQL RPC.
 */
export async function applyKpiTemplate(
  roleSlug: string,
  cycleId: string,
  employeeId: string
): Promise<void> {
  const employee = await prisma.user.findUnique({ where: { id: employeeId } })
  if (!employee?.manager_id) {
    throw new Error(`Employee ${employeeId} has no manager assigned`)
  }

  const templates = await prisma.kpiTemplate.findMany({
    where: { role_slug: roleSlug, is_active: true },
    orderBy: { sort_order: 'asc' },
  })

  for (const t of templates) {
    // Skip silently if a KPI with the same title already exists for this employee+cycle
    const existing = await prisma.kpi.findFirst({
      where: { cycle_id: cycleId, employee_id: employeeId, title: t.title },
    })
    if (existing) continue

    await prisma.kpi.create({
      data: {
        cycle_id:    cycleId,
        employee_id: employeeId,
        manager_id:  employee.manager_id,
        title:       t.title,
        description: t.description,
        weight:      t.weight,
      },
    })
  }
}
```

**Step 4: Commit**

```bash
git add src/lib/db/
git commit -m "feat(db): add TypeScript replacements for bulk_lock_appraisals, apply_kpi_template, resolve_feature_flag RPCs"
```

---

### Task 11: Rewrite src/lib/feature-flags.ts

**Files:**
- Modify: `src/lib/feature-flags.ts`

Replace the full file:
```typescript
import { prisma } from '@/lib/prisma'
import { resolveFeatureFlag } from '@/lib/db/feature-flags'

export type FeatureFlags = Record<string, boolean>

export async function getFeatureFlags(userId: string, role: string): Promise<FeatureFlags> {
  const flags = await prisma.featureFlag.findMany({ select: { key: true } })
  const entries = await Promise.all(
    flags.map(async ({ key }) => {
      const value = await resolveFeatureFlag(key, userId, role)
      return [key, value] as [string, boolean]
    })
  )
  return Object.fromEntries(entries)
}

export async function getFlag(key: string, userId: string, role: string): Promise<boolean> {
  return resolveFeatureFlag(key, userId, role)
}
```

**Commit:**
```bash
git add src/lib/feature-flags.ts
git commit -m "feat(db): rewrite feature-flags.ts to use Prisma + TypeScript RPC replacement"
```

---

### Task 12: Rewrite drafts and notifications actions

**Files:**
- Modify: `src/app/(dashboard)/actions/drafts.ts`
- Modify: `src/app/(dashboard)/actions/notifications.ts`

**Step 1: Rewrite drafts.ts**

```typescript
'use server'

import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'

type EntityType = 'self_review' | 'manager_review' | 'kpi' | 'check_in'

export async function saveDraft(
  entityType: EntityType,
  entityId: string | null,
  formData: Record<string, unknown>
) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')
  const userId = session.user.id

  await prisma.draft.upsert({
    where: {
      user_id_entity_type_entity_id: {
        user_id: userId,
        entity_type: entityType,
        entity_id: entityId ?? '',
      },
    },
    update: { form_data: formData, updated_at: new Date() },
    create: {
      user_id:     userId,
      entity_type: entityType,
      entity_id:   entityId ?? undefined,
      form_data:   formData,
    },
  })
}

export async function loadDraft(
  entityType: EntityType,
  entityId: string | null
): Promise<Record<string, unknown> | null> {
  const session = await auth()
  if (!session?.user?.id) return null

  const draft = await prisma.draft.findFirst({
    where: {
      user_id:     session.user.id,
      entity_type: entityType,
      entity_id:   entityId ?? undefined,
    },
  })
  return draft ? (draft.form_data as Record<string, unknown>) : null
}

export async function clearDraft(entityType: EntityType, entityId: string | null) {
  const session = await auth()
  if (!session?.user?.id) return

  await prisma.draft.deleteMany({
    where: {
      user_id:     session.user.id,
      entity_type: entityType,
      entity_id:   entityId ?? undefined,
    },
  })
}
```

**Step 2: Rewrite notifications.ts**

Read the current file first, then replace `supabase.auth.getUser()` with `auth()` and `.from('notifications')` calls with `prisma.notification.*`:

```typescript
'use server'

import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'

export async function snoozeNotification(id: string, until: Date) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  await prisma.notification.update({
    where: { id, recipient_id: session.user.id }, // ownership check
    data: { snoozed_until: until },
  })
}

export async function dismissNotification(id: string) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  await prisma.notification.update({
    where: { id, recipient_id: session.user.id },
    data: { dismissed_at: new Date() },
  })
}

export async function markAllNotificationsRead() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  await prisma.notification.updateMany({
    where: { recipient_id: session.user.id, dismissed_at: null },
    data:  { dismissed_at: new Date() },
  })
}
```

**Commit:**
```bash
git add src/app/(dashboard)/actions/
git commit -m "feat(db): rewrite drafts and notifications actions to use Prisma"
```

---

### Task 13: Rewrite employee actions

**Files:**
- Modify: `src/app/(dashboard)/employee/actions.ts`

Read the current file to understand the structure. The pattern is:
1. Replace `requireRole(['employee'])` — this already uses our new `requireRole` from `@/lib/auth`
2. Replace `supabase.from('reviews').upsert(...)` with `prisma.review.upsert(...)`
3. Replace `supabase.from('cycles').select(...)` with `prisma.cycle.findUnique(...)`
4. Replace `supabase.from('notifications').insert(...)` with `prisma.notification.create(...)`
5. Replace `supabase.from('audit_logs').insert(...)` with `prisma.auditLog.create(...)`
6. Remove `createServiceClient()` — just use `prisma` directly

Key Prisma equivalents:
```typescript
// supabase.from('cycles').select('*').eq('id', cycleId).single()
await prisma.cycle.findUnique({ where: { id: cycleId } })

// supabase.from('reviews').upsert({ cycle_id, employee_id, ... }, { onConflict: 'cycle_id,employee_id' })
await prisma.review.upsert({
  where: { cycle_id_employee_id: { cycle_id, employee_id } },
  update: { self_rating, self_comments, status: 'submitted', submitted_at: new Date() },
  create: { cycle_id, employee_id, self_rating, self_comments, status: 'submitted', submitted_at: new Date() },
})

// supabase.from('notifications').insert({ recipient_id, type, payload })
await prisma.notification.create({
  data: { recipient_id, type, payload }
})

// supabase.from('audit_logs').insert({ cycle_id, changed_by, action, entity_type, entity_id, ... })
await prisma.auditLog.create({
  data: { cycle_id, changed_by, action, entity_type, entity_id, old_value, new_value }
})
```

**Commit:**
```bash
git add src/app/(dashboard)/employee/actions.ts
git commit -m "feat(db): rewrite employee actions to use Prisma"
```

---

### Task 14: Rewrite manager actions

**Files:**
- Modify: `src/app/(dashboard)/manager/actions.ts`
- Modify: `src/app/(dashboard)/manager/template-actions.ts`

For `template-actions.ts`, replace `supabase.rpc('apply_kpi_template', ...)`:
```typescript
import { applyKpiTemplate } from '@/lib/db/kpi-templates'
// Replace: await supabase.rpc('apply_kpi_template', { p_role_slug, p_cycle_id, p_employee_id })
await applyKpiTemplate(roleSlug, cycleId, employeeId)
```

For `manager/actions.ts`:
```typescript
// supabase.from('kpis').insert({...})
await prisma.kpi.create({ data: { cycle_id, employee_id, manager_id, title, description, weight } })

// supabase.from('kpis').delete().eq('id', kpiId)
await prisma.kpi.delete({ where: { id: kpiId } })

// supabase.from('appraisals').upsert({...}, { onConflict: 'cycle_id,employee_id' })
await prisma.appraisal.upsert({
  where: { cycle_id_employee_id: { cycle_id, employee_id } },
  update: { manager_rating, manager_comments, manager_submitted_at: new Date(), updated_at: new Date() },
  create: { cycle_id, employee_id, manager_id, manager_rating, manager_comments, manager_submitted_at: new Date() },
})
```

**Commit:**
```bash
git add src/app/(dashboard)/manager/
git commit -m "feat(db): rewrite manager actions to use Prisma (including apply_kpi_template RPC)"
```

---

### Task 15: Rewrite HRBP actions

**Files:**
- Modify: `src/app/(dashboard)/hrbp/actions.ts`
- Modify: `src/app/(dashboard)/hrbp/my-review/actions.ts`

Key replacement for `lockCycle`:
```typescript
// Replace: await supabase.rpc('bulk_lock_appraisals', { p_cycle_id: cycleId })
import { bulkLockAppraisals } from '@/lib/db/appraisals'
await bulkLockAppraisals(cycleId)
```

For `overrideRating`, replace the appraisal update:
```typescript
await prisma.appraisal.update({
  where: { cycle_id_employee_id: { cycle_id, employee_id } },
  data: {
    final_rating:         newRating,
    final_rating_set_by:  currentUser.id,
    payout_multiplier:    payoutMultiplier,
    payout_amount:        payoutAmount,
    is_final:             true,
  },
})
```

**Commit:**
```bash
git add src/app/(dashboard)/hrbp/
git commit -m "feat(db): rewrite HRBP actions to use Prisma (including bulk_lock_appraisals RPC)"
```

---

### Task 16: Rewrite admin actions

**Files:**
- Modify: `src/app/(dashboard)/admin/actions.ts`
- Modify: `src/app/(dashboard)/admin/cycles/[id]/actions.ts`

For `createCycle`:
```typescript
await prisma.cycle.create({
  data: {
    name, quarter, year, status: 'draft',
    sme_multiplier, business_multiplier, fee_multiplier, ee_multiplier, me_multiplier,
    created_by: currentUser.id,
  },
})
```

For `advanceCycleStatus`:
```typescript
await prisma.cycle.update({
  where: { id: cycleId },
  data: { status: nextStatus, updated_at: new Date() },
})
```

For reminder actions (`sendSelfReviewReminders`, `sendManagerReviewReminders`):
```typescript
// Find employees without submitted reviews
const usersWithoutReview = await prisma.user.findMany({
  where: {
    is_active: true,
    role: 'employee',
    reviews: {
      none: { cycle_id: cycleId, status: 'submitted' },
    },
  },
})

// Insert notifications
await prisma.notification.createMany({
  data: usersWithoutReview.map(u => ({
    recipient_id: u.id,
    type: 'review_reminder',
    payload: { cycle_id: cycleId },
  })),
})
```

**Commit:**
```bash
git add src/app/(dashboard)/admin/actions.ts src/app/(dashboard)/admin/cycles/
git commit -m "feat(db): rewrite admin cycle actions to use Prisma"
```

---

### Task 17: Rewrite admin user/department/kpi-template/notifications/payout actions

**Files:**
- Modify: `src/app/(dashboard)/admin/users/actions.ts`
- Modify: `src/app/(dashboard)/admin/departments/actions.ts`
- Modify: `src/app/(dashboard)/admin/kpi-templates/actions.ts`
- Modify: `src/app/(dashboard)/admin/notifications/actions.ts`
- Modify: `src/app/(dashboard)/admin/payout-config/actions.ts`
- Modify: `src/app/(dashboard)/admin/feature-flags/actions.ts`

**admin/users/actions.ts — Zimyo sync:**
Replace `supabase.rpc('bulk_update_manager_links', ...)` with a Prisma transaction:
```typescript
// bulk_update_manager_links replacement
await prisma.$transaction(
  zimyoIds.map((zimyoId, i) =>
    prisma.user.update({
      where: { zimyo_id: zimyoId },
      data: { manager_id: managerIds[i] },
    })
  )
)
```

Replace `svc.auth.admin.createUser()` with bcrypt hash + prisma insert:
```typescript
import { hash } from 'bcryptjs'

const password_hash = await hash(temporaryPassword, 12)
await prisma.user.create({
  data: { email, full_name, role, department_id, designation, zimyo_id: email, password_hash },
})
// Send invite email via Resend (existing resend import)
```

**admin/departments/actions.ts:**
```typescript
// createDepartment
await prisma.department.create({ data: { name } })

// renameDepartment
await prisma.department.update({ where: { id }, data: { name } })

// deleteDepartment — check user count first
const count = await prisma.user.count({ where: { department_id: id } })
if (count > 0) throw new Error('Department has users')
await prisma.department.delete({ where: { id } })
```

**admin/kpi-templates/actions.ts:**
```typescript
await prisma.kpiTemplate.create({ data: { role_slug, title, description, unit, target, weight, category, sort_order } })
await prisma.kpiTemplate.update({ where: { id }, data: { ... } })
await prisma.kpiTemplate.update({ where: { id }, data: { is_active: !current.is_active } })
```

**admin/payout-config/actions.ts:**
```typescript
await prisma.payoutConfig.update({
  where: { rating_tier },
  data: { multiplier, updated_by: currentUser.id, updated_at: new Date() },
})
```

**admin/feature-flags/actions.ts:**
```typescript
await prisma.featureFlagOverride.upsert({
  where: { flag_key_scope_scope_id: { flag_key: key, scope, scope_id: scopeId ?? '' } },
  update: { value, updated_by: currentUser.id, updated_at: new Date() },
  create: { flag_key: key, scope, scope_id: scopeId, value, updated_by: currentUser.id },
})
```

**Commit:**
```bash
git add src/app/(dashboard)/admin/
git commit -m "feat(db): rewrite all admin actions to use Prisma (users, departments, kpis, notifications, payout, flags)"
```

---

### Task 18: Rewrite payroll export API route

**Files:**
- Modify: `src/app/api/payroll-export/route.ts`

```typescript
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user || !['hrbp', 'admin'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const cycleId = searchParams.get('cycle_id')
  if (!cycleId) return NextResponse.json({ error: 'cycle_id required' }, { status: 400 })

  const cycle = await prisma.cycle.findUnique({ where: { id: cycleId } })
  if (!cycle || !['locked', 'published'].includes(cycle.status)) {
    return NextResponse.json({ error: 'Cycle not locked or published' }, { status: 400 })
  }

  const appraisals = await prisma.appraisal.findMany({
    where: { cycle_id: cycleId },
    include: {
      employee: {
        include: { department: true },
      },
    },
  })

  const rows = [
    ['Employee ID', 'Name', 'Department', 'Rating', 'Variable Pay', 'Payout Multiplier', 'Payout Amount'].join(','),
    ...appraisals.map(a => [
      a.employee.zimyo_id,
      `"${a.employee.full_name}"`,
      `"${a.employee.department?.name ?? ''}"`,
      a.final_rating ?? '',
      a.snapshotted_variable_pay ?? '',
      a.payout_multiplier ?? '',
      a.payout_amount ?? '',
    ].join(',')),
  ]

  return new NextResponse(rows.join('\n'), {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="payroll-${cycleId}.csv"`,
    },
  })
}
```

**Commit:**
```bash
git add src/app/api/payroll-export/route.ts
git commit -m "feat(db): rewrite payroll export API to use Prisma"
```

---

### Task 19: Rewrite all page components (data fetching)

**Files (~20 pages):**
All pages in `src/app/(dashboard)/` that call `supabase.from(...)`.

These pages are Server Components that fetch data. The pattern is the same in each:

```typescript
// Before
const supabase = await createClient()
const { data: cycles } = await supabase.from('cycles').select('*').order('created_at', { ascending: false })

// After
import { prisma } from '@/lib/prisma'
const cycles = await prisma.cycle.findMany({ orderBy: { created_at: 'desc' } })
```

Common patterns to search-replace:

| Supabase | Prisma |
|----------|--------|
| `.from('cycles').select('*')` | `prisma.cycle.findMany()` |
| `.from('users').select('*').eq('is_active', true)` | `prisma.user.findMany({ where: { is_active: true } })` |
| `.from('appraisals').select('*, employee:users(*)').eq('cycle_id', id)` | `prisma.appraisal.findMany({ where: { cycle_id: id }, include: { employee: true } })` |
| `.single()` → `{ data }` | `prisma.model.findUnique({ where: { id } })` |
| `.order('created_at', { ascending: false })` | `orderBy: { created_at: 'desc' }` |
| `.eq('id', id)` | `where: { id }` |

Work through files in this order (simpler first):
1. `admin/departments/page.tsx`
2. `admin/kpi-templates/page.tsx`
3. `admin/payout-config/page.tsx`
4. `admin/notifications/page.tsx`
5. `admin/users/page.tsx`
6. `admin/users/[id]/edit/page.tsx`
7. `admin/users/new/page.tsx`
8. `admin/cycles/page.tsx`
9. `admin/cycles/[id]/page.tsx`
10. `admin/kpi-templates/[id]/edit/page.tsx`
11. `employee/page.tsx`
12. `employee/history/page.tsx`
13. `manager/page.tsx`
14. `manager/[employeeId]/kpis/page.tsx`
15. `manager/[employeeId]/review/page.tsx`
16. `hrbp/page.tsx`
17. `hrbp/calibration/page.tsx`
18. `hrbp/my-review/page.tsx`

Commit each dashboard section separately:
```bash
git add src/app/(dashboard)/admin/
git commit -m "feat(db): rewrite admin page components to use Prisma"

git add src/app/(dashboard)/employee/ src/app/(dashboard)/manager/ src/app/(dashboard)/hrbp/
git commit -m "feat(db): rewrite employee/manager/hrbp page components to use Prisma"
```

---

### Task 20: Remove Supabase packages and clean up

**Files:**
- Delete: `src/lib/supabase/client.ts`
- Delete: `src/lib/supabase/server.ts`
- Delete: `src/lib/supabase/middleware.ts` (if exists)
- Modify: `package.json`

**Step 1: Verify no remaining Supabase imports**

```bash
grep -r "supabase" src/ --include="*.ts" --include="*.tsx" -l
```

Expected: no output. If files are listed, fix them before continuing.

**Step 2: Delete Supabase client files**

```bash
rm src/lib/supabase/client.ts src/lib/supabase/server.ts
rmdir src/lib/supabase 2>/dev/null || true
```

**Step 3: Uninstall Supabase packages**

```bash
npm uninstall @supabase/ssr @supabase/supabase-js
```

**Step 4: Remove Supabase env vars from .env.local and .env.example**

Remove from `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Update `.env.example` to remove those three lines.

**Step 5: Run full build to confirm clean**

```bash
npm run build
```

Expected: Build succeeds with no TypeScript or import errors.

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: remove Supabase entirely — migration to Prisma + Auth.js complete

- Remove @supabase/ssr and @supabase/supabase-js packages
- Delete src/lib/supabase/ directory
- Remove Supabase environment variables
- All 40 files now use Prisma + Auth.js"
```

---

## Final Verification

### Task 21: End-to-end smoke test

**Step 1: Start local Postgres and app**
```bash
docker compose up -d
npm run dev
```

**Step 2: Test login flows**

Open http://localhost:3000/login

- Click "Admin" pill → Sign In → should land on `/admin`
- Click "Alice" (manager) → Sign In → should land on `/manager`
- Click "Bob" (employee) → Sign In → should land on `/employee`
- Click "HRBP" → Sign In → should land on `/hrbp`

**Step 3: Test core flows**

As Admin:
- Create a cycle (Admin → Cycles → New)
- Create a department
- Advance cycle to `kpi_setting`

As Manager:
- Add a KPI for an employee

As Employee:
- See the KPI on dashboard (after cycle advances to `self_review`)
- Submit self-review

As HRBP:
- See employees in calibration
- Lock cycle

**Step 4: If any page fails**

Check browser console and server logs. Most errors will be:
- Missing `where` clause — add correct unique constraint name from schema
- Missing `include` for related data — add `include: { relation: true }`
- Type mismatch on `Decimal` — wrap with `Number()` or `String()`

---

## Environment Variables Summary

### Final `.env.local`
```bash
# PostgreSQL (local Docker)
DATABASE_URL="postgresql://pms:pms@localhost:5432/pms"
DIRECT_URL="postgresql://pms:pms@localhost:5432/pms"

# Auth.js
AUTH_SECRET="<generated with: npx auth secret>"
AUTH_GOOGLE_ID="<from Google Cloud Console>"
AUTH_GOOGLE_SECRET="<from Google Cloud Console>"
AUTH_RESEND_KEY="<from Resend dashboard>"
```

### Removed
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```
