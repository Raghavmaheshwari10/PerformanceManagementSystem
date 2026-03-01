# UX Help & Feedback System Design
**Date:** 2026-03-01
**Scope:** All roles (admin, manager, employee, hrbp)
**Approach:** Option 1 — built from scratch, zero new dependencies

---

## Goals

1. Every button explains what is happening — before destructive actions, during long operations, after completion
2. In-app help system — no separate pages, everything stays within the application
3. Guided first-time walkthroughs per role, replayable on demand

---

## Architecture

Three self-contained systems wired into the existing dashboard layout:

```
src/
  lib/
    toast.tsx              ← useToast hook + ToastContext
    confirm.tsx            ← useConfirm hook + ConfirmContext
    tour.tsx               ← useTour hook + TourContext (localStorage state)
    help-content.ts        ← Static help articles keyed by route
  components/
    toaster.tsx            ← Global toast renderer (mounted in root layout)
    confirm-dialog.tsx     ← Confirm dialog (mounted in root layout)
    tour-engine.tsx        ← Spotlight overlay + step popover (mounted in root layout)
    help-panel.tsx         ← Right-side Sheet: page context + search + tour trigger
    help-button.tsx        ← Floating ? button fixed bottom-right on all pages
```

**Root layout** (`src/app/(dashboard)/layout.tsx`) wraps in `ToastProvider`, `ConfirmProvider`, `TourProvider` and renders `<Toaster>`, `<ConfirmDialog>`, `<TourEngine>`, `<HelpButton>` once globally.

**Per-page work:** wrap destructive buttons with `useConfirm`, add `pendingLabel` to `SubmitButton`, call `useToast` after server actions, register tour `data-tour` attributes on target elements.

---

## System 1: Action Feedback

### 1a — Toast (`useToast` + `<Toaster>`)

- Context-driven toast stack, bottom-right corner
- Four variants: `success`, `error`, `info`, `warning`
- Auto-dismisses after 4s with slide-out animation
- Stacks up to 3; oldest dismissed first when overflow

```ts
// Usage
const { toast } = useToast()
toast.success('Cycle advanced to Manager Review. 8 managers notified.')
toast.error('Failed to send reminders — please try again.')
toast.info('15 users imported successfully.')
```

Applied to all server action callbacks across every page.

### 1b — Confirm Dialog (`useConfirm`)

- Promise-based: `const ok = await confirm({...})` returns `boolean`
- Renders a shadcn `<Dialog>` with: title, one-sentence consequence description, Cancel + coloured Confirm button
- `variant: 'destructive'` → red Confirm; `variant: 'default'` → primary blue

```ts
// Usage
const { confirm } = useConfirm()
const ok = await confirm({
  title: 'Advance to Manager Review?',
  description: 'This will notify all 8 managers to begin reviewing their team. Employees can no longer edit their self-reviews.',
  confirmLabel: 'Advance',
  variant: 'destructive',
})
if (!ok) return
// proceed with action
```

**Applied to these actions:**

| Action | Trigger | Description shown |
|--------|---------|-------------------|
| Advance Cycle | Admin cycle detail | Explains next stage + who gets notified |
| Lock Cycle | HRBP calibration | Ratings become final, no more overrides |
| Publish Cycle | HRBP calibration | Results visible to all employees |
| Send Self-Review Reminders | Admin cycle detail | Emails N pending employees |
| Send Manager Reminders | Admin cycle detail | Emails N managers |
| Import CSV | Admin users upload | Overwrites matched users by email |
| Toggle Feature Flag (destructive) | Admin feature flags | Global effect warning |

### 1c — Descriptive SubmitButton loading states

Extend existing `SubmitButton` with a `pendingLabel` prop (string shown while `useFormStatus().pending` is true):

| Button label | `pendingLabel` |
|---|---|
| Advance to KPI Setting | Moving cycle forward… |
| Submit Self-Review | Saving your review… |
| Submit Manager Review | Submitting your rating… |
| Send Reminders | Notifying employees… |
| Import Users | Importing rows… |
| Lock Cycle | Locking ratings… |
| Publish Results | Publishing to employees… |
| Send Notification | Sending message… |
| Save Template | Saving template… |

---

## System 2: Help Panel

### 2a — Floating Help Button (`<HelpButton>`)

- Fixed position: `bottom-6 right-6`, `z-50`
- Circular button with `?` icon, shadow, matches primary colour
- On click: opens `<HelpPanel>` Sheet
- Visible on all dashboard pages for all roles

### 2b — Help Panel (`<HelpPanel>`)

Right-side Sheet, 400px wide. Three sections:

**"On this page"** — 3–5 bullets explaining current page purpose and what to do. Content in `src/lib/help-content.ts`, keyed by pathname pattern.

**Search** — text input filtering flat list of all help articles across all routes. Articles are plain `{ title, body, route }` objects — no database.

**"Take a tour"** — button shown only when a tour is defined for current page. Closes panel and starts walkthrough.

**Sidebar Help link** — existing Help nav item in employee/manager sidebars now opens `<HelpPanel>` instead of navigating away. Admin sidebar gets a Help item added.

### Help content map (route → bullets)

| Route | Summary bullets |
|-------|----------------|
| `/employee` | What self-review is; how ratings work; deadline awareness; what happens after submission |
| `/manager` | How to review your team; KPI weight meaning; what rating scale means; calibration stage |
| `/manager/[id]/kpis` | Adding KPIs from templates; weight must sum to 100%; what happens when cycle advances |
| `/manager/[id]/review` | Left = employee's view; right = your rating; what FEE/EE/ME/SME/BE mean |
| `/admin` | Dashboard overview; cycle health interpretation; people panel |
| `/admin/cycles` | Cycle lifecycle stages; when to advance; what each stage unlocks |
| `/admin/cycles/[id]` | Per-employee status table; how reminders work; advance requirements |
| `/admin/users` | CSV import format; Zimyo sync; role vs status |
| `/admin/kpi-templates` | Templates vs live KPIs; category meanings; weight guidance |
| `/admin/notifications` | Scope options; admin_message vs system notifications |
| `/hrbp` | Calibration entry point; cycle state requirements |
| `/hrbp/calibration` | Bell curve interpretation; override workflow; lock vs publish difference |

---

## System 3: Tour Engine

### 3a — `<TourEngine>` component

- Full-screen overlay with `pointer-events: none` except the cut-out and popover
- Cut-out: transparent `box-shadow` inset mask around target element (found via `data-tour="step-id"` attribute)
- Popover card: 320px wide, positioned adjacent to target (auto-flips if near edge). Contains: step title, body text, step counter ("Step 2 of 4"), Skip and Next/Finish buttons
- Smooth scroll to target element before showing each step
- Tour state machine: `idle → active(stepIndex) → done`
- Completion stored in `localStorage`: key `pms:tour:{tourId}:done = '1'`
- "Take a tour" in Help Panel resets key and restarts

### 3b — Tour definitions

Tours defined in `src/lib/tour-content.ts` as typed config:

```ts
type TourStep = { id: string; title: string; body: string; target: string }
type Tour = { id: string; route: string | RegExp; steps: TourStep[] }
```

**5 tours:**

**`employee-review`** — `/employee`
1. ActionInbox: "Your action items — this card tells you exactly what to do right now"
2. KPI list: "Your KPIs — these are the goals you'll be rated against"
3. Self-review form: "Rate yourself honestly — your manager will see this alongside their own assessment"
4. Submit button: "Once submitted, your review is locked — make sure you're happy before clicking"

**`manager-team`** — `/manager`
1. Team table: "Your team's review status at a glance — red means overdue"
2. KPI button: "Set and review KPIs before the self-review stage opens"
3. Review button: "Submit your rating here after the employee has completed their self-review"
4. Overdue banner: "This appears when reviews are past their deadline — act quickly"

**`manager-kpis`** — `/manager/[id]/kpis`
1. Template picker: "Start from a template — these are pre-approved KPIs for this role"
2. Weight field: "Weights must sum to 100 — they determine how much each KPI counts"
3. Add KPI button: "Add custom KPIs specific to this employee's goals"

**`admin-cycles`** — `/admin/cycles`
1. Create cycle: "Start here — a cycle covers one review period (usually a quarter)"
2. Stage badge: "Cycles move through 7 stages — you advance them manually when ready"
3. Advance button: "Advancing notifies the right people and opens the next stage"

**`hrbp-calibrate`** — `/hrbp/calibration`
1. Bell curve: "Distribution of manager ratings — look for clustering or outliers"
2. Override form: "Override a final rating here if calibration suggests adjustment"
3. Lock button: "Locking freezes all ratings — no more overrides after this"
4. Publish button: "Publishing makes results visible to employees"

---

## Data Flow

```
User clicks button
  → useConfirm (if destructive) → Dialog → user confirms
  → SubmitButton enters pending → pendingLabel displayed
  → Server action runs
  → Returns ActionResult<T>
  → useToast called with success/error message
  → Toast appears bottom-right, auto-dismisses

User visits page for first time
  → TourEngine checks localStorage for tour completion
  → If not done: auto-starts tour after 800ms delay
  → User navigates steps via Next button
  → On Finish: localStorage key set, overlay removed

User clicks ? button / Help sidebar link
  → HelpPanel Sheet opens
  → Shows "On this page" bullets for current pathname
  → Search filters all articles in real time
  → "Take a tour" button resets localStorage + starts tour
```

---

## What is NOT changing

- No new database tables or server actions needed
- Existing `SubmitButton`, `HelpTooltip`, `HelpDrawer` components preserved (HelpDrawer replaced functionally by HelpPanel)
- No external dependencies added
- Existing shadcn `Dialog` and `Sheet` primitives reused
- All tour content is static — no CMS or admin UI for tours

---

## Files to create / modify

**New files:**
- `src/lib/toast.tsx`
- `src/lib/confirm.tsx`
- `src/lib/tour.tsx`
- `src/lib/help-content.ts`
- `src/lib/tour-content.ts`
- `src/components/toaster.tsx`
- `src/components/confirm-dialog.tsx`
- `src/components/tour-engine.tsx`
- `src/components/help-panel.tsx`
- `src/components/help-button.tsx`

**Modified files:**
- `src/app/(dashboard)/layout.tsx` — add providers + global components
- `src/components/submit-button.tsx` — add `pendingLabel` prop
- `src/components/sidebar.tsx` — sidebar Help link → opens panel; add Help to admin nav
- All action pages — add `useConfirm`, `useToast`, `pendingLabel`, `data-tour` attributes
