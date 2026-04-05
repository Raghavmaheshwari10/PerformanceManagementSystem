# Design: Mobile Experience

**Date:** 2026-04-06
**Status:** Approved
**Stack:** Next.js 16, React 19, TypeScript, Tailwind v4
**Target:** All roles (Employee, Manager, HRBP, Admin) on 375px+ screens

---

## Scope

Three targeted improvements:

1. Fix two critically broken tables (calibration, users) with scroll wrappers + column hiding
2. Two small review form fixes (breakpoint + flex-wrap)

Explicitly out of scope: sidebar (already excellent), KPI setting (already responsive), payout table (already has overflow-x-auto), self-review form (already well-built).

---

## Part 1 — Calibration Table

**File:** `src/app/(dashboard)/hrbp/calibration/page.tsx`

**Problem:** 6–8 column table with no `overflow-x-auto` wrapper. Completely unreadable on 375px.

**Fix:**
- Wrap both tables (main + exited employees) in `<div className="overflow-x-auto rounded-lg border">` containers
- Add `min-w-[640px]` to each `<table>` so it scrolls cleanly rather than collapsing
- Add `whitespace-nowrap` to `<th>` elements so headers don't wrap mid-word during scroll
- Remove existing border from table element (border moves to wrapper)

No column hiding needed — calibration is HRBP/Admin only and the data density is intentional.

---

## Part 2 — Users Table

**File:** `src/app/(dashboard)/admin/users/users-table.tsx`

**Problem:** 10-column table with no `overflow-x-auto` wrapper. Completely unreadable on 375px.

**Fix:**
- Wrap the main table in `<div className="overflow-x-auto rounded-lg border">`
- Add `min-w-[700px]` to `<table>`
- Add `whitespace-nowrap` to `<th>` elements
- Hide two low-priority columns at mobile: `Emp Code` and `Designation` get `hidden sm:table-cell` on both `<th>` and `<td>` — they reappear at ≥640px
- Remove existing border from table element (border moves to wrapper)

Column visibility at mobile: Checkbox · Name · Email · Department · Role · Status · Invite · Actions (8 columns → readable)
Column visibility at ≥sm: All 10 columns

---

## Part 3 — Review Form Polish

### Manager Review Layout Breakpoint

**File:** `src/app/(dashboard)/manager/[employeeId]/review/page.tsx`

**Problem:** Side-by-side two-panel layout (employee info left, manager form right) triggers at `xl:` (1280px). On 1024px tablets it still stacks.

**Fix:** Change `xl:grid-cols-2` → `lg:grid-cols-2` and `xl:max-h-[...]` / `xl:overflow-y-auto` → `lg:max-h-[...]` / `lg:overflow-y-auto` so the two-panel view appears at 1024px.

### Competency Rating Buttons

**File:** `src/app/(dashboard)/manager/[employeeId]/review/review-form.tsx`

**Problem:** 5 numbered rating buttons + inline label have no `flex-wrap`. On phones <320px they overflow the right edge.

**Fix:** Add `flex-wrap` to the competency rating button container so buttons wrap to a new line on very narrow screens.

---

## New Files

None — all changes are surgical edits to existing files.

## Files Modified

| File | Change |
|------|--------|
| `src/app/(dashboard)/hrbp/calibration/page.tsx` | overflow-x-auto wrapper on both tables |
| `src/app/(dashboard)/admin/users/users-table.tsx` | overflow-x-auto wrapper + hide emp-code/designation on mobile |
| `src/app/(dashboard)/manager/[employeeId]/review/page.tsx` | xl: → lg: breakpoint |
| `src/app/(dashboard)/manager/[employeeId]/review/review-form.tsx` | flex-wrap on competency buttons |
