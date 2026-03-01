# PMS Application Structure Audit

> Generated: 2026-02-28 | Stack: Next.js 16 + Supabase + Tailwind v4 + shadcn/ui

## Architecture Overview

```
src/
  app/
    (dashboard)/           # Grouped layout with sidebar + role gate
      admin/               # Admin pages (cycles, users, audit)
      employee/            # Employee pages (review, history)
      hrbp/                # HRBP pages (calibration, audit)
      manager/             # Manager pages (team, KPIs, reviews)
      layout.tsx           # Shared sidebar layout
    auth/callback/route.ts # OAuth + password login callback
    login/page.tsx         # Login page with quick-fill
    unauthorized/page.tsx  # Access denied
    layout.tsx             # Root layout (fonts, metadata)
    page.tsx               # Root redirect to role dashboard
  components/
    ui/                    # shadcn primitives
    sidebar.tsx            # Role-based navigation
    submit-button.tsx      # Server action button with loading
    audit-log-table.tsx    # Shared paginated audit table
    cycle-status-badge.tsx # Color-coded status pill
    deadline-banner.tsx    # Deadline display + overdue warning
    bell-curve-chart.tsx   # Rating distribution bar chart
  lib/
    supabase/              # Client, server, middleware Supabase clients
    auth.ts                # getCurrentUser, requireRole, requireManagerOwnership
    types.ts               # TypeScript interfaces for all DB entities
    constants.ts           # Rating tiers, multipliers, cycle status labels
    validate.ts            # Email, weight, multiplier validators
    csv.ts                 # RFC 4180 CSV parser
    payroll-csv.ts         # Payroll export CSV generator
    cycle-machine.ts       # State machine transitions + role gates
    zimyo.ts               # Zimyo API client + data transformer
    utils.ts               # cn() Tailwind utility
  proxy.ts                 # Next.js 16 middleware (was middleware.ts)
```

---

## Route Map

| Route | Role | Purpose |
|-------|------|---------|
| `/login` | public | Email/password + magic link + quick-fill pills |
| `/auth/callback` | public | OAuth code exchange + role-based redirect |
| `/unauthorized` | any | Access denied page |
| `/` | any | Redirect to role dashboard |
| `/admin` | admin | Cycle management (list, create, advance status) |
| `/admin/cycles/new` | admin | Create cycle form |
| `/admin/users` | admin | User table + Zimyo sync |
| `/admin/users/upload` | admin | CSV user upload with summary |
| `/admin/audit-log` | admin | Paginated audit log |
| `/employee` | employee | Active cycle: KPIs, self-review form, final result |
| `/employee/history` | employee | Published appraisals table |
| `/manager` | manager | Team overview: status table, action links |
| `/manager/[employeeId]/kpis` | manager | Add/delete KPIs for employee |
| `/manager/[employeeId]/review` | manager | Rate employee (view self-assessment + submit rating) |
| `/manager/my-review` | manager | Manager's own self-review |
| `/hrbp` | hrbp | Cycle overview (active + published) |
| `/hrbp/calibration` | hrbp | Bell curve + override ratings + lock/publish |
| `/hrbp/audit-log` | hrbp | Paginated audit log |
| `/api/payroll-export` | hrbp | CSV download (locked/published cycles) |

---

## Server Actions

### Admin (`admin/actions.ts`)
- `createCycle(formData)` - Insert cycle with status=draft
- `advanceCycleStatus(cycleId, currentStatus)` - Atomic state machine transition

### Admin Users (`admin/users/actions.ts`)
- `triggerZimyoSync()` - Fetch from Zimyo API, upsert users, bulk-link managers
- `updateUserRole(userId, role)` - Change role with audit log

### Admin Upload (`admin/users/upload/actions.ts`)
- `uploadUsersCsv(formData)` - Parse CSV, batch insert/update users, return summary

### Employee (`employee/actions.ts`)
- `submitSelfReview(formData)` - Upsert review with status=submitted, notify manager
- `saveDraftReview(formData)` - Upsert review with status=draft

### Manager (`manager/actions.ts`)
- `addKpi(formData)` - Insert KPI (validates ownership + weight)
- `deleteKpi(kpiId, employeeId)` - Delete KPI (validates ownership)
- `submitManagerRating(formData)` - Upsert appraisal, notify HRBPs

### HRBP (`hrbp/actions.ts`)
- `overrideRating(formData)` - Set final_rating with justification, is_final=true
- `lockCycle(cycleId)` - RPC bulk_lock_appraisals + status=locked
- `publishCycle(cycleId)` - Status=published + notify all users

---

## Auth Flow

```
Browser                     Server                      Supabase
  |                           |                           |
  |-- signInWithPassword ---->|                           |
  |                           |-- POST /auth/v1/token --->|
  |                           |<-- JWT (user_role,        |
  |                           |    user_id in claims) ----|
  |<-- session cookie --------|                           |
  |                           |                           |
  |-- window.location =       |                           |
  |   /{role} dashboard ----->|                           |
  |                           |-- proxy: updateSession -->|
  |                           |<-- refreshed session -----|
  |                           |-- requireRole([roles]) -->|
  |                           |   (layout.tsx)            |
  |<-- rendered page ---------|                           |
```

Key points:
- JWT custom hook injects `user_role` + `user_id` into every token
- proxy.ts runs on every request, refreshes session cookies
- Each dashboard layout calls `requireRole()` to gate access
- RLS policies use `public.user_role()` and `public.user_id()` from JWT

---

## What Exists vs What's Missing

### Implemented
- 7-stage cycle workflow with atomic transitions
- KPI setting with weight validation (sum <= 100%)
- Self-review with deadline enforcement
- Manager rating with deadline enforcement
- HRBP calibration with justification-required overrides
- Optimistic locking (is_final flag) prevents concurrent overwrites
- Bell curve rating distribution chart
- CSV payroll export
- Zimyo API sync + CSV user upload
- Audit logging for critical actions
- Deadline banners with overdue warnings
- 41 passing unit tests, 0 TypeScript errors

### Not Implemented
- No auto-save drafts (manual save only)
- No per-KPI ratings (single overall rating)
- No KPI progress tracking (no target/actual values)
- No KPI templates or copy-from-previous-cycle
- No 360-degree feedback
- No continuous feedback / check-ins
- No competency framework
- No goal hierarchy (company > team > individual)
- No review templates (form structure is hardcoded)
- No smart notifications (no deadline reminders, no progress nudges)
- No notification delivery (table exists but no sender)
- No AI-assisted review writing
- No 9-box grid for calibration
- No distribution targets for calibration
- No merit matrix for compensation
- No budget pool tracking
- No manager self-review deadline enforcement
- No multi-cycle comparison view
- No logout button
