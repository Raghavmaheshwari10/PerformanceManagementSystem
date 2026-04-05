# UX Polish Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add keyboard shortcuts, undo toasts, empty states, skeleton loaders, and role-specific onboarding checklists — making the app feel polished and discoverable.

**Architecture:** Purely additive — no schema changes. Keyboard shortcuts use `keydown` listeners. Undo toasts extend the existing toast context with action buttons and delayed server action execution. Empty states use a single reusable component. Skeleton loaders wrap existing pages in Suspense. Onboarding checklist queries live data and renders conditionally.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind v4

---

## Task 1: Add `/` Key to Open Command Palette

**Files:**
- Modify: `src/components/command-palette/index.tsx`

**What to change:**

In the existing `useEffect` keydown handler (lines 32-38), add a second condition for the `/` key. Must ignore the key when focus is inside an input, textarea, or contenteditable element.

**Step 1: Read the file**

Read `src/components/command-palette/index.tsx` to see the current handler.

**Step 2: Update the keydown handler**

Find:
```typescript
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(v => !v)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])
```

Replace with:
```typescript
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(v => !v)
        return
      }
      // '/' opens palette — ignore when typing in inputs
      if (e.key === '/' && !isEditableTarget(e.target)) {
        e.preventDefault()
        setOpen(true)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])
```

Add this helper function above the `CommandPaletteProvider` component:

```typescript
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (target.isContentEditable) return true
  return false
}
```

**Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/components/command-palette/index.tsx
git commit -m "feat(ux): add / key shortcut to open command palette"
```

---

## Task 2: Create Keyboard Shortcuts Help Dialog

**Files:**
- Create: `src/components/keyboard-shortcuts-dialog.tsx`
- Modify: `src/components/command-palette/index.tsx`
- Modify: `src/components/client-providers.tsx`

**Step 1: Create `src/components/keyboard-shortcuts-dialog.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (target.isContentEditable) return true
  return false
}

const SHORTCUTS = [
  { keys: ['/', '⌘K'], description: 'Open command palette' },
  { keys: ['?'], description: 'Show keyboard shortcuts' },
  { keys: ['Esc'], description: 'Close dialog' },
]

export function KeyboardShortcutsDialog() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && open) {
        setOpen(false)
        return
      }
      if (e.key === '?' && !isEditableTarget(e.target)) {
        e.preventDefault()
        setOpen(v => !v)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)}>
      <div
        className="w-full max-w-sm rounded-xl border border-slate-200 bg-white shadow-2xl mx-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="font-semibold text-slate-900">Keyboard Shortcuts</h2>
          <button
            onClick={() => setOpen(false)}
            className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            ✕
          </button>
        </div>
        <div className="divide-y divide-slate-100">
          {SHORTCUTS.map(s => (
            <div key={s.description} className="flex items-center justify-between px-5 py-3">
              <span className="text-sm text-slate-600">{s.description}</span>
              <div className="flex items-center gap-1.5">
                {s.keys.map(k => (
                  <kbd
                    key={k}
                    className="inline-flex h-6 min-w-[24px] items-center justify-center rounded border border-slate-200 bg-slate-50 px-1.5 text-xs font-medium text-slate-600"
                  >
                    {k}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-slate-100 px-5 py-3">
          <p className="text-xs text-slate-400 text-center">Press any key to dismiss</p>
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Register in ClientProviders**

In `src/components/client-providers.tsx`, add import and render:

Find:
```typescript
import { SessionTimeout } from '@/components/session-timeout'
```

Replace with:
```typescript
import { SessionTimeout } from '@/components/session-timeout'
import { KeyboardShortcutsDialog } from '@/components/keyboard-shortcuts-dialog'
```

Find:
```tsx
          <SessionTimeout />
```

Replace with:
```tsx
          <SessionTimeout />
          <KeyboardShortcutsDialog />
```

**Step 3: Extract `isEditableTarget` to shared util**

Since both `command-palette/index.tsx` and `keyboard-shortcuts-dialog.tsx` need `isEditableTarget`, move it to the command palette file and export it, then import in the dialog. Or, since it's small (5 lines), just duplicate it in both files — no shared util needed.

**Step 4: TypeScript check**

```bash
npx tsc --noEmit
```

**Step 5: Commit**

```bash
git add src/components/keyboard-shortcuts-dialog.tsx src/components/client-providers.tsx src/components/command-palette/index.tsx
git commit -m "feat(ux): add ? keyboard shortcuts help dialog"
```

---

## Task 3: Upgrade Toast System with Action Buttons

**Files:**
- Modify: `src/lib/toast.tsx`
- Modify: `src/components/toaster.tsx`

**Step 1: Update `src/lib/toast.tsx`**

Add `action` and `duration` to the Toast interface and update the context methods.

Find the full Toast interface and ToastContextValue (lines 7-38):
```typescript
export interface Toast {
  id: string
  variant: ToastVariant
  message: string
}
```

Replace with:
```typescript
export interface ToastAction {
  label: string
  onClick: () => void
}

export interface ToastOptions {
  action?: ToastAction
  duration?: number
}

export interface Toast {
  id: string
  variant: ToastVariant
  message: string
  action?: ToastAction
}
```

Update the `ToastContextValue` interface:
```typescript
interface ToastContextValue {
  toast: {
    success: (message: string, options?: ToastOptions) => void
    error:   (message: string, options?: ToastOptions) => void
    info:    (message: string, options?: ToastOptions) => void
    warning: (message: string, options?: ToastOptions) => void
  }
  toasts: Toast[]
  dismiss: (id: string) => void
}
```

Update the `add` function inside `ToastProvider`:

Find:
```typescript
  const add = useCallback((variant: ToastVariant, message: string) => {
    const id = crypto.randomUUID()
    dispatch({ type: 'ADD', toast: { id, variant, message } })
    setTimeout(() => dispatch({ type: 'DISMISS', id }), 4000)
  }, [])

  const toast = {
    success: (m: string) => add('success', m),
    error:   (m: string) => add('error', m),
    info:    (m: string) => add('info', m),
    warning: (m: string) => add('warning', m),
  }
```

Replace with:
```typescript
  const add = useCallback((variant: ToastVariant, message: string, options?: ToastOptions) => {
    const id = crypto.randomUUID()
    dispatch({ type: 'ADD', toast: { id, variant, message, action: options?.action } })
    setTimeout(() => dispatch({ type: 'DISMISS', id }), options?.duration ?? 4000)
  }, [])

  const toast = {
    success: (m: string, o?: ToastOptions) => add('success', m, o),
    error:   (m: string, o?: ToastOptions) => add('error', m, o),
    info:    (m: string, o?: ToastOptions) => add('info', m, o),
    warning: (m: string, o?: ToastOptions) => add('warning', m, o),
  }
```

**Step 2: Update `src/components/toaster.tsx`**

Add the action button rendering inside each toast. Find the toast content (lines 33-36):

```tsx
          <span className="font-bold text-base leading-none mt-0.5">{ICONS[t.variant]}</span>
          <span className="flex-1">{t.message}</span>
          <button onClick={() => dismiss(t.id)} className="opacity-50 hover:opacity-100 text-xs ml-1">✕</button>
```

Replace with:
```tsx
          <span className="font-bold text-base leading-none mt-0.5">{ICONS[t.variant]}</span>
          <span className="flex-1">{t.message}</span>
          {t.action && (
            <button
              onClick={() => { t.action!.onClick(); dismiss(t.id) }}
              className="shrink-0 rounded-md border border-current/20 px-2 py-0.5 text-xs font-semibold hover:bg-black/5 transition-colors"
            >
              {t.action.label}
            </button>
          )}
          <button onClick={() => dismiss(t.id)} className="opacity-50 hover:opacity-100 text-xs ml-1 shrink-0">✕</button>
```

**Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/lib/toast.tsx src/components/toaster.tsx
git commit -m "feat(ux): add action button support to toast system"
```

---

## Task 4: Add Delayed Delete with Undo to KPI Row

**Files:**
- Modify: `src/app/(dashboard)/manager/[employeeId]/kpis/kpi-row.tsx`

**Context:** Currently the KPI delete button is a form that directly calls the `deleteKpi` server action. We need to change it to: hide the row immediately → show undo toast → fire the server action after 5 seconds unless Undo is clicked.

**Step 1: Read the full file**

Read `src/app/(dashboard)/manager/[employeeId]/kpis/kpi-row.tsx`.

**Step 2: Convert the delete to a delayed-undo pattern**

The component needs these changes:
1. Add `useState` for `pendingDelete` (boolean) to hide the row optimistically
2. Add `useRef` for the timeout ID
3. Replace the form-based delete button with an `onClick` handler that:
   - Sets `pendingDelete = true` (hides the row)
   - Shows a toast with an Undo button
   - Starts a 5-second timeout that calls the server action
4. If Undo is clicked, clear the timeout and set `pendingDelete = false`
5. Import `useToast` from `@/lib/toast`

The delete button changes from:
```tsx
<form action={deleteKpi.bind(null, kpiId, employeeId) as unknown as (fd: FormData) => Promise<void>}>
  <Button variant="ghost" size="sm" type="submit" className="text-destructive hover:text-destructive">
    Remove
  </Button>
</form>
```

To:
```tsx
<Button
  variant="ghost"
  size="sm"
  className="text-destructive hover:text-destructive"
  onClick={handleDelete}
>
  Remove
</Button>
```

Where `handleDelete` is:
```typescript
const { toast } = useToast()
const [pendingDelete, setPendingDelete] = useState(false)
const deleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

const handleDelete = () => {
  setPendingDelete(true)
  deleteTimer.current = setTimeout(async () => {
    await deleteKpi(kpiId, employeeId)
  }, 5000)
  toast.success(`KPI removed`, {
    action: {
      label: 'Undo',
      onClick: () => {
        if (deleteTimer.current) clearTimeout(deleteTimer.current)
        setPendingDelete(false)
      },
    },
    duration: 5000,
  })
}
```

If `pendingDelete` is true, return `null` from the component (hide the row).

**Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add "src/app/(dashboard)/manager/[employeeId]/kpis/kpi-row.tsx"
git commit -m "feat(ux): add undo toast on KPI delete with 5s delay"
```

---

## Task 5: Add Delayed Delete with Undo to KPI Templates

**Files:**
- Modify: `src/app/(dashboard)/admin/kpi-templates/page.tsx`

**Context:** KPI template delete is currently an inline form with a Trash2 icon. Same delayed-undo pattern as Task 4. Since this is a server component page, the delete buttons are inline forms — we need to extract a small client component for the delete button.

**Step 1: Read the full file**

Read `src/app/(dashboard)/admin/kpi-templates/page.tsx`.

**Step 2: Create a `DeleteTemplateButton` client component**

Add at the bottom of the file (or in a separate file if needed):

```tsx
'use client'
import { useState, useRef } from 'react'
import { useToast } from '@/lib/toast'
import { Trash2 } from 'lucide-react'

function DeleteTemplateButton({ id, action }: { id: string; action: (id: string) => Promise<void> }) {
  const { toast } = useToast()
  const [hidden, setHidden] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  if (hidden) return null

  return (
    <button
      onClick={() => {
        setHidden(true)
        timer.current = setTimeout(() => action(id), 5000)
        toast.success('Template deleted', {
          action: {
            label: 'Undo',
            onClick: () => {
              if (timer.current) clearTimeout(timer.current)
              setHidden(false)
            },
          },
          duration: 5000,
        })
      }}
      className="text-destructive hover:text-destructive/80"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  )
}
```

Replace the existing inline delete form with `<DeleteTemplateButton id={t.id} action={deleteKpiTemplate} />`.

Note: Since `deleteKpiTemplate` is a server action, passing it as a prop to a client component is fine in Next.js 16.

**Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add "src/app/(dashboard)/admin/kpi-templates/page.tsx"
git commit -m "feat(ux): add undo toast on KPI template delete"
```

---

## Task 6: Add Delayed Delete with Undo to KRA Templates and KRAs

**Files:**
- Modify: `src/app/(dashboard)/admin/kra-templates/page.tsx` (if exists)
- Modify: KRA delete components (if they exist)

**Step 1: Check if KRA template/delete files exist**

```bash
find src -name "*kra*" -type f
```

If KRA template pages exist, apply the same `DeleteTemplateButton` pattern from Task 5. If they don't exist yet (KRA feature not implemented), skip this task.

**Step 2: TypeScript check and commit** (if changes made)

```bash
npx tsc --noEmit
git add -A && git commit -m "feat(ux): add undo toast on KRA template delete"
```

---

## Task 7: Create Reusable EmptyState Component

**Files:**
- Create: `src/components/empty-state.tsx`

**Step 1: Write the component**

```tsx
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon: ReactNode
  title: string
  description: string
  action?: {
    label: string
    href?: string
    onClick?: () => void
  }
  className?: string
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-16 px-6 text-center', className)}>
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 mb-4">
        {icon}
      </div>
      <h3 className="font-semibold text-slate-900 mb-1">{title}</h3>
      <p className="text-sm text-slate-500 max-w-xs mb-4">{description}</p>
      {action && (
        action.href ? (
          <Link href={action.href}>
            <Button size="sm" className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/20">
              {action.label}
            </Button>
          </Link>
        ) : (
          <Button size="sm" onClick={action.onClick} className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/20">
            {action.label}
          </Button>
        )
      )}
    </div>
  )
}
```

**Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/components/empty-state.tsx
git commit -m "feat(ux): add reusable EmptyState component"
```

---

## Task 8: Retrofit Empty States on Admin Pages (7 pages)

**Files:**
- Modify: `src/app/(dashboard)/admin/kpi-templates/page.tsx`
- Modify: `src/app/(dashboard)/admin/competencies/page.tsx`
- Modify: `src/app/(dashboard)/admin/departments/page.tsx`
- Modify: `src/app/(dashboard)/admin/cycles/page.tsx`
- Modify: `src/app/(dashboard)/admin/audit-log/page.tsx`
- Modify: `src/app/(dashboard)/admin/notifications/page.tsx`
- Modify: `src/app/(dashboard)/admin/payouts/page.tsx`

**Step 1: Read each file to find where data is empty**

For each page, find the array/list that could be empty and the current fallback (if any).

**Step 2: Add EmptyState import and replace text fallbacks**

For each page, add:
```typescript
import { EmptyState } from '@/components/empty-state'
```

Then replace the empty case. Use appropriate Lucide icons for each page. Examples:

**kpi-templates** — Replace `<p>No templates found.</p>` with:
```tsx
<EmptyState
  icon={<FileText className="h-7 w-7" />}
  title="No KPI templates yet"
  description="Create templates to standardize KPI setting across your organization."
  action={{ label: '+ New Template', href: '/admin/kpi-templates/new' }}
/>
```

**competencies** — Replace `<p>No competencies yet. Add one above.</p>` with:
```tsx
<EmptyState
  icon={<Star className="h-7 w-7" />}
  title="No competencies defined"
  description="Add competencies to evaluate behavioral and technical skills."
/>
```

**cycles** — Add empty check before the table:
```tsx
{allCycles.length === 0 ? (
  <EmptyState
    icon={<RefreshCw className="h-7 w-7" />}
    title="No review cycles yet"
    description="Create your first cycle to start the performance review process."
    action={{ label: '+ Create Cycle', href: '/admin/cycles/new' }}
  />
) : (
  // existing table
)}
```

**departments, audit-log, notifications, payouts** — Same pattern, appropriate icon and text, no CTA for read-only pages.

**Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/app/\(dashboard\)/admin/
git commit -m "feat(ux): add empty states to 7 admin pages"
```

---

## Task 9: Retrofit Empty States on HRBP + Manager + Employee Pages (8 pages)

**Files:**
- Modify: `src/app/(dashboard)/hrbp/employees/page.tsx`
- Modify: `src/app/(dashboard)/hrbp/calibration/page.tsx`
- Modify: `src/app/(dashboard)/hrbp/meetings/page.tsx`
- Modify: `src/app/(dashboard)/manager/[employeeId]/kpis/page.tsx`
- Modify: `src/app/(dashboard)/manager/[employeeId]/goals/page.tsx`
- Modify: `src/app/(dashboard)/employee/peer-reviews/page.tsx`
- Modify: `src/app/(dashboard)/employee/history/page.tsx`
- Modify: `src/app/(dashboard)/employee/profile/page.tsx`

**Step 1: Read each file, find the empty array check**

**Step 2: Add `<EmptyState>` with appropriate icon, title, description, and optional CTA**

Examples:

**manager/[id]/kpis** — when no KPIs:
```tsx
<EmptyState
  icon={<Target className="h-7 w-7" />}
  title="No KPIs set"
  description="Add KPIs to track this employee's performance goals."
  action={{ label: '+ Add KPI' }}
/>
```

**employee/peer-reviews** — when no reviews:
```tsx
<EmptyState
  icon={<Users className="h-7 w-7" />}
  title="No peer reviews yet"
  description="Peer reviews will appear here when your colleagues submit feedback."
/>
```

**Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/app/\(dashboard\)/hrbp/ src/app/\(dashboard\)/manager/ src/app/\(dashboard\)/employee/
git commit -m "feat(ux): add empty states to HRBP, manager, and employee pages"
```

---

## Task 10: Add StatCardsSkeleton and Suspense to Admin Dashboard

**Files:**
- Modify: `src/components/skeletons.tsx`
- Modify: `src/app/(dashboard)/admin/page.tsx`

**Step 1: Add `StatCardsSkeleton` to `src/components/skeletons.tsx`**

```tsx
export function StatCardsSkeleton() {
  return (
    <div className="animate-pulse grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-xl border bg-white p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="h-10 w-10 rounded-xl bg-muted" />
            <div className="h-4 w-4 rounded bg-muted/40" />
          </div>
          <div className="h-7 w-16 rounded bg-muted" />
          <div className="h-3 w-24 rounded bg-muted/60" />
          <div className="h-2.5 w-20 rounded bg-muted/40" />
        </div>
      ))}
    </div>
  )
}
```

**Step 2: Split admin dashboard into shell + content**

In `src/app/(dashboard)/admin/page.tsx`, the page currently `await`s 6+ Prisma queries before rendering anything. Split it:

1. Keep `AdminDashboard` as the shell — renders the page heading, `requireRole(['admin'])`, and a `<Suspense>` wrapper
2. Extract all data fetching + rendering into an `AdminDashboardContent` async component

```tsx
import { Suspense } from 'react'
import { StatCardsSkeleton } from '@/components/skeletons'

export default async function AdminDashboard() {
  await requireRole(['admin'])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">Overview of your performance management system</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/admin/cycles/new">
            <Button size="sm" className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/20 hover:shadow-lg hover:shadow-indigo-500/30">
              + New Cycle
            </Button>
          </Link>
        </div>
      </div>

      <Suspense fallback={<StatCardsSkeleton />}>
        <AdminDashboardContent />
      </Suspense>
    </div>
  )
}

async function AdminDashboardContent() {
  // Move ALL existing data fetching and rendering here
  const [allCycles, activeUsers, ...] = await Promise.all([...])
  // ... rest of the existing rendering code
}
```

**Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/components/skeletons.tsx "src/app/(dashboard)/admin/page.tsx"
git commit -m "feat(ux): add StatCardsSkeleton and Suspense to admin dashboard"
```

---

## Task 11: Add Suspense to Remaining Heavy Pages

**Files:**
- Modify: `src/app/(dashboard)/admin/cycles/page.tsx`
- Modify: `src/app/(dashboard)/admin/audit-log/page.tsx`
- Modify: `src/app/(dashboard)/hrbp/calibration/page.tsx`
- Modify: `src/app/(dashboard)/employee/page.tsx`

**Step 1: For each page, apply the same shell + content split**

Pattern for each:
1. Keep auth check + heading in the main export
2. Extract data fetching into `*Content` async component
3. Wrap with `<Suspense fallback={<TableSkeleton />}>` (or `<CardGridSkeleton />` for employee)

**admin/cycles** — `CyclesContent` with `TableSkeleton`
**admin/audit-log** — `AuditLogContent` with `TableSkeleton`
**hrbp/calibration** — `CalibrationContent` with `TableSkeleton`
**employee** — `EmployeeDashboardContent` with `CardGridSkeleton`

**Important:** If any `*Content` component renders a client component using `useSearchParams()`, wrap that client component in its own inner `<Suspense>` boundary.

**Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add "src/app/(dashboard)/admin/cycles/page.tsx" \
        "src/app/(dashboard)/admin/audit-log/page.tsx" \
        "src/app/(dashboard)/hrbp/calibration/page.tsx" \
        "src/app/(dashboard)/employee/page.tsx"
git commit -m "feat(ux): add Suspense streaming to 4 more heavy pages"
```

---

## Task 12: Create Onboarding Checklist Component

**Files:**
- Create: `src/components/onboarding-checklist.tsx`

**Step 1: Write the component**

A server component that receives checklist items as props and renders them in a glass card.

```tsx
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { CheckCircle2, Circle, Rocket, X } from 'lucide-react'

export interface ChecklistItem {
  label: string
  completed: boolean
  href?: string
}

interface OnboardingChecklistProps {
  items: ChecklistItem[]
  onDismiss?: string  // server action URL or form action
}

export function OnboardingChecklist({ items, onDismiss }: OnboardingChecklistProps) {
  const done = items.filter(i => i.completed).length
  const total = items.length
  const pct = Math.round((done / total) * 100)

  if (done === total) return null  // all done, auto-hide

  return (
    <div className="rounded-xl border border-indigo-100 bg-gradient-to-r from-indigo-50/80 to-violet-50/80 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Rocket className="h-5 w-5 text-indigo-600" />
          <h3 className="font-semibold text-slate-900">Getting Started</h3>
        </div>
        {onDismiss && (
          <form action={onDismiss}>
            <button type="submit" className="text-slate-400 hover:text-slate-600 transition-colors">
              <X className="h-4 w-4" />
            </button>
          </form>
        )}
      </div>

      <div className="space-y-2">
        {items.map(item => (
          <div key={item.label} className="flex items-center gap-3">
            {item.completed ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
            ) : (
              <Circle className="h-5 w-5 text-slate-300 shrink-0" />
            )}
            {item.href && !item.completed ? (
              <Link href={item.href} className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                {item.label}
              </Link>
            ) : (
              <span className={cn('text-sm', item.completed ? 'text-slate-400 line-through' : 'text-slate-700')}>
                {item.label}
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">{done} of {total} completed</span>
          <span className="font-medium text-indigo-600">{pct}%</span>
        </div>
        <div className="h-2 rounded-full bg-white/80 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  )
}
```

**Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/components/onboarding-checklist.tsx
git commit -m "feat(ux): add OnboardingChecklist component"
```

---

## Task 13: Add Onboarding Checklist to All 4 Dashboard Pages

**Files:**
- Modify: `src/app/(dashboard)/employee/page.tsx`
- Modify: `src/app/(dashboard)/manager/page.tsx`
- Modify: `src/app/(dashboard)/admin/page.tsx`
- Modify: `src/app/(dashboard)/hrbp/page.tsx` (or `hrbp/employees/page.tsx` if that's the main HRBP page)

**Step 1: For each dashboard, query checklist data and render conditionally**

Only show when `user.onboarded_at` is null. Each dashboard already has the user from `getCurrentUser()`.

**Employee dashboard:**
```tsx
import { OnboardingChecklist } from '@/components/onboarding-checklist'
import type { ChecklistItem } from '@/components/onboarding-checklist'

// Inside the page, after fetching user and cycle data:
const showOnboarding = !user.onboarded_at

let checklistItems: ChecklistItem[] = []
if (showOnboarding) {
  checklistItems = [
    { label: 'Complete your profile', completed: !!(user.department_id && user.designation), href: '/employee/profile' },
    { label: 'Review your KPIs', completed: kpis.length > 0 },
    { label: 'Submit self-review', completed: review?.status === 'submitted', href: '/employee' },
    { label: 'Give peer feedback', completed: sentFeedbackCount > 0, href: '/employee/feedback' },
  ]
}

// In the JSX, before the main content:
{showOnboarding && <OnboardingChecklist items={checklistItems} onDismiss={markUserOnboarded} />}
```

**Manager dashboard:**
```tsx
checklistItems = [
  { label: 'Set KPIs for your team', completed: allTeamHaveKpis, href: `/manager/${firstEmployeeId}/kpis` },
  { label: 'Complete manager reviews', completed: allAppraisalsSubmitted },
  { label: 'Schedule discussion meetings', completed: hasMeetings },
  { label: 'Review team goals', completed: hasVisitedGoals },
]
```

**Admin dashboard:**
```tsx
checklistItems = [
  { label: 'Add departments', completed: departments > 0, href: '/admin/departments' },
  { label: 'Add users', completed: activeUsers.length >= 2, href: '/admin/users' },
  { label: 'Create first cycle', completed: allCycles.length > 0, href: '/admin/cycles/new' },
  { label: 'Configure KPI templates', completed: hasTemplates, href: '/admin/kpi-templates' },
]
```

**HRBP dashboard:**
```tsx
checklistItems = [
  { label: 'Review employee directory', completed: hasVisitedEmployees, href: '/hrbp/employees' },
  { label: 'Complete calibration', completed: hasVisitedCalibration, href: '/hrbp/calibration' },
  { label: 'Schedule meetings', completed: hasMeetings, href: '/hrbp/meetings' },
]
```

Note: For "visited" checks, use localStorage in a client wrapper — or simplify by checking if the relevant data exists (e.g., "has calibration data" instead of "visited calibration page").

**Step 2: Wire `onDismiss` to `markUserOnboarded`**

Import the existing `markUserOnboarded` server action from `src/lib/tour-actions.ts` and pass it as `onDismiss`.

**Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

**Step 4: Full build**

```bash
npx next build 2>&1 | tail -30
```

Expected: clean build.

**Step 5: Commit and push**

```bash
git add src/app/\(dashboard\)/employee/page.tsx \
        src/app/\(dashboard\)/manager/page.tsx \
        "src/app/(dashboard)/admin/page.tsx" \
        src/app/\(dashboard\)/hrbp/
git commit -m "feat(ux): add role-specific onboarding checklists to all dashboards"
git push origin claude/charming-bouman:master
```

---

## Verification Checklist

1. `/` key opens command palette (not when typing in inputs)
2. `?` key opens shortcuts help dialog
3. `Esc` closes the shortcuts dialog
4. Toast with "Undo" button works — KPI delete shows undo, clicking Undo restores the row
5. KPI template delete shows undo toast
6. 15 pages show `<EmptyState>` when data is empty
7. Admin dashboard shows skeleton while loading
8. 4 additional pages show skeleton while loading
9. New admin sees onboarding checklist on first login
10. New employee sees role-specific checklist
11. Dismissing checklist calls `markUserOnboarded` and hides permanently
12. `npx tsc --noEmit` → zero errors
13. `npx next build` → clean build
