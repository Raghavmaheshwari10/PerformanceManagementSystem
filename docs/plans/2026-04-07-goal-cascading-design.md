# Goal Cascading Design

**Date:** 2026-04-07
**Branch:** phase-2
**Status:** Approved

---

## Overview

3-level goal cascade: Org Goals → Department Goals → Individual KPIs. Connects strategic objectives to existing KPI infrastructure. Automatic progress rollup from KPI scores. No changes to existing KPI workflow.

## Hierarchy

```
Org Goal (company-wide strategic objective)
  └── Dept Goal (department-level objective, linked to org goal)
        └── Kpi (existing individual KPIs, linked via optional dept_goal_id)
```

## Schema

Two new models. One FK added to existing `Kpi` model.

```prisma
model OrgGoal {
  id          String     @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  title       String
  description String?
  cycle_id    String?    @db.Uuid
  created_by  String     @db.Uuid
  created_at  DateTime   @default(now()) @db.Timestamptz(6)
  updated_at  DateTime   @default(now()) @updatedAt @db.Timestamptz(6)

  cycle      Cycle?     @relation(fields: [cycle_id], references: [id])
  creator    User       @relation("OrgGoalCreator", fields: [created_by], references: [id])
  dept_goals DeptGoal[]

  @@map("org_goals")
}

model DeptGoal {
  id            String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  title         String
  description   String?
  org_goal_id   String   @db.Uuid
  department_id String   @db.Uuid
  created_by    String   @db.Uuid
  created_at    DateTime @default(now()) @db.Timestamptz(6)
  updated_at    DateTime @default(now()) @updatedAt @db.Timestamptz(6)

  org_goal   OrgGoal    @relation(fields: [org_goal_id], references: [id], onDelete: Cascade)
  department Department @relation(fields: [department_id], references: [id])
  creator    User       @relation("DeptGoalCreator", fields: [created_by], references: [id])
  kpis       Kpi[]

  @@map("dept_goals")
}
```

Existing `Kpi` model gets:
```prisma
dept_goal_id String?  @db.Uuid
dept_goal    DeptGoal? @relation(fields: [dept_goal_id], references: [id], onDelete: SetNull)
```

## Permissions

| Action | Admin | HRBP | Manager | Employee |
|--------|-------|------|---------|----------|
| Create/edit org goals | Yes | No | No | No |
| Create/edit dept goals | Yes | Yes | No | No |
| Link KPIs to dept goals | No | No | Yes | No |
| View cascade | Yes (all) | Yes (all) | Yes (direct reports) | No |

Employees see KPI linkage on existing KPI/review pages — no dedicated route.

## Progress Rollup (Automatic, Read-Only)

- **Dept goal %** = weighted average of linked KPI scores (using existing KPI weights). Only computed after cycle is published.
- **Org goal %** = equal-weight average of linked dept goal percentages.
- **Unlinked KPIs** don't affect any goal. Unlinked dept goals show 0%.
- Progress is read-only — no manual override.

KPI score source: `appraisals.final_score` (post-calibration) when available, else `reviews.manager_rating` normalized to 0-100.

## Routes

| Route | Role | Scope |
|-------|------|-------|
| `/admin/goal-cascading` | Admin | Org-wide, full CRUD |
| `/hrbp/goal-cascading` | HRBP | Org-wide, create dept goals |
| `/manager/goal-cascading` | Manager | Direct reports, link KPIs |

## UI Layout

Single client component `GoalCascadingDashboard` with `role` prop.

1. **Summary cards** — Total org goals, avg completion %, depts on track vs behind, unlinked KPIs count
2. **Tree view** — Expandable rows: org goal → dept goals → KPIs. Each row shows title, progress bar, status indicator.
3. **Filters** — Cycle selector (default: latest published), department filter (admin/HRBP only)

### Admin/HRBP extras
- Create/edit org goal modal (admin only)
- Create/edit dept goal modal (admin + HRBP)
- Assign dept goal to department via dropdown

### Manager view
- Read-only tree scoped to their department
- KPI linking: dropdown on each KPI row to select a dept goal (or unlink)

## Data Layer

New file: `src/lib/db/goal-cascading.ts`

- `fetchOrgGoals(cycleId?)` — org goals with dept goals and linked KPI counts
- `fetchGoalTree(cycleId?, options?)` — full tree with progress computed. Options: `departmentId`, `managerId`
- `fetchGoalStats(cycleId?)` — summary card aggregates
- `createOrgGoal(data)` / `updateOrgGoal(id, data)` / `deleteOrgGoal(id)`
- `createDeptGoal(data)` / `updateDeptGoal(id, data)` / `deleteDeptGoal(id)`
- `linkKpiToDeptGoal(kpiId, deptGoalId)` / `unlinkKpi(kpiId)`

## Server Actions

File: `src/app/(dashboard)/admin/goal-cascading/actions.ts`

- `saveOrgGoal(formData)` — Zod-validated, admin only
- `saveDeptGoal(formData)` — Zod-validated, admin + HRBP
- `deleteGoal(id, type)` — admin only for org goals, admin + HRBP for dept goals
- `linkKpi(kpiId, deptGoalId)` — manager only, validates KPI ownership
- `unlinkKpi(kpiId)` — manager only
