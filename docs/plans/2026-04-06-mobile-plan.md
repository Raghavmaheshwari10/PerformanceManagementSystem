# Mobile Experience Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix two critically broken wide tables on mobile, hide low-priority columns at small widths, and polish two minor review form layout issues — making all roles usable on 375px screens.

**Architecture:** Purely additive Tailwind class changes — `overflow-x-auto` wrappers on tables, `min-w-` on table elements, `hidden sm:table-cell` on non-essential columns, and two one-line breakpoint/flex changes on review forms. Zero logic changes, zero new components.

**Tech Stack:** Next.js 16, Tailwind v4, React 19

---

## Task 1: Fix Calibration Table — Horizontal Scroll

**Files:**
- Modify: `src/app/(dashboard)/hrbp/calibration/page.tsx`

**Context:** The calibration page has two tables — the main calibration table (line 160) and the exited employees table (line 237). Both use `<div className="glass overflow-hidden">` as their outer wrapper. Neither has horizontal scroll. On 375px, 6–8 columns compress into an unreadable mess.

**What to change:**

**Main calibration table wrapper (line 160):**

Find:
```tsx
      <div className="glass overflow-hidden" data-tour="override-form">
        <table className="w-full text-sm table-row-hover">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="p-3 text-left text-muted-foreground">Employee</th>
              <th className="p-3 text-left text-muted-foreground">Department</th>
              <th className="p-3 text-left text-muted-foreground">Manager Rating</th>
              <th className="p-3 text-right text-muted-foreground">MIS Score</th>
              <th className="p-3 text-left text-muted-foreground">Suggested</th>
              <th className="p-3 text-left text-muted-foreground">Final Rating</th>
```

Replace with:
```tsx
      <div className="glass overflow-x-auto" data-tour="override-form">
        <table className="w-full min-w-[640px] text-sm table-row-hover">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="p-3 text-left text-muted-foreground whitespace-nowrap">Employee</th>
              <th className="p-3 text-left text-muted-foreground whitespace-nowrap">Department</th>
              <th className="p-3 text-left text-muted-foreground whitespace-nowrap">Manager Rating</th>
              <th className="p-3 text-right text-muted-foreground whitespace-nowrap">MIS Score</th>
              <th className="p-3 text-left text-muted-foreground whitespace-nowrap">Suggested</th>
              <th className="p-3 text-left text-muted-foreground whitespace-nowrap">Final Rating</th>
```

Note: `overflow-hidden` → `overflow-x-auto`, added `min-w-[640px]` to table, added `whitespace-nowrap` to each `<th>`.

**Exited employees table wrapper (line 237):**

Find:
```tsx
          <div className="glass overflow-hidden opacity-80">
            <table className="w-full text-sm table-row-hover">
              <thead>
                <tr className="border-b border-border bg-red-500/5">
                  <th className="p-3 text-left text-muted-foreground">Employee</th>
                  <th className="p-3 text-left text-muted-foreground">Department</th>
                  <th className="p-3 text-left text-muted-foreground">Manager Rating</th>
                  <th className="p-3 text-left text-muted-foreground">Final Rating</th>
                  <th className="p-3 text-right text-muted-foreground">Proration</th>
```

Replace with:
```tsx
          <div className="glass overflow-x-auto opacity-80">
            <table className="w-full min-w-[560px] text-sm table-row-hover">
              <thead>
                <tr className="border-b border-border bg-red-500/5">
                  <th className="p-3 text-left text-muted-foreground whitespace-nowrap">Employee</th>
                  <th className="p-3 text-left text-muted-foreground whitespace-nowrap">Department</th>
                  <th className="p-3 text-left text-muted-foreground whitespace-nowrap">Manager Rating</th>
                  <th className="p-3 text-left text-muted-foreground whitespace-nowrap">Final Rating</th>
                  <th className="p-3 text-right text-muted-foreground whitespace-nowrap">Proration</th>
```

**Also** find any remaining `<th>` elements in the conditional columns (Multiplier, Payout, Override) and add `whitespace-nowrap` to them too. Read the file to find the exact lines for these conditional headers.

**Step 1: Read the full calibration page**

Read `src/app/(dashboard)/hrbp/calibration/page.tsx` to see all `<th>` elements.

**Step 2: Apply all changes above**

**Step 3: TypeScript check**
```bash
cd "C:\Users\Raghav Maheshwari\Performance-System-hRMS\.claude\worktrees\charming-bouman"
npx tsc --noEmit
```

**Step 4: Commit**
```bash
git add "src/app/(dashboard)/hrbp/calibration/page.tsx"
git commit -m "fix(mobile): add horizontal scroll to calibration tables"
```

---

## Task 2: Fix Users Table — Horizontal Scroll + Column Hiding

**Files:**
- Modify: `src/app/(dashboard)/admin/users/users-table.tsx`

**Context:** The users table at line 215 has `<div className="glass overflow-hidden">` with no horizontal scroll. 10 columns on 375px is completely unreadable. Fix: add scroll wrapper + hide `Emp Code` and `Designation` on mobile (they reappear at ≥640px).

**What to change:**

**Step 1: Read the full users-table.tsx**

Read `src/app/(dashboard)/admin/users/users-table.tsx` to find:
- The exact `<th>` for Emp Code (should be around line 225)
- The exact `<th>` for Designation (should be around line 228)
- The exact `<td>` for Emp Code in each body row
- The exact `<td>` for Designation in each body row

**Step 2: Outer wrapper**

Find (line 215):
```tsx
      <div className="glass overflow-hidden">
        <table className="w-full text-sm table-row-hover">
```

Replace with:
```tsx
      <div className="glass overflow-x-auto">
        <table className="w-full min-w-[700px] text-sm table-row-hover">
```

**Step 3: Hide Emp Code column header on mobile**

Find the Emp Code `<th>` (it will look like):
```tsx
              <th className="p-3 text-left text-muted-foreground ...">Emp Code</th>
```

Add `hidden sm:table-cell` to its className.

**Step 4: Hide Designation column header on mobile**

Find the Designation `<th>` and add `hidden sm:table-cell` to its className.

**Step 5: Hide Emp Code data cells on mobile**

In the body rows, find the `<td>` that renders `u.emp_code` (or similar). Add `hidden sm:table-cell` to its className.

**Step 6: Hide Designation data cells on mobile**

Find the `<td>` that renders `u.designation` (or similar). Add `hidden sm:table-cell` to its className.

**Step 7: Add whitespace-nowrap to all remaining visible `<th>` elements**

For each `<th>` that is NOT hidden (Name, Email, Department, Role, Status, Invite, Actions), add `whitespace-nowrap` to prevent mid-word wrapping during horizontal scroll.

**Step 8: TypeScript check**
```bash
npx tsc --noEmit
```

**Step 9: Commit**
```bash
git add "src/app/(dashboard)/admin/users/users-table.tsx"
git commit -m "fix(mobile): add horizontal scroll and hide non-essential columns on mobile for users table"
```

---

## Task 3: Manager Review Layout — Fix xl → lg Breakpoint

**Files:**
- Modify: `src/app/(dashboard)/manager/[employeeId]/review/page.tsx`

**Context:** The two-panel side-by-side layout (employee self-assessment on left, manager form on right) only activates at `xl:` (1280px). On a 1024px tablet it still stacks vertically, wasting horizontal space. Change to `lg:` so it activates at 1024px.

**Exact changes (2 lines):**

**Line 322** — Find:
```tsx
      <div className="grid gap-6 xl:grid-cols-2">
```
Replace with:
```tsx
      <div className="grid gap-6 lg:grid-cols-2">
```

**Line 324** — Find:
```tsx
        <div className="rounded-lg border bg-muted/20 p-4 space-y-4 xl:max-h-[calc(100vh-12rem)] xl:overflow-y-auto">
```
Replace with:
```tsx
        <div className="rounded-lg border bg-muted/20 p-4 space-y-4 lg:max-h-[calc(100vh-12rem)] lg:overflow-y-auto">
```

**Step 1: Apply both changes**

**Step 2: TypeScript check**
```bash
npx tsc --noEmit
```

**Step 3: Commit**
```bash
git add "src/app/(dashboard)/manager/[employeeId]/review/page.tsx"
git commit -m "fix(mobile): lower manager review two-panel breakpoint from xl to lg"
```

---

## Task 4: Competency Buttons — Add flex-wrap + Build + Push

**Files:**
- Modify: `src/app/(dashboard)/manager/[employeeId]/review/review-form.tsx`

**Context:** The 5 numbered competency rating buttons (1–5) at line 200 use `flex items-center gap-1` with no `flex-wrap`. On phones under 320px the buttons overflow the right edge of the screen.

**Exact change (1 line):**

Find (line 200):
```tsx
                    <div className="flex items-center gap-1">
```
Replace with:
```tsx
                    <div className="flex flex-wrap items-center gap-1">
```

**Step 1: Apply the change**

**Step 2: TypeScript check**
```bash
npx tsc --noEmit
```

**Step 3: Full build**
```bash
cd "C:\Users\Raghav Maheshwari\Performance-System-hRMS\.claude\worktrees\charming-bouman"
npx next build 2>&1 | tail -20
```
Expected: clean build, exit code 0.

**Step 4: Commit and push**
```bash
git add "src/app/(dashboard)/manager/[employeeId]/review/review-form.tsx"
git commit -m "fix(mobile): add flex-wrap to competency rating buttons"
git push origin claude/charming-bouman:master
```

---

## Verification Checklist

1. `npx tsc --noEmit` → zero errors
2. `npx next build` → clean build
3. Calibration page at 375px → table scrolls horizontally, headers don't wrap
4. Users table at 375px → table scrolls horizontally, Emp Code and Designation columns hidden
5. Users table at ≥640px → all 10 columns visible
6. Manager review at 1024px → two-panel side-by-side layout active
7. Competency buttons → wrap to next line on very narrow screens
