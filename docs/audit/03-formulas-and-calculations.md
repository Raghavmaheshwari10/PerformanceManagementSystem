# PMS Formulas & Calculations

---

## 1. Current Rating-to-Multiplier Mapping

Used in: `bulk_lock_appraisals()` (PL/pgSQL) + `getPayoutMultiplier()` (TypeScript)

| Rating | Full Name | Fixed Multiplier | Notes |
|--------|-----------|-----------------|-------|
| FEE | Far Exceeds Expectations | 0.00 | **BUG: Should be ~1.25-2.0** |
| EE | Exceeds Expectations | 1.50 | |
| ME | Meets Expectations | 1.00 | Baseline |
| SME | Subject Matter Expert | 1.0 + sme_multiplier | Variable per cycle |
| BE | Below Expectations | 0.00 | No payout |

**SME Multiplier**: Set per cycle by admin (range 0-5). Example: if sme_multiplier = 0.5, SME payout = 1.5x.

### Suggested Fix for FEE

```
FEE → 1.25 (fixed, highest tier)
  or
FEE → configurable per cycle (like SME)
```

---

## 2. Payout Calculation

### Current Formula

```
payout_amount = variable_pay x payout_multiplier
```

Where:
- `variable_pay` = users.variable_pay (annual variable compensation)
- `payout_multiplier` = from rating mapping above

### Example

| Employee | Variable Pay | Final Rating | Multiplier | Payout |
|----------|-------------|--------------|------------|--------|
| Bob | 100,000 | EE | 1.50 | 150,000 |
| Dave | 100,000 | ME | 1.00 | 100,000 |
| Eve | 100,000 | SME (0.5) | 1.50 | 150,000 |
| Grace | 100,000 | BE | 0.00 | 0 |

---

## 3. Proposed: Full Compensation Formula

### Industry Standard: Merit Matrix

A merit matrix uses two dimensions:
1. **Performance rating** (horizontal)
2. **Compa-ratio** (vertical) = current salary / midpoint of pay band

```
Merit Increase % = LOOKUP(compa_ratio_band, rating_tier)
```

Example matrix:

| Compa-Ratio | BE | ME | SME | EE | FEE |
|-------------|----|----|-----|----|-----|
| < 0.80 | 0% | 3% | 5% | 7% | 10% |
| 0.80-0.95 | 0% | 2% | 4% | 6% | 8% |
| 0.95-1.05 | 0% | 1.5% | 3% | 5% | 6% |
| 1.05-1.20 | 0% | 1% | 2% | 3% | 4% |
| > 1.20 | 0% | 0.5% | 1% | 2% | 3% |

### Proposed: Variable Pay with Business Factor

```
payout_amount = variable_pay
              x performance_multiplier    (from rating)
              x business_multiplier       (company/BU factor, 0.8 - 1.2)
```

This would require:
- New column `cycles.business_multiplier` (or per-department)
- UI for admin to set business multiplier when creating cycle

---

## 4. KPI Weight Calculation

### Current
- Each KPI has a weight (1-100%)
- DB trigger enforces: SUM(weight) per (cycle_id, employee_id) <= 100%
- Weights are informational only (not used in rating calculation)

### Proposed: Weighted KPI Score

If we add per-KPI ratings, the overall score can be calculated:

```
weighted_score = SUM(kpi_weight x kpi_rating_value) / SUM(kpi_weight)
```

Where `kpi_rating_value` maps to:
| Rating | Numeric Value |
|--------|--------------|
| FEE | 5 |
| EE | 4 |
| SME | 3 |
| ME | 2 |
| BE | 1 |

Example:
| KPI | Weight | Rating | Score |
|-----|--------|--------|-------|
| Code Quality | 40% | EE (4) | 1.60 |
| Delivery | 35% | ME (2) | 0.70 |
| Innovation | 25% | SME (3) | 0.75 |
| **Total** | **100%** | | **3.05** → maps to SME |

### Score-to-Rating Mapping
| Score Range | Rating |
|-------------|--------|
| 4.5 - 5.0 | FEE |
| 3.5 - 4.49 | EE |
| 2.5 - 3.49 | SME |
| 1.5 - 2.49 | ME |
| 1.0 - 1.49 | BE |

---

## 5. Bell Curve Distribution Targets

### Current
- Bell curve chart shows actual distribution during calibration
- No targets or enforcement

### Proposed: Soft Distribution Targets

| Rating | Target % | Allowed Range |
|--------|----------|---------------|
| FEE | 5% | 0-10% |
| EE | 20% | 10-30% |
| SME | 50% | 35-65% |
| ME | 20% | 10-30% |
| BE | 5% | 0-10% |

Implementation:
- Store targets in `cycles` table or separate `distribution_targets` table
- Show current vs target on calibration page
- Warn (don't block) when distribution deviates beyond allowed range

---

## 6. Notification Trigger Points

### Current (implemented in code)
| Event | Notification Type | Recipients |
|-------|------------------|------------|
| Cycle advances to self_review | cycle_self_review_open | All employees |
| Employee submits self-review | review_submitted | Employee's manager |
| Manager submits rating | manager_review_submitted | All HRBPs |
| Cycle published | cycle_published | All active users |

### Proposed (not yet implemented)
| Event | Type | Recipients | Timing |
|-------|------|------------|--------|
| KPI setting deadline -7d | deadline_reminder | All managers | Automated |
| Self-review deadline -7d | deadline_reminder | Employees with draft/no review | Automated |
| Self-review deadline -1d | deadline_urgent | Same as above | Automated |
| Self-review overdue | deadline_overdue | Employee + manager | Daily |
| Manager review deadline -3d | deadline_reminder | Managers with pending reviews | Automated |
| Calibration complete | calibration_complete | All managers | On lock |

---

## 7. Cycle State Machine Transitions

```
draft ──────────► kpi_setting ──────────► self_review
  (admin/hrbp)     (admin/hrbp)           (admin/hrbp)
                                               │
                                               ▼
published ◄──── locked ◄──── calibrating ◄── manager_review
  (hrbp)         (hrbp)       (admin/hrbp)    (admin/hrbp)
```

Each transition:
1. Validates current status matches expected (prevents race conditions)
2. Checks caller role is in `allowedRoles` for that transition
3. Creates audit_log entry
4. Sets `published_at` on final transition

---

## 8. Payroll Export Format

CSV columns for locked/published cycles:

```csv
zimyo_employee_id,employee_name,department,final_rating,payout_multiplier,payout_amount
Z004,Bob Employee,Engineering,EE,1.5000,150000.00
Z005,Dave Employee,Engineering,ME,1.0000,100000.00
```

All fields escaped per RFC 4180 (quoted if containing commas/quotes/newlines).
