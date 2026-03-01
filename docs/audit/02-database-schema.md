# PMS Database Schema Reference

> 7 tables, 6 enums, 20 RLS policies, 5 functions, 1 trigger

---

## Entity Relationship Diagram (Text)

```
users ─────────────────────────────────────────┐
  │ id (PK)                                     │
  │ zimyo_id (UNIQUE)                           │
  │ email (UNIQUE)                              │
  │ role (user_role enum)                       │
  │ manager_id (FK → users.id)  ←── self-join   │
  │ variable_pay                                │
  ├─────────┬────────┬─────────┬───────────────┘
  │         │        │         │
  ▼         ▼        ▼         ▼
cycles    kpis    reviews   appraisals
  │         │        │         │
  │         │        │         ├─ manager_id → users
  │         │        │         ├─ final_rating_set_by → users
  │         │        │         │
  ▼         │        │         │
audit_logs ◄────────┴────────┘
  │
  ▼
notifications
  └─ recipient_id → users
```

---

## Tables

### users
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK, DEFAULT gen_random_uuid() | Matches Supabase auth.users.id |
| zimyo_id | text | UNIQUE NOT NULL | External HR system ID |
| email | text | UNIQUE NOT NULL | Login identifier |
| full_name | text | NOT NULL | Display name |
| role | user_role | NOT NULL DEFAULT 'employee' | employee/manager/hrbp/admin |
| department | text | nullable | Org unit |
| designation | text | nullable | Job title |
| manager_id | uuid | FK → users.id, nullable | Reporting hierarchy (self-join) |
| variable_pay | numeric(12,2) | DEFAULT 0 | Annual variable compensation |
| is_active | boolean | DEFAULT true | Soft-delete flag |
| synced_at | timestamptz | DEFAULT now() | Last Zimyo sync timestamp |
| created_at | timestamptz | DEFAULT now() | |

**Indexes:** `idx_users_manager(manager_id)`, `idx_users_role(role)`

### cycles
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK | |
| name | text | NOT NULL | e.g. "Q1 2026 Review" |
| quarter | text | NOT NULL | "Q1", "Q2", etc. |
| year | integer | NOT NULL | 2026, etc. |
| status | cycle_status | NOT NULL DEFAULT 'draft' | State machine (7 states) |
| kpi_setting_deadline | date | nullable | |
| self_review_deadline | date | nullable | |
| manager_review_deadline | date | nullable | |
| calibration_deadline | date | nullable | |
| published_at | timestamptz | nullable | Set when status→published |
| sme_multiplier | numeric(5,4) | CHECK 0-5, nullable | SME tier bonus multiplier |
| created_by | uuid | FK → users.id, nullable | |
| created_at | timestamptz | DEFAULT now() | |
| updated_at | timestamptz | DEFAULT now() | |

### kpis
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK | |
| cycle_id | uuid | FK → cycles.id NOT NULL | |
| employee_id | uuid | FK → users.id NOT NULL | Goal owner |
| manager_id | uuid | FK → users.id NOT NULL | Goal setter |
| title | text | NOT NULL | KPI name |
| description | text | nullable | Details |
| weight | numeric(5,2) | CHECK >0 AND <=100, nullable | Importance % |
| created_at | timestamptz | DEFAULT now() | |
| updated_at | timestamptz | DEFAULT now() | |

**Index:** `idx_kpis_cycle_employee(cycle_id, employee_id)`
**Trigger:** `kpi_weight_sum_check` - SUM(weight) per (cycle_id, employee_id) <= 100

### reviews
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK | |
| cycle_id | uuid | FK → cycles.id NOT NULL | |
| employee_id | uuid | FK → users.id NOT NULL | |
| self_rating | rating_tier | nullable | FEE/EE/ME/SME/BE |
| self_comments | text | DEFAULT '' | Free-text assessment |
| status | review_status | DEFAULT 'draft' | draft/submitted |
| submitted_at | timestamptz | nullable | |
| created_at | timestamptz | DEFAULT now() | |
| updated_at | timestamptz | DEFAULT now() | |

**Unique:** `(cycle_id, employee_id)` - one self-review per cycle
**Index:** `idx_reviews_cycle_employee(cycle_id, employee_id)`

### appraisals
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK | |
| cycle_id | uuid | FK → cycles.id NOT NULL | |
| employee_id | uuid | FK → users.id NOT NULL | |
| manager_id | uuid | FK → users.id NOT NULL | |
| manager_rating | rating_tier | nullable | Manager's rating |
| manager_comments | text | nullable | |
| manager_submitted_at | timestamptz | nullable | |
| final_rating | rating_tier | nullable | Set during calibration/lock |
| final_rating_set_by | uuid | FK → users.id, nullable | HRBP who overrode |
| payout_multiplier | numeric(5,4) | nullable | Calculated from final_rating |
| payout_amount | numeric(12,2) | nullable | variable_pay x multiplier |
| locked_at | timestamptz | nullable | When payout locked |
| is_final | boolean | NOT NULL DEFAULT false | Optimistic lock (HRBP override) |
| created_at | timestamptz | DEFAULT now() | |
| updated_at | timestamptz | DEFAULT now() | |

**Unique:** `(cycle_id, employee_id)` - one appraisal per cycle
**Indexes:** `idx_appraisals_cycle_employee`, `idx_appraisals_cycle_manager`

### audit_logs (immutable - insert only)
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK | |
| cycle_id | uuid | FK → cycles.id, nullable | |
| changed_by | uuid | FK → users.id NOT NULL | Who |
| action | text | NOT NULL | e.g. 'rating_override' |
| entity_type | text | NOT NULL | e.g. 'appraisal' |
| entity_id | uuid | nullable | PK of changed entity |
| old_value | jsonb | nullable | Before state |
| new_value | jsonb | nullable | After state |
| justification | text | nullable | Required for overrides |
| created_at | timestamptz | DEFAULT now() | |

**Index:** `idx_audit_logs_cycle(cycle_id)`

### notifications (email queue)
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK | |
| recipient_id | uuid | FK → users.id NOT NULL | |
| type | notification_type | NOT NULL | 6 event types |
| payload | jsonb | nullable | Context data |
| status | notification_status | DEFAULT 'pending' | pending/sent/failed |
| sent_at | timestamptz | nullable | |
| error_message | text | nullable | |
| created_at | timestamptz | DEFAULT now() | |

**Index:** `idx_notifications_status(status)`

---

## Enums

| Enum | Values |
|------|--------|
| user_role | `employee`, `manager`, `hrbp`, `admin` |
| cycle_status | `draft` → `kpi_setting` → `self_review` → `manager_review` → `calibrating` → `locked` → `published` |
| rating_tier | `FEE`, `EE`, `ME`, `SME`, `BE` |
| review_status | `draft`, `submitted` |
| notification_type | `cycle_kpi_setting_open`, `cycle_self_review_open`, `cycle_manager_review_open`, `cycle_published`, `review_submitted`, `manager_review_submitted` |
| notification_status | `pending`, `sent`, `failed` |

---

## RLS Policy Matrix

### users
| Policy | Role | Op | Condition |
|--------|------|----|-----------|
| users_employee_select | employee | SELECT | id = user_id() |
| users_manager_select | manager | SELECT | id = user_id() OR manager_id = user_id() |
| users_hr_select | hrbp, admin | SELECT | always |

### cycles
| Policy | Role | Op | Condition |
|--------|------|----|-----------|
| cycles_employee_select | employee | SELECT | status != 'draft' |
| cycles_staff_select | manager, hrbp, admin | SELECT | always |
| cycles_admin_insert | admin, hrbp | INSERT | always |
| cycles_admin_update | admin, hrbp | UPDATE | always |

### kpis
| Policy | Role | Op | Condition |
|--------|------|----|-----------|
| kpis_employee_select | employee | SELECT | employee_id = user_id() AND cycle non-draft |
| kpis_manager_select | manager | SELECT | employee_id = user_id() OR manager_id = user_id() |
| kpis_manager_insert | manager | INSERT | manager_id = user_id() AND cycle in kpi_setting |
| kpis_manager_update | manager | UPDATE | manager_id = user_id() AND cycle in kpi_setting |
| kpis_hr_select | hrbp, admin | SELECT | always |
| kpis_hr_insert | hrbp, admin | INSERT | always |
| kpis_hr_update | hrbp, admin | UPDATE | always |

### reviews
| Policy | Role | Op | Condition |
|--------|------|----|-----------|
| reviews_employee_select | employee | SELECT | employee_id = user_id() |
| reviews_employee_insert | employee | INSERT | employee_id = user_id() AND cycle in self_review |
| reviews_employee_update | employee | UPDATE | employee_id = user_id() AND status=draft AND cycle in self_review |
| reviews_manager_select | manager | SELECT | employee reports to user AND cycle in manager_review+ |
| reviews_hr_select | hrbp, admin | SELECT | always |

### appraisals (strictest)
| Policy | Role | Op | Condition |
|--------|------|----|-----------|
| appraisals_employee_select | employee | SELECT | employee_id = user_id() AND cycle published |
| appraisals_manager_select | manager | SELECT | manager_id = user_id() |
| appraisals_manager_insert | manager | INSERT | manager_id = user_id() AND cycle in manager_review |
| appraisals_manager_update | manager | UPDATE | manager_id = user_id() AND cycle in manager_review |
| appraisals_hr_select | hrbp, admin | SELECT | always |
| appraisals_hr_update | hrbp, admin | UPDATE | cycle in calibrating |

### audit_logs
- INSERT: `WITH CHECK (true)` (any authenticated)
- SELECT: hrbp, admin only

### notifications
- INSERT: `WITH CHECK (true)` (service role)
- SELECT: hrbp, admin
- UPDATE: hrbp, admin

---

## Functions

| Function | Purpose | Called From |
|----------|---------|------------|
| `public.user_role()` | Extract role from JWT claims | Every RLS policy |
| `public.user_id()` | Extract user_id from JWT claims | Every RLS policy |
| `public.custom_access_token_hook(event)` | Inject user_role + user_id into JWT | Supabase Auth (on token issue) |
| `public.check_kpi_weight_sum()` | Enforce SUM(weight) <= 100 per employee/cycle | Trigger on kpis |
| `public.bulk_lock_appraisals(cycle_id, sme_multiplier)` | Bulk-set final ratings and payouts | HRBP lockCycle() |
| `public.bulk_update_manager_links(zimyo_ids[], manager_ids[])` | Bulk manager reassignment | Admin Zimyo sync |

---

## Known Schema Issues

1. **FEE multiplier = 0** in bulk_lock_appraisals (should be ~1.25-2.0)
2. **Payout multiplier duplicated** in PL/pgSQL function AND TypeScript constants
3. **No cascade/SET NULL** on user deletion (orphaned FK references)
4. **is_active not checked in RLS** (soft-deleted users can still access data)
5. **No circular manager check** (A manages B, B manages A possible)
6. **Manager reassignment mid-cycle** breaks RLS access
7. **Missing indexes**: audit_logs(changed_by), notifications(recipient_id)
8. **No retention policy** for audit_logs or notifications (unbounded growth)
