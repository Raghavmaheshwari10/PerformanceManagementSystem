# Bulk Actions — Implementation Plan

**Date:** 2026-04-07
**Branch:** phase-2
**Design:** `docs/plans/2026-04-07-bulk-actions-design.md`

---

## Task 1: Server action — `bulkAdvanceDepartments`

**File:** `src/app/(dashboard)/admin/cycles/[id]/actions.ts` (append)

```ts
export async function bulkAdvanceDepartments(
  cycleId: string,
  departmentIds: string[],
  currentStatus: CycleStatus,
): Promise<ActionResult<{ advanced: number }>>
```

**Logic:**
1. `requireRole(['admin', 'hrbp'])`
2. Compute `nextStatus` from `currentStatus` using the same `nextMap` pattern as `advanceDepartmentStatus`
3. Validate transition with `canTransition()` and `getTransitionRequirements()` role check
4. Run in `prisma.$transaction`:
   - `prisma.cycleDepartment.updateMany({ where: { cycle_id, department_id: { in: departmentIds }, status: currentStatus }, data: { status: nextStatus } })`
   - Return `updated.count`
5. If `updated.count === 0`, return error
6. Single audit log entry: `action: 'bulk_department_advance'`, `new_value: { departmentIds, from: currentStatus, to: nextStatus, count }`
7. For each department, call `sendTransitionNotifications(cycleId, nextStatus, departmentId)`
8. `revalidatePath` for admin/hrbp/employee/manager + cycle detail

**Reuse:** `canTransition`, `getTransitionRequirements` from `@/lib/cycle-machine`; `sendTransitionNotifications` from `../../actions` (need to export it or inline).

**Note:** `sendTransitionNotifications` is currently a private function in `admin/actions.ts`. Either export it or extract to a shared helper. Simplest: export it.

---

## Task 2: Server action — `bulkSendReminders`

**File:** `src/app/(dashboard)/admin/cycles/[id]/actions.ts` (append)

```ts
export async function bulkSendReminders(
  cycleId: string,
  departmentIds: string[],
  currentStatus: CycleStatus,
): Promise<ActionResult<{ sent: number }>>
```

**Logic:**
1. `requireRole(['admin', 'hrbp'])`
2. Determine reminder type from `currentStatus`:
   - `kpi_setting` → KPI submission reminders (employees in these depts without submitted KPIs)
   - `self_review` → self-review reminders (employees without submitted review)
   - `manager_review` → manager review reminders (managers with pending appraisals)
3. Query pending users scoped to `departmentIds`:
   - For `kpi_setting`: `prisma.user.findMany({ where: { department_id: { in: departmentIds }, is_active: true, role: 'employee' } })` then filter out those who have KPIs for this cycle
   - For `self_review`: same pattern as `sendSelfReviewReminders` but with `department_id: { in: departmentIds }`
   - For `manager_review`: same pattern as `sendManagerReviewReminders` but scoped by employee dept
4. `prisma.notification.createMany()` with appropriate type/payload
5. `dispatchPendingNotifications()` for each recipient
6. Audit log: `action: 'bulk_send_reminders'`, `new_value: { departmentIds, kind, count }`
7. `revalidatePath`

**Reuse:** Patterns from existing `sendSelfReviewReminders` and `sendManagerReviewReminders`.

---

## Task 3: Client component — `BulkActionsPanel`

**New file:** `src/app/(dashboard)/admin/cycles/[id]/bulk-actions-panel.tsx`

**Props:**
```ts
interface Props {
  cycleId: string
  deptStatuses: { departmentId: string; departmentName: string; status: CycleStatus }[]
}
```

**Behavior:**
1. Group departments by current status (e.g., 3 in `kpi_setting`, 2 in `self_review`)
2. For each status group:
   - "Select All" checkbox + individual department checkboxes
   - Show department names with employee count
3. Two action buttons (enabled when ≥1 department selected):
   - **"Advance Selected"** — shows target status label (e.g., "→ Self Review"). Calls `bulkAdvanceDepartments` with selected dept IDs + their shared status. Only departments at the SAME status can be advanced together.
   - **"Send Reminders"** — shows preview count. Calls `bulkSendReminders`. Auto-detects reminder kind from department status.
4. Confirmation dialog before each action (reuse `useConfirm`)
5. Toast on success/error (reuse `useToast`)
6. Loading states with `useTransition` or `useState`

**UI Pattern:** Collapsible panel below the "Department Stages" header. Glass card styling. Checkboxes inline with existing department cards.

**Simpler approach:** Instead of a separate panel, add checkboxes directly into the existing department cards in the cycle detail page, and a sticky action bar at the bottom when any are selected.

---

## Task 4: Integrate into cycle detail page

**File:** `src/app/(dashboard)/admin/cycles/[id]/page.tsx`

**Changes:**
1. Import `BulkActionsPanel`
2. Pass `deptStatuses` to the panel (already computed on line 29)
3. Place the panel inside the `{isDeptScoped && (...)}` block, after the department stages section header and before the individual department cards
4. Only render when `isDeptScoped && deptStatuses.length > 1` (bulk actions only make sense with multiple departments)

---

## Verification

1. Select 3 departments at `kpi_setting` → Advance → all move to `self_review`
2. Select 2 departments at `self_review` → Send Reminders → correct count of self-review reminders sent
3. Mixed selection disabled (can only select departments at same status)
4. Confirmation dialog shows before each action
5. Toast shows success with count
6. Page revalidates after action
7. Audit log entries created
