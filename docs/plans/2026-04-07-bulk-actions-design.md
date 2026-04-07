# Bulk Actions Feature Design

**Date:** 2026-04-07
**Branch:** phase-2
**Status:** Approved

---

## Overview

Add bulk department advance and bulk reminder sending to the existing cycle detail page. No new schema — uses existing CycleDepartment, Notification, and AuditLog models.

## Bulk Department Advance

- Departments grouped by current status on the cycle detail page
- Each group has "Select All" checkbox + individual department checkboxes
- "Advance Selected" button shows target status
- Confirmation dialog before execution
- Server action: validates each transition, advances in transaction, sends transition notifications
- Single audit log entry with all department IDs

## Bulk Reminders

- Same department grouping/selection UI
- "Send Reminders" button with preview count ("Will send to 24 employees across 3 depts")
- Auto-detects reminder type by department status:
  - kpi_setting → KPI submission reminders
  - self_review → self-review reminders
  - manager_review → manager review reminders
- Uses existing notifyUsers() helper
- Audit log with recipient count

## Implementation

- 2 new server actions: bulkAdvanceDepartments, bulkSendReminders
- 1 new client component: BulkActionsPanel
- Modify: cycle detail page to include BulkActionsPanel
- No schema changes
