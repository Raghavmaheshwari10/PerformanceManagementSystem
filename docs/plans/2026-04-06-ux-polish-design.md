# Design: UX Polish

**Date:** 2026-04-06
**Status:** Approved
**Stack:** Next.js 16, React 19, TypeScript, Tailwind v4

---

## Scope

Five targeted improvements:

1. Keyboard shortcuts — `?` help overlay + `/` command palette alias
2. Undo toasts — upgrade toast system with action buttons, delayed delete for low-risk actions
3. Empty states — reusable `<EmptyState>` component on 15 highest-traffic pages
4. Skeleton loaders — Suspense boundaries on 5 more heavy pages
5. Onboarding checklist — role-specific dashboard widget for first-time users

Explicitly out of scope: Vim-style navigation shortcuts, soft-delete schema changes, undo on high-risk actions (delete cycle, remove user — these keep existing confirmation dialogs).

---

## Part 1 — Keyboard Shortcuts

### `/` key — Command Palette Alias

Add a `keydown` listener in `src/components/command-palette/index.tsx` that opens the palette when `/` is pressed. Ignored when focus is inside `<input>`, `<textarea>`, or `[contenteditable]`.

### `?` key — Shortcuts Help Overlay

**File:** `src/components/keyboard-shortcuts-dialog.tsx`

A `'use client'` component rendered inside `ClientProviders`. Listens for `?` key (same input-focus guard). Renders a glass-styled modal listing all shortcuts:

| Key | Action |
|-----|--------|
| `/` or `Cmd+K` | Command palette |
| `?` | This help |
| `Esc` | Close modal |

Dismissed by `Escape`, clicking outside, or the close button. No external dependencies.

---

## Part 2 — Undo Toasts

### Toast System Upgrade

**File:** `src/lib/toast.tsx`

Add optional `action` and `duration` to the toast interface:

```typescript
interface ToastOptions {
  action?: { label: string; onClick: () => void }
  duration?: number  // ms, default 4000
}

toast.success('KPI deleted', {
  action: { label: 'Undo', onClick: () => restore() },
  duration: 5000,
})
```

**File:** `src/components/toaster.tsx`

Render the action as a small button inside the toast when provided.

### Delayed Delete Pattern

For low-risk deletions, the delete happens client-side first, server-side after 5 seconds:

1. User clicks delete — item is optimistically removed from UI
2. Toast appears with "Undo" button, 5-second timer starts
3. If Undo clicked — item restored in UI, server action never fires
4. If timer expires — actual server action fires, `revalidatePath` refreshes

**Applies to:**
- `deleteKpi` in `src/app/(dashboard)/manager/[employeeId]/kpis/kpi-row.tsx`
- `deleteKra` in manager KRA components
- `deleteKpiTemplate` in `src/app/(dashboard)/admin/kpi-templates/`
- `deleteKraTemplate` in `src/app/(dashboard)/admin/kra-templates/`

High-risk actions (delete cycle, remove user, delete department) keep existing confirmation dialogs unchanged.

---

## Part 3 — Empty States

### Reusable Component

**File:** `src/components/empty-state.tsx`

```typescript
interface EmptyStateProps {
  icon: ReactNode
  title: string
  description: string
  action?: {
    label: string
    href?: string
    onClick?: () => void
  }
}
```

Glass card, centered layout: icon in a tinted circle, title, description, optional CTA button.

### Pages to Retrofit (15)

| Page | Empty Condition | CTA |
|------|----------------|-----|
| `/admin/kpi-templates` | No templates | + New Template |
| `/admin/competencies` | No competencies | + Add Competency |
| `/admin/departments` | No departments | + Add Department |
| `/admin/cycles` | No cycles | + Create Cycle |
| `/admin/audit-log` | No logs | (none) |
| `/admin/notifications` | No notifications | (none) |
| `/admin/payouts` | No payouts | (none) |
| `/hrbp/employees` | No employees | (none) |
| `/hrbp/calibration` | No calibration data | (none) |
| `/hrbp/meetings` | No meetings | (none) |
| `/manager/[id]/kpis` | No KPIs | + Add KPI |
| `/manager/[id]/goals` | No goals | (none) |
| `/employee/peer-reviews` | No peer reviews | (none) |
| `/employee/history` | No history | (none) |
| `/employee/profile` | No profile data | (none) |

Pages with existing good empty states (admin/users, employee/goals, employee/feedback, manager dashboard) are unchanged.

---

## Part 4 — Skeleton Loaders

### New Skeleton Variant

**File:** `src/components/skeletons.tsx`

Add `StatCardsSkeleton` — pulse-animated grid matching `grid-cols-2 md:grid-cols-4` for the admin dashboard stat cards.

### Suspense Boundaries on 5 Pages

| Page | Skeleton | Streamed Content |
|------|----------|-----------------|
| `/admin` | `StatCardsSkeleton` | Cycles, users, notifications, departments |
| `/admin/cycles` | `TableSkeleton` | Cycle list |
| `/admin/audit-log` | `TableSkeleton` | Audit log entries |
| `/hrbp/calibration` | `TableSkeleton` | Calibration data |
| `/employee` | `CardGridSkeleton` | KPIs, review status, payout |

Pattern: extract data-fetching into async `*Content` server component, wrap in `<Suspense fallback={<Skeleton />}>`. Page shell renders instantly.

Any `*Content` component rendering a client component with `useSearchParams()` gets its own inner `<Suspense>` boundary.

---

## Part 5 — Onboarding Checklist

### Component

**File:** `src/components/onboarding-checklist.tsx`

A dashboard widget that shows role-specific setup tasks. Visible only when `user.onboarded_at` is null. Dismissible via close button — calls existing `markUserOnboarded()` server action.

Visual: glass card with checkmark list, progress bar, dismiss button.

### Tracking

`localStorage` keyed by role (`onboarding-checklist-{role}`). Checklist items check live data (query results), not manual toggles.

### Items Per Role

**Employee (4):**
- Complete your profile (has department + designation)
- Review your KPIs (has KPIs assigned)
- Submit self-review (review status = submitted)
- Give peer feedback (has sent ≥1 feedback)

**Manager (4):**
- Set KPIs for your team (all direct reports have ≥1 KPI)
- Complete manager reviews (all appraisals submitted)
- Schedule discussion meetings (has meetings created)
- Review team goals (visited goals page)

**HRBP (3):**
- Review employee directory (visited /hrbp/employees)
- Complete calibration (visited /hrbp/calibration)
- Schedule meetings (has meetings created)

**Admin (4):**
- Add departments (has ≥1 department)
- Add users (has ≥2 users)
- Create first cycle (has ≥1 cycle)
- Configure KPI templates (has ≥1 template)

Server component queries counts/statuses, passes checklist state as props. Rendered at top of each role's dashboard page.

---

## New Files

| File | Purpose |
|------|---------|
| `src/components/keyboard-shortcuts-dialog.tsx` | `?` help overlay |
| `src/components/empty-state.tsx` | Reusable empty state component |
| `src/components/onboarding-checklist.tsx` | Role-specific onboarding widget |

## Files Modified

| File | Change |
|------|--------|
| `src/components/command-palette/index.tsx` | Add `/` key listener |
| `src/components/client-providers.tsx` | Render `KeyboardShortcutsDialog` |
| `src/lib/toast.tsx` | Add `action` and `duration` to toast interface |
| `src/components/toaster.tsx` | Render action button in toasts |
| `src/components/skeletons.tsx` | Add `StatCardsSkeleton` |
| `src/app/(dashboard)/manager/[employeeId]/kpis/kpi-row.tsx` | Delayed delete + undo toast |
| `src/app/(dashboard)/admin/kpi-templates/page.tsx` | Empty state + delayed delete |
| 15 page files | Add `<EmptyState>` where data is empty |
| 5 page files | Add Suspense + skeleton boundaries |
| 4 dashboard pages | Add `<OnboardingChecklist>` |
