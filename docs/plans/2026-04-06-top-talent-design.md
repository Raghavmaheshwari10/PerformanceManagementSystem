# Top Talent Feature — Design Document

**Date**: 2026-04-06
**Branch**: `phase-2`
**Status**: Approved

## Context

The hRMS Performance Management System has mature appraisal, scoring, and calibration infrastructure but no way to identify and track top performers across cycles. HR leadership (admins, HRBPs) needs a dedicated view to see who their best people are, how the talent pool is changing, and configure what "top talent" means for their org. Managers need the same view scoped to their team.

## Requirements

- **Access**: Admin (org-wide) + HRBP (org-wide) + Manager (own direct reports)
- **Criteria**: Configurable by admin (rating tiers, min consecutive cycles, score/MIS thresholds)
- **Data**: Full performance profile per employee
- **Visuals**: Full dashboard with tabs, charts, cards, leaderboard, sortable table
- **Export**: CSV export of talent pool

## Routes

| Route | Role | Scope |
|-------|------|-------|
| `/admin/top-talent` | Admin | All employees, org-wide + Settings tab |
| `/hrbp/top-talent` | HRBP | All employees, org-wide |
| `/manager/top-talent` | Manager | Own direct reports only |

**Sidebar placement**: After "Reports" (admin/hrbp), after "Team Reports" (manager).

## Schema

```prisma
model TopTalentConfig {
  id              String   @id @default(uuid())
  rating_tiers    String[] // e.g. ["FEE", "EE"]
  min_cycles      Int      @default(1)
  score_threshold Int      @default(0)
  mis_threshold   Int      @default(0)
  updated_by      String?
  updated_at      DateTime @default(now()) @updatedAt

  updater         User?    @relation(fields: [updated_by], references: [id])
}
```

Single-row config table. Defaults work out of the box.

## Data Layer

**File**: `src/lib/db/top-talent.ts`

### Functions

| Function | Purpose |
|----------|---------|
| `fetchTopTalentConfig()` | Get config row (create default if missing) |
| `saveTopTalentConfig(data)` | Upsert config (admin only) |
| `fetchTopTalentPool(filters)` | Get qualifying employees with full profile |
| `fetchTopTalentStats(filters)` | Aggregate stats for charts |

### Employee Profile Shape

```ts
{
  id, fullName, email, department, designation, managerId, managerName,
  currentCycle: { finalRating, compositeScore, misScore, payoutAmount, multiplier },
  goalCompletion: number,    // % of goals completed/approved
  competencyAvg: number,     // avg competency score 0-100
  peerReviewAvg: number,     // avg peer rating
  feedbackCount: number,
  trend: 'up' | 'down' | 'same' | null,
  consecutiveHighCycles: number,
  cycleHistory: Array<{ cycleName, finalRating, compositeScore }>
}
```

### Scoping

- Admin/HRBP: no department/manager filter
- Manager: `WHERE manager_id = currentUser.id`

## Dashboard UI

**Shared component**: `<TopTalentDashboard>` with `role` prop.

### Tabs

| Tab | Content |
|-----|---------|
| **Overview** | Top 10 leaderboard + KPI cards (total, % of org, avg score, top dept) + bell curve |
| **By Department** | Stacked bar chart + dept breakdown table |
| **Trends** | Pool size line chart across cycles + movement table (entered/exited pool) |
| **Employees** | Full sortable table + CSV export |
| **Settings** | Config form (admin only) |

### Top 10 Leaderboard (Overview tab hero)

- Ranked 1-10 by composite score from latest published cycle
- Shows: rank, name, department, final rating badge, composite score, trend arrow
- Gold/silver/bronze accent for top 3
- Admin/HRBP: org-wide. Manager: team-scoped.

### Employee Table Columns

Name, Department (hidden for manager), Designation, Final Rating, Trend, Composite Score, MIS Score, Goal Completion %, Competency Avg, Peer Review Avg, Feedback Count, Consecutive High Cycles, Payout (admin/hrbp only).

**Filters**: Cycle selector, department dropdown (admin/hrbp), rating tier filter.

### Reused Components

- `ReportDashboard` tab pattern
- `BellCurveChart` for distribution
- `CycleTrendChart` for trends
- `DeptHeatmapChart` for dept breakdown
- `RATING_BADGE` color map
- `downloadCsv()` for export
- `.glass .glass-interactive .glass-accent` card styling
- `.table-row-hover` table styling
- `<EmptyState>` for no-data states

## Server Actions

**File**: `src/app/(dashboard)/admin/top-talent/actions.ts`

| Action | Access | Purpose |
|--------|--------|---------|
| `saveTopTalentConfig(formData)` | Admin | Update config with Zod validation |
| `exportTopTalentCsv(cycleId)` | Admin, HRBP | Generate CSV download |

## Verification

1. Admin saves config -> persists and reloads correctly
2. Overview: top 10 leaderboard ranks correctly by composite score
3. Overview: KPI cards show accurate counts, bell curve matches distribution
4. By Department: breakdown matches calibration page data
5. Trends: pool size across cycles is accurate
6. Employees: table sortable, all columns render, CSV exports correctly
7. Manager sees only direct reports, no Settings tab, no payout column
8. Empty state renders when no published cycles exist
9. Unit tests on `fetchTopTalentPool` with mocked Prisma
