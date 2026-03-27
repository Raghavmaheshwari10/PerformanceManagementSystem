# AOP + Monthly MIS Integration — Design Document

**Date:** 2026-03-27
**Status:** Approved
**Goal:** Integrate Annual Operating Plan (AOP) targets and Monthly MIS actuals from an external MIS tool into the PMS, enabling auto-scored performance reviews backed by real data.

---

## Architecture Overview

```
MIS Tool (external)              PMS (this app)
├── AOP targets (company/dept/   ├── KRAs / KPIs
│   individual, BSC categories)  ├── Review cycles & ratings
├── Monthly actuals              ├── Mirrors MIS data locally
└── API ─────────────────────>   ├── Maps KPIs ↔ MIS targets
                                 ├── Auto-scores at review time
                                 └── Dashboards (admin/mgr/emp/hrbp)
```

**Key decisions:**
- AOP ownership lives in the MIS tool (not PMS)
- PMS is a full mirror — syncs targets + actuals into local tables
- API integration (not shared DB) between MIS and PMS
- Both tools built simultaneously; PMS defines the API contract

---

## Data Model

### New Tables

#### AopTarget (synced from MIS)
| Field | Type | Description |
|-------|------|-------------|
| id | UUID | PMS internal ID |
| external_id | String | MIS tool's target ID (for idempotent sync) |
| fiscal_year | Int | e.g., 2026 |
| level | Enum | "company", "department", "individual" |
| department_id | UUID? | FK → Department (null for company-level) |
| employee_id | UUID? | FK → User (null for company/dept-level) |
| metric_name | String | e.g., "Total Revenue", "Sprint Velocity" |
| category | String | BSC pillar: financial, operational, people, customer, process |
| annual_target | Decimal | Full-year target value |
| unit | String | "INR_lakhs", "percent", "count", "score", "story_points" |
| currency | String? | "INR", "USD" (null for non-financial) |
| monthly_targets | JSON | `{1: 350, 2: 380, ... 12: 450}` |
| ytd_actual | Decimal? | Auto-calculated from MisActuals |
| red_threshold | Decimal | Below this % = red (default 80) |
| amber_threshold | Decimal | Below this % = amber (default 95) |
| synced_at | DateTime | Last sync timestamp |

#### MisActual (monthly actuals from MIS)
| Field | Type | Description |
|-------|------|-------------|
| id | UUID | PK |
| aop_target_id | UUID | FK → AopTarget |
| year | Int | 2026 |
| month | Int | 1-12 |
| actual_value | Decimal | Monthly actual |
| ytd_actual | Decimal? | Cumulative YTD from MIS |
| notes | String? | Optional context |
| synced_at | DateTime | Sync timestamp |
| @@unique | [aop_target_id, year, month] | One actual per target per month |

#### KpiMisMapping (links PMS KPIs to MIS targets)
| Field | Type | Description |
|-------|------|-------------|
| id | UUID | PK |
| kpi_id | UUID | FK → Kpi |
| aop_target_id | UUID | FK → AopTarget |
| weight_factor | Decimal | Default 1.0, for partial attribution |
| score_formula | String | "linear", "capped", "inverse" |
| @@unique | [kpi_id, aop_target_id] | No duplicate mappings |

#### MisSyncLog (audit trail)
| Field | Type | Description |
|-------|------|-------------|
| id | UUID | PK |
| sync_type | String | "targets" or "actuals" |
| status | String | "success", "partial", "failed" |
| records_synced | Int | Count of upserted records |
| records_failed | Int | Count of failures |
| error_message | String? | Error details if any |
| triggered_by | UUID? | FK → User (admin who triggered, null for cron) |
| started_at | DateTime | |
| completed_at | DateTime? | |

#### MisConfig (admin settings — singleton row)
| Field | Type | Description |
|-------|------|-------------|
| id | UUID | PK (single row) |
| api_base_url | String | MIS tool API base URL |
| api_key_encrypted | String | Encrypted API key |
| fiscal_year | Int | Active fiscal year |
| auto_sync_enabled | Boolean | Default true |
| sync_cron | String | Cron expression, default "0 6 * * *" |
| department_mapping | JSON | `{"TECH": "dept-uuid-1", "SALES": "dept-uuid-2"}` |
| updated_at | DateTime | |

#### ScoringConfig (rating thresholds)
| Field | Type | Description |
|-------|------|-------------|
| id | UUID | PK |
| rating_tier | RatingTier | FEE, EE, ME, SME, BE |
| min_score | Decimal | Minimum % to qualify (e.g., 95 for EE) |
| is_active | Boolean | Default true |
| @@unique | [rating_tier] | |

Default thresholds: FEE ≥ 110%, EE ≥ 95%, ME ≥ 80%, SME ≥ 60%, BE < 60%

### Modified Tables

#### Appraisal — add fields:
- `mis_score` (Decimal? 5,2) — weighted achievement % from MIS data
- `suggested_rating` (RatingTier?) — auto-mapped from mis_score
- `override_reason` (String?) — manager's justification if they override

---

## API Contract (MIS Tool → PMS)

### Authentication
- API key auth: `Authorization: Bearer <API_KEY>`
- PMS stores key in MisConfig (encrypted) + env var fallback

### Endpoint 1: Fetch AOP Targets
```
GET {base_url}/api/v1/aop/targets?fiscal_year=2026&updated_since=ISO8601
```
Response: paginated array of target objects with fields matching AopTarget columns.
Key fields: id (external), level, department_code, employee_email, metric_name, category, annual_target, monthly_targets (JSON), red_threshold, amber_threshold.

### Endpoint 2: Fetch Monthly Actuals
```
GET {base_url}/api/v1/mis/actuals?fiscal_year=2026&month=3&updated_since=ISO8601
```
Response: paginated array with target_id (external), year, month, actual_value, ytd_actual, notes.

### Endpoint 3: Health Check
```
GET {base_url}/api/v1/health → { "status": "ok" }
```

### Matching Logic
- Departments matched by code via `MisConfig.department_mapping`
- Employees matched by email (`User.email`)
- Targets matched by `external_id` (idempotent upsert)

---

## Sync Mechanism

### Two Modes
1. **Manual:** Admin clicks "Sync Now" on `/admin/mis`
2. **Scheduled:** Daily cron (configurable), default 6 AM

### Sync Flow
1. Fetch targets from MIS API (delta via `updated_since`)
2. Match department_code → PMS department via mapping table
3. Match employee_email → PMS user
4. Upsert AopTarget records (by external_id)
5. Fetch actuals for current month
6. Upsert MisActual records
7. Recalculate ytd_actual on AopTarget
8. Auto-map new targets to KPIs (fuzzy title match, manager reviews)
9. Log everything to MisSyncLog

### Error Handling
- API down → log "failed", retry next run, show admin banner
- Partial failures → continue valid records, log "partial"
- No data loss (upsert pattern, never delete on sync)

---

## Auto-Scoring Engine

### When
Triggered when review cycle reaches `manager_review` status, or on-demand by admin.

### Algorithm
```
For each employee in cycle:
  1. Find all KpiMisMappings for their KPIs
  2. For each mapped KPI:
     raw = ytd_actual / (proportional_target_to_date) × 100
     Apply score_formula:
       "linear"  → raw %
       "capped"  → min(raw, 100)
       "inverse" → (target / actual) × 100  (cost metrics)
     weighted_score = formula_result × (kpi.weight / total_mapped_weight)
  3. mis_score = sum of weighted_scores (0-100+)
  4. Map to rating tier via ScoringConfig thresholds
  5. Store: appraisal.mis_score, appraisal.suggested_rating
```

### Manager Review UI
```
System suggests: EE (97.2%)
Based on 4 mapped KPIs:
  Revenue Target:    99% (weight 30%) → 29.7
  Sprint Velocity:   95% (weight 25%) → 23.8
  Client NPS:        90% (weight 25%) → 22.5
  Code Quality:      85% (weight 20%) → 17.0
  ─────────────────────────────────────
  Weighted total:    93.0% → EE

[Accept EE]  [Override ▾]
If override → must provide justification text
```

### Calibration View (HRBP)
Shows both columns: auto-score (MIS) + manager rating, highlighting overrides.

---

## Pages & UI

### New Pages
| Route | Role | Purpose |
|-------|------|---------|
| `/admin/mis` | Admin | Sync dashboard, target overview, unmapped alerts |
| `/admin/mis/settings` | Admin | API config, thresholds, dept mapping, sync schedule |
| `/admin/mis/mappings` | Admin | All KPI↔MIS mappings across org |
| `/manager/mis` | Manager | Team MIS performance, month picker, RAG status |
| `/employee/mis` | Employee | Personal targets, 12-month trend charts |
| `/hrbp/mis` | HRBP | Department MIS overview, variance reports |

### Modified Pages
| Page | Change |
|------|--------|
| Manager KPI setting (`/manager/[id]/kpis`) | "Link to MIS" dropdown per KPI |
| Manager review (`/manager/[id]/review`) | Auto-score sidebar with breakdown |
| HRBP calibration (`/hrbp/calibration`) | Auto-score + manager rating columns |
| Employee dashboard (`/employee`) | MIS summary card with YTD achievement |

### Dashboard Components
- 12-month bar chart (SVG, actual bars + target line overlay)
- RAG badges (green/amber/red based on thresholds)
- Animated counters for YTD achievement %
- Month picker for navigating historical data
- Sparkline mini-charts in table rows
- All using existing glass/obsidian design system

---

## Industry Context

This design places the PMS at SAP SuccessFactors level:
- **AOP → KRA → KPI cascade** with MIS data backing
- **Monthly granularity** (most mid-market PMS tools are quarterly/annual only)
- **Auto-scoring with override** (calibration-assisted, reduces bias)
- **BSC framework** (Financial + Operational + People + Customer + Process)
- **API integration** with external MIS (not manual Excel imports)

Genuine differentiator vs Darwinbox, Keka, Lattice — none offer structured MIS-to-PMS integration.
