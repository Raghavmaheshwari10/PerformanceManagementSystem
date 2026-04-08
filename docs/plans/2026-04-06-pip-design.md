# PIP (Performance Improvement Plan) Feature Design

**Date:** 2026-04-06
**Branch:** phase-2
**Status:** Approved

---

## Overview

A full formal PIP module for the hRMS Performance Management System. Managers and HRBPs can initiate PIPs for underperforming employees, either independently or triggered from cycle results. PIPs include structured milestones with HRBP sign-off, lightweight check-ins, document attachments, employee acknowledgment, and escalation paths.

## Data Model

### New Enums

- **PipStatus**: `draft | active | extended | completed | closed`
- **PipOutcome**: `improved | partially_improved | not_improved`

### New Models

#### Pip
- `id` UUID PK
- `employee_id` → User
- `manager_id` → User
- `initiated_by` → User (manager or HRBP who created it)
- `hrbp_id` → User (assigned HRBP)
- `cycle_id` → Cycle (optional, null if independent)
- `skip_level_manager_id` → User (auto-resolved from manager's manager)
- `reason` text
- `start_date` date
- `end_date` date
- `status` PipStatus (default: draft)
- `outcome` PipOutcome (nullable)
- `employee_acknowledged_at` timestamptz (nullable)
- `escalation_note` text (nullable, for not_improved outcome)
- `auto_flag_next_cycle` boolean (default: true)
- `created_at`, `updated_at` timestamptz

#### PipMilestone
- `id` UUID PK
- `pip_id` → Pip
- `title` string
- `description` text (nullable)
- `target_metric` string (measurable target)
- `due_date` date
- `status`: `pending | in_progress | completed | missed`
- `hrbp_signed_off_at` timestamptz (nullable)
- `hrbp_signed_off_by` → User (nullable)
- `sort_order` int
- `created_at` timestamptz

#### PipCheckIn
- `id` UUID PK
- `pip_id` → Pip
- `created_by` → User
- `check_in_date` date
- `progress_rating` int (1-5)
- `notes` text
- `next_steps` text (nullable)
- `employee_response` text (nullable)
- `created_at` timestamptz

#### PipDocument
- `id` UUID PK
- `pip_id` → Pip
- `uploaded_by` → User
- `file_name` string
- `file_url` string
- `file_type` string
- `description` string (nullable)
- `created_at` timestamptz

## Routes & Access Control

| Route | Role | Capabilities |
|-------|------|-------------|
| `/admin/pip` | Admin | View all PIPs org-wide, export, view stats, settings |
| `/hrbp/pip` | HRBP | View department PIPs, sign off milestones, initiate PIPs |
| `/manager/pip` | Manager | View direct reports' PIPs, initiate PIPs, add check-ins |
| Employee dashboard | Employee | View own PIP banner/card, acknowledge, respond to check-ins |

### Visibility Rules
- Employee: own PIP only
- Manager: direct reports' PIPs
- HRBP: PIPs in assigned departments
- Admin: all PIPs
- Skip-level manager: read-only view of skip-level reports' PIPs

## PIP Lifecycle

```
draft → active → completed/extended → closed
                    ↓
              (if extended, loops back to active)
```

- **Draft**: Created by manager/HRBP with milestones. Employee not notified.
- **Active**: HRBP approves draft. Employee notified + must acknowledge.
- **Extended**: End date passed, outcome unclear. New end date set, returns to active.
- **Completed**: All milestones reviewed, outcome assigned (improved/partially_improved/not_improved).
- **Closed**: Final HRBP sign-off. If not_improved + auto_flag_next_cycle → flags employee in next cycle.

## Auto-Suggest from Cycle Results

- When cycle publishes → scan for SME/BE employees
- Show "PIP Recommended" badge on manager team view + HRBP department view
- Click badge → pre-filled PIP draft with cycle linked, reason auto-populated
- No auto-creation — always requires human initiation

## Not Improved → Auto-Flag

- outcome = not_improved + auto_flag_next_cycle = true
- Visual flag in next cycle's manager review + calibration views
- Notification to admin + HRBP

## UI Design

### PIP Dashboard (3 tabs)
1. **Active PIPs**: table with employee, department, dates, days remaining, milestone progress bar, status
2. **History**: completed/closed PIPs with outcome badge, search + date filter
3. **Settings** (admin-only): auto-suggest tiers, default duration, reminder frequency

### PIP Detail Page
- Header: employee info, status, date range, progress ring
- Milestones: timeline view with HRBP sign-off status
- Check-ins: chronological list with progress dots + employee responses
- Documents: upload/download list
- Actions bar: add check-in, add milestone, change status, assign outcome (role-gated)

### Employee Dashboard Integration
- Alert banner when PIP active
- Card: milestones, next check-in, days remaining
- Acknowledge button + check-in response ability

## Server Actions

| Action | Role | Description |
|--------|------|-------------|
| createPip | manager, hrbp | Create draft PIP |
| activatePip | hrbp | Draft → active, notify employee |
| acknowledgePip | employee (own) | Set acknowledged_at |
| addMilestone | manager, hrbp | Add milestone to PIP |
| updateMilestoneStatus | manager, hrbp | Update milestone status |
| signOffMilestone | hrbp | HRBP sign-off on milestone |
| addCheckIn | manager, hrbp | Add check-in with rating + notes |
| respondToCheckIn | employee (own) | Add employee response |
| extendPip | manager, hrbp | Extend end date |
| completePip | hrbp | Assign outcome, complete |
| closePip | hrbp, admin | Final sign-off, auto-flag if needed |
| uploadDocument | manager, hrbp | Upload attachment |
| exportPipCsv | admin, hrbp | Export CSV |

All actions use Zod validation + audit logging.
