# Competency Gap Report Design

**Date:** 2026-04-07
**Branch:** phase-2
**Status:** Approved

---

## Overview

Dedicated competency gap report showing where employees need development. Query-time aggregation from existing `review_responses` data — no schema changes. Includes heatmap, radar chart, multi-cycle trend chart, sortable employee table, and CSV export.

## Audience

- Admin & HRBP: org-wide view with department filter
- Manager: scoped to direct reports only
- Employees: not included (they see ratings on their review results)

## Data Source

All data from existing tables:
- `review_responses` — individual 1-5 ratings per competency question
- `review_questions` — links questions to competencies
- `competencies` — competency names, categories (core/functional/leadership), department scope
- `reviews` — links responses to employees and cycles
- Manager ratings are used as the authoritative assessment

## Data Layer

New file: `src/lib/db/competency-gaps.ts`

- `fetchCompetencyGapData(cycleId, options?)` — per-employee per-competency manager ratings. Options: `managerId`, `departmentId`
- `fetchCompetencyTrends(competencyIds)` — average rating per competency across all published cycles for trend lines
- `fetchCompetencyGapStats(cycleId, options?)` — aggregates: avg per competency, avg per department, lowest-scoring competencies

## Visualizations

1. **Heatmap** — Rows = departments (admin/hrbp) or employees (manager). Columns = competencies. Color = avg rating (red 1-2, amber 3, green 4-5).
2. **Radar chart** — Spider chart per department or employee showing competency profile shape. Selector to pick entity.
3. **Trend line chart** — X = published cycles, Y = avg rating. One line per competency. Shows development progress over time.

## Routes

| Route | Role | Scope |
|-------|------|-------|
| `/admin/competency-gaps` | Admin | Org-wide, filter by dept |
| `/hrbp/competency-gaps` | HRBP | Org-wide, filter by dept |
| `/manager/competency-gaps` | Manager | Direct reports only |

## UI Layout

Single client component `CompetencyGapDashboard` with `role` prop:

1. **Filters** — Cycle selector (default: latest published), department filter (admin/hrbp), competency category filter
2. **Summary cards** — Lowest-rated competency, highest gap department, overall avg score
3. **Heatmap** — Department x competency grid or employee x competency grid
4. **Radar chart** — Per-department or per-employee competency spider
5. **Trend chart** — Multi-cycle line chart for selected competencies
6. **Employee table** — Sortable, competencies as columns, CSV export button

## CSV Export

Server action `exportCompetencyGapCsv(cycleId, options?)` — columns: Employee, Department, then one column per competency with rating. Reuses existing `downloadCsv()` utility.

## No Schema Changes

Pure read queries on existing tables. No new models or migrations.
