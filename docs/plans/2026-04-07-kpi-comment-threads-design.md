# KPI Comment Threads Design

**Date:** 2026-04-07
**Branch:** phase-2
**Status:** Approved

---

## Overview

Add per-KPI comment threads enabling manager-employee discussion during reviews. Comments are immutable, scoped to `self_review` and `manager_review` phases, and read-only thereafter.

## Schema

New model: `KpiComment`

```prisma
model KpiComment {
  id         String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  kpi_id     String   @db.Uuid
  author_id  String   @db.Uuid
  body       String
  created_at DateTime @default(now()) @db.Timestamptz(6)

  kpi    Kpi  @relation(fields: [kpi_id], references: [id], onDelete: Cascade)
  author User @relation("KpiCommentAuthor", fields: [author_id], references: [id])

  @@index([kpi_id, created_at])
}
```

- Cascade delete with KPI
- No editing or deleting — immutable for audit integrity
- Index on `kpi_id + created_at` for efficient thread loading

## Access Rules

| Phase | Employee | Manager | HRBP/Admin |
|-------|----------|---------|------------|
| `self_review` | Can comment | Can comment | Read-only |
| `manager_review` | Can comment | Can comment | Read-only |
| All other phases | Read-only | Read-only | Read-only |

Only the KPI's employee and manager can post comments. HRBP and admin have read access for audit and calibration.

## Notifications

- In-app only (no email) via existing notification system
- When employee comments, manager gets notified (and vice versa)
- Notification type: `kpi_comment` with payload `{ kpi_id, kpi_title, commenter_name }`

## Server Actions

- `addKpiComment(kpiId, body)` — validates cycle phase, author is employee/manager of that KPI, creates comment, sends in-app notification
- `fetchKpiComments(kpiId)` — returns comments ordered by `created_at` asc with author name and role

## UI

- Collapsible comment thread below each KPI row in both self-review and manager review forms
- Chat-style list: author name, role badge, relative timestamp, body
- Text input + "Comment" button at bottom (hidden when read-only)
- Comment count badge on collapsed state
- No rich text — plain text only
