<div align="center">

# ⚡ Performance System hRMS

**A modern, full-stack HR Performance Management System built with Next.js and Supabase**

[![Next.js](https://img.shields.io/badge/Next.js-16.1.6-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2.3-61DAFB?style=for-the-badge&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-2.97-3ECF8E?style=for-the-badge&logo=supabase)](https://supabase.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.2.1-06B6D4?style=for-the-badge&logo=tailwindcss)](https://tailwindcss.com/)
[![Tests](https://img.shields.io/badge/Tests-60%20passing-22C55E?style=for-the-badge&logo=vitest)](https://vitest.dev/)

*Align goals · Track progress · Unlock potential — one cycle at a time.*

</div>

---

## What is hRMS?

**Performance System hRMS** is a production-grade HR management platform that takes the pain out of annual and mid-year performance reviews. It gives every person in your organisation — from an individual contributor to the HR Business Partner managing calibration — a purpose-built interface tailored exactly to their role.

Built on **Next.js 16 App Router** with **Supabase cloud** (PostgreSQL 17, Row-Level Security, and JWT-injected roles), it enforces permission boundaries at the database layer — no client-side role checks that can be bypassed. Every page, query, and server action knows exactly who is calling it and what they are allowed to see.

---

## ✨ Feature Highlights

### 🔄 The Review Cycle — 7 Stages, One Flow

Every performance cycle moves through a controlled pipeline managed by the Admin:

```
draft  →  kpi_setting  →  self_review  →  manager_review  →  calibrating  →  locked  →  published
```

| Stage | Who acts | What happens |
|-------|----------|--------------|
| **Draft** | Admin | Cycle created with name, dates, salary budget, and variable pay |
| **KPI Setting** | Managers | Set KPIs for each direct report |
| **Self Review** | Employees | Submit self-rating + written assessment against KPIs |
| **Manager Review** | Managers | Submit manager rating + comments, override KPIs if needed |
| **Calibrating** | HRBP | Review org-wide data, override final ratings for fairness |
| **Locked** | HRBP (triggers) | Payouts computed and locked — no further edits |
| **Published** | Admin | Results visible to employees and managers |

### 🏢 Department Scoping

Departments are first-class entities. Each HRBP is assigned to one or more departments, and Row-Level Security ensures they **only ever see data for their own departments** — not the whole organisation. Admins retain org-wide access.

```sql
-- HRBP calibration is scoped at the database level — no application filtering needed
CREATE POLICY hrbp_select_dept_appraisals ON appraisals
  FOR SELECT USING (
    public.user_role() = 'hrbp' AND is_active = true AND
    EXISTS (
      SELECT 1 FROM hrbp_departments hd
      JOIN users u ON u.department_id = hd.department_id
      WHERE hd.hrbp_id = public.user_id() AND u.id = appraisals.employee_id
    )
  );
```

### 💸 Payout Engine

Variable pay is computed automatically when a cycle locks. The formula is:

```
Payout = Snapshotted Variable Pay × Payout Multiplier
```

Multipliers are driven by the employee's **final rating**:

| Rating | Full Name | Default Multiplier |
|--------|-----------|-------------------|
| **FEE** | Far Exceeds Expectations | **1.25×** |
| **EE** | Exceeds Expectations | **1.10×** |
| **ME** | Meets Expectations | **1.00×** |
| **SME** | Sometimes Meets Expectations | **1.00×** |
| **BE** | Below Expectations | **0.00×** |

Admins can edit global defaults on the **Payout Config** page. Individual cycles can further override the FEE, EE, and ME multipliers at creation time — ideal for adjusting payouts for different performance years or business unit targets.

---

## 👤 Four Roles, Four Tailored Experiences

Every role sees only what they need:

<details>
<summary><strong>🟢 Employee</strong></summary>

- View KPIs set by their manager for the active cycle
- Submit self-review (rating + written assessment) with deadline enforcement
- Save drafts before final submission
- View manager's final comments and rating after publication
- View personal payout breakdown (rating × multiplier × base salary) when published
- Full review history across all past cycles
- Access company documentation

</details>

<details>
<summary><strong>🔵 Manager</strong></summary>

- Dashboard showing all direct reports and their review status at a glance
- Create, edit, and delete KPIs per employee per cycle
- Import from KPI template library for consistency
- Submit manager review (rating + comments) for each direct report
- Track submission completion across the team
- View own self-review (mirrors employee flow)
- Access company documentation

</details>

<details>
<summary><strong>🟣 HRBP (HR Business Partner)</strong></summary>

- Calibration view scoped strictly to assigned departments (RLS-enforced)
- Bell-curve distribution chart for visual rating spread across the organisation
- Override individual final ratings with an immutable audit trail
- Lock cycles to trigger payout computation via a database function
- Publish cycles to make results visible
- Payout summary table (multiplier × amount × total) when locked/published
- Self-review capability when enrolled as `is_also_employee`
- Department-scoped audit log
- Access company documentation

</details>

<details>
<summary><strong>🔴 Admin</strong></summary>

- Full organisation dashboard with user counts by role and cycle health
- **Cycle management** — create cycles with custom dates, budget, KPI templates, and per-cycle multiplier overrides for FEE/EE/ME
- **User management** — create users (sends invite email), edit users, assign managers, change roles, send magic links or password resets
- **Department management** — create, rename, and delete departments; assign HRBPs to one or more departments
- **Payout Config** — edit global rating tier multipliers; locked cycles are protected from retroactive changes
- **KPI Templates** — reusable KPI library for managers to import from
- **Notifications** — send targeted in-app notifications by role or department
- **Feature flags** — toggle features at runtime without redeployment
- **Full audit log** with filter chips (User Mgmt / Cycle / Reviews / Config)
- CSV bulk import for Zimyo payroll integration
- Access company documentation

</details>

---

## 🗄️ Database Architecture

**19 migrations** incrementally build the schema. Core tables:

```
users             — profiles, roles, department_id, is_also_employee, base_salary, variable_pay
departments       — first-class department entities (name, created_at)
hrbp_departments  — junction: which HRBPs manage which departments
cycles            — performance cycles with status, deadlines, budgets, multiplier overrides
kpis              — KPIs set per employee per cycle by managers
reviews           — self + manager review data, ratings, comments, submitted_at
appraisals        — computed payout data (multiplier, amount) locked at cycle lock time
audit_logs        — immutable change history (action, entity_type, entity_id, old/new values)
notifications     — in-app notification feed per user
payout_config     — global multiplier table (FEE/EE/ME/SME/BE)
kpi_templates     — reusable KPI library
```

**Row-Level Security** is enabled on every table. Helper functions `public.user_role()` and `public.user_id()` read from the JWT claims so policies are evaluated at the database layer — not in application code.

**Custom JWT Hook** — a Postgres function fires on every Supabase token generation and injects `user_role` and `user_id` into the JWT payload. This makes role information available in both server-side Next.js code and in database RLS policies without an extra round-trip.

---

## 🔐 Authentication

Three login methods supported out of the box:

| Method | Flow |
|--------|------|
| **Email + Password** | Standard credential login |
| **Magic Link** | Passwordless — click a link in your inbox |
| **Google OAuth** | One-click SSO (domain-restricted in production) |

The login page includes **quick-fill test account pills** for all 10 seed accounts so reviewers and developers can switch roles instantly without typing credentials.

After authentication, the JWT hook fires synchronously to inject `user_role` + `user_id`. The Next.js proxy layer (`src/proxy.ts`) validates the session on every request and redirects unauthenticated users to `/login`. Unprovisioned users (authenticated with Google but no matching `users` row) are redirected to a friendly `/auth/not-provisioned` page.

---

## 🛣️ Route Map

```
/login                          — Login (password · magic link · Google OAuth)
/admin                          — Admin dashboard (cycle health + people counts)
/admin/cycles                   — All cycles list
/admin/cycles/new               — Create cycle with multiplier overrides
/admin/cycles/[id]              — Cycle detail + payout table when locked/published
/admin/users                    — User list
/admin/users/new                — Create user (sends invite email)
/admin/users/[id]/edit          — Edit user, assign HRBP departments, auth controls
/admin/departments              — Department CRUD
/admin/payout-config            — Global multiplier editor
/admin/kpi-templates            — KPI template library
/admin/notifications            — Send targeted notifications
/admin/feature-flags            — Runtime feature toggles
/admin/audit-log                — Org-wide audit log with filter chips
/manager                        — Manager dashboard (team review status)
/manager/[id]/kpis              — Manage KPIs for an employee
/manager/[id]/review            — Submit manager review for an employee
/manager/my-review              — Manager's own self-review
/employee                       — Employee self-review & KPI view
/employee/history               — Past cycle results and payout history
/hrbp                           — HRBP overview
/hrbp/calibration               — Calibration + rating overrides + payout columns
/hrbp/my-review                 — HRBP self-review (only when is_also_employee)
/hrbp/audit-log                 — Department-scoped audit log
/docs                           — Company documentation (accessible by all roles)
```

---

## 🧰 Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Framework** | Next.js App Router + Turbopack | 16.1.6 |
| **UI Library** | React (Server + Client Components) | 19.2.3 |
| **Language** | TypeScript (strict) | 5.x |
| **Styling** | Tailwind CSS v4 | 4.2.1 |
| **Components** | shadcn/ui (Radix primitives) | latest |
| **Database** | PostgreSQL 17 via Supabase cloud | — |
| **Auth** | Supabase Auth (magic link · password · Google OAuth) | 2.97.0 |
| **Data client** | Supabase JS (typed) | 2.97.0 |
| **Testing** | Vitest | 4.0.18 |
| **Dev bundler** | Turbopack | bundled |

### Why this stack makes life easy

**Next.js App Router + Server Actions** — No separate API layer. Server actions run directly on the server with full access to secrets and the database. Forms submit to typed async functions. Loading states and error boundaries are first-class. The `useActionState` hook in React 19 wires server-returned errors directly into the UI with zero extra state management.

**Supabase RLS** — Permissions live in the database, not scattered across a dozen API routes. Adding a new endpoint is safe by default — RLS blocks unauthorised access even if the application code has a bug. The `service role` client is used only for trusted server-side operations (audit writes, user creation) that intentionally bypass row-level policies.

**JWT Role Injection** — Because `user_role` is baked into every token, every Supabase query knows the caller's role without a secondary lookup. RLS policies like `WHERE public.user_role() = 'hrbp'` evaluate in microseconds at the Postgres query planner level.

**TypeScript end-to-end** — From Supabase's generated types to the `ActionResult<T>` discriminated union returned by every server action, type mismatches are caught at compile time. The project maintains **zero TypeScript errors** across the entire codebase.

```typescript
// Every server action returns the same shape — predictable, composable
type ActionResult<T = null> =
  | { data: T;    error: null   }
  | { data: null; error: string }
```

**Tailwind v4** — CSS custom properties, native nesting, and the `@theme` layer mean almost zero hand-written CSS. The entire design system lives in configuration.

---

## 🔍 Audit Trail

Every meaningful action writes an immutable record to `audit_logs`:

```typescript
{
  changed_by:  uuid,        // who did it
  action:      string,      // 'review_submitted' | 'kpi_added' | 'cycle_status_changed' | ...
  entity_type: string,      // 'review' | 'kpi' | 'cycle' | 'user' | ...
  entity_id:   uuid,        // the primary key of the affected row
  old_value:   jsonb,       // previous state (null for creates)
  new_value:   jsonb,       // new state (null for deletes)
  created_at:  timestamptz
}
```

The audit log UI has **filter chips** to narrow by category without a page reload:

| Chip | Actions covered |
|------|----------------|
| **All** | Everything |
| **User Mgmt** | user_created, user_updated, role_change, magic_link_generated, password_reset_sent, csv_upload |
| **Cycle** | cycle_status_changed, cycle_locked, cycle_published |
| **Reviews** | review_submitted, kpi_added, kpi_deleted, manager_review_submitted |
| **Config** | payout_config_updated, department_created, hrbp_departments_updated, rating_override |

---

## 🚀 Local Development

### Prerequisites

- Node.js 20+
- A Supabase cloud project (or local Supabase CLI instance)

### Setup

```bash
# Clone the repository
git clone https://github.com/tejasmakesmusic/Performance-System-hRMS.git
cd Performance-System-hRMS

# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
# Add SUPABASE_SERVICE_ROLE_KEY for admin operations

# Apply all 19 migrations to your Supabase project
supabase db push

# Start the development server (Turbopack)
npm run dev
```

App runs at **http://localhost:3000**

### Running Tests

```bash
npx vitest run     # Run all 60 tests once
npx vitest         # Watch mode
```

### Test Accounts

All 10 accounts are pre-seeded by migration `00017` and available as **one-click quick-fill pills** on the login page:

| Account | Password | Role | Lands at |
|---------|----------|------|---------|
| admin@test.com | admin123 | Admin | `/admin` |
| manager@test.com | manager123 | Manager (Alice) | `/manager` |
| frank@test.com | frank123 | Manager (Frank) | `/manager` |
| employee@test.com | employee123 | Employee (Bob) | `/employee` |
| dave@test.com | dave123 | Employee | `/employee` |
| eve@test.com | eve123 | Employee | `/employee` |
| grace@test.com | grace123 | Employee | `/employee` |
| henry@test.com | henry123 | Employee | `/employee` |
| irene@test.com | irene123 | Employee | `/employee` |
| hrbp@test.com | hrbp123 | HRBP | `/hrbp` |

---

## 📁 Project Structure

```
src/
├── app/
│   ├── (dashboard)/
│   │   ├── admin/           — Admin pages (cycles, users, departments, payout, audit)
│   │   ├── employee/        — Employee self-review + history
│   │   ├── manager/         — Manager dashboard + KPI + review submission
│   │   ├── hrbp/            — HRBP calibration + my-review + audit log
│   │   ├── docs/            — Documentation (all roles)
│   │   └── layout.tsx       — Dashboard shell (sidebar + auth gate)
│   ├── login/               — Login page (password + magic link + Google)
│   └── auth/                — Auth callback + not-provisioned page
├── components/
│   ├── sidebar.tsx          — Role-aware navigation with conditional links
│   ├── audit-log-table.tsx  — Paginated audit log with client-side filter chips
│   ├── bell-curve-chart.tsx — Rating distribution visualisation
│   ├── deadline-banner.tsx  — Deadline warning display
│   ├── submit-button.tsx    — Form submit with pending state
│   └── ...                  — 20+ shared UI components
├── lib/
│   ├── types.ts             — All TypeScript interfaces (User, Cycle, Review, ...)
│   ├── constants.ts         — Rating tiers, PayoutConfigMap, DEFAULT_PAYOUT_CONFIG
│   ├── auth.ts              — requireRole(), getCurrentUser(), ownership guards
│   ├── validate.ts          — Server-side validation utilities
│   ├── csv.ts               — Zimyo CSV import parser
│   └── supabase/            — Browser + server Supabase clients
└── proxy.ts                 — Next.js middleware (session validation + routing)

supabase/
└── migrations/              — 19 incremental SQL migrations (00001 → 00019)

docs/
└── plans/                   — Design docs and implementation plans
```

---

## 🗺️ Migration History

| # | Name | Key changes |
|---|------|-------------|
| 00001 | create_enums | `user_role`, `cycle_status`, `rating_tier` Postgres enums |
| 00002 | create_tables | Core 7 tables: users, cycles, kpis, reviews, appraisals, audit_logs, notifications |
| 00003 | enable_rls | Row-Level Security enabled on all tables |
| 00004 | rls_policies | Base RLS policies per role |
| 00005 | auth_hook | Custom JWT hook — injects `user_role` + `user_id` into every token |
| 00006 | integrity_and_indexes | FK constraints, `is_final` flag, `bulk_lock_appraisals()` function |
| 00007 | notification_types | Extended notification type enum |
| 00008 | fix_multipliers | SME multiplier column on cycles |
| 00009 | kpi_templates | KPI template library table |
| 00010 | google_domain_hook | Google OAuth domain restriction hook |
| 00011 | zimyo_independence | Zimyo sync decoupling |
| 00012 | budget_fields | `total_budget` and snapshotted salary fields on cycles/appraisals |
| 00013 | is_active_rls | Active-user gates on RLS policies |
| 00014 | feature_flags | Runtime feature toggle table |
| 00015 | drafts_and_notifications | Draft review status, notification improvements |
| 00016 | admin_overhaul | Admin-specific RLS and action policies |
| 00017 | seed_test_data | 10 test accounts across all roles |
| **00018** | **pms_v3** | **Departments, HRBP dept scoping, `payout_config`, `is_also_employee`, per-cycle multiplier overrides** |
| **00019** | **pms_v3_fixes** | **RLS hardening: IS NOT NULL guard on lock, dept-scoped HRBP writes, draft review status guard** |

---

## 🧪 Test Suite

60 tests across 12 test files:

```
✓ constants.test.ts      (6)   — getPayoutMultiplier with config overrides
✓ validate.test.ts       (6)   — multiplier range, required fields, format checks
✓ auth.test.ts           (3)   — role guards, ownership checks
✓ csv.test.ts            (13)  — Zimyo payroll CSV import edge cases
✓ cycle-machine.test.ts  (8)   — valid and invalid stage transitions
✓ admin-helpers.test.ts  (4)   — bulk lock eligibility checks
✓ payroll-csv.test.ts    (4)   — payroll export formatting
✓ frecency.test.ts       (4)   — command palette frecency sorting
✓ toast.test.ts          (3)   — toast deduplication
✓ confirm.test.ts        (2)   — confirm dialog state
✓ tour.test.ts           (6)   — onboarding tour step definitions
✓ zimyo.test.ts          (1)   — Zimyo sync integration
```

---

## 🏗️ Key Architectural Decisions

### `ActionResult<T>` — Consistent Server Action Contract

Every server action returns the same discriminated union type, making error handling uniform across all 30+ actions:

```typescript
type ActionResult<T = null> =
  | { data: T;    error: null   }
  | { data: null; error: string }
```

### `useActionState` for Form Error Display

React 19's `useActionState` hook connects server-returned errors directly into the UI with zero extra client state:

```typescript
const [state, action, pending] = useActionState(createDepartment, null)
// state.error renders inline — no separate useState, no client validation duplication
```

### Service Client for Privileged Writes

Audit log writes, user creation, and other trusted operations use `createServiceClient()` (service role key) to bypass RLS intentionally — keeping all regular user queries secure.

### Supabase Relational Select — No N+1

Related data is fetched in a single query via Supabase's embedded select syntax:

```typescript
supabase
  .from('appraisals')
  .select('id, final_rating, payout_amount, users!appraisals_employee_id_fkey(full_name, department:departments(name))')
  .eq('cycle_id', cycleId)
```

### Immutable Payout Snapshots

When a cycle locks, `bulk_lock_appraisals()` reads each employee's current `variable_pay` and snapshots it into `appraisals.snapshotted_variable_pay`. Future changes to an employee's salary never affect a locked cycle's payout calculations.

---

<div align="center">

Built with ❤️ using Next.js, Supabase, and TypeScript

**112 commits · 19 migrations · 60 tests · 0 TypeScript errors**

</div>
