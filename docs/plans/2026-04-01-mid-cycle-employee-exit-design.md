# Mid-Cycle Employee Exit Handling

## Context

When an employee exits (is deactivated) during an active performance cycle, the system needs to gracefully handle their in-progress KPIs, reviews, and payouts. The approach is "Freeze at exit" — preserve whatever state they were in, allow manager to optionally rate them, and prorate payouts.

## Trigger

When an admin sets `is_active = false` on a user, the system automatically freezes all their active cycle participations and records the exit date.

## Schema Changes

### Appraisal Model — New Fields

```prisma
exited_at        DateTime?  @db.Timestamptz(6)   // When employee was marked as exited
proration_factor Decimal?   @db.Decimal(5, 4)    // e.g., 0.8333 for 75/90 days
is_exit_frozen   Boolean    @default(false)       // Prevents further employee-side changes
```

## Proration Formula

```
proration_factor = days_worked_in_cycle / total_cycle_days

days_worked = exit_date - cycle_start_date (capped at cycle end)
total_cycle_days = cycle_end_date - cycle_start_date

payout = variable_pay × rating_multiplier × proration_factor
```

## Flow by Phase at Exit

| Phase at Exit | Behavior |
|---------------|----------|
| KPI Setting | KPIs frozen as-is. Manager can still edit if needed before finalization |
| Self-Review | Marked as N/A. Any saved draft preserved but submission not required |
| Manager Review | Employee shown with "Exited" badge. Manager rating is optional — can skip |
| Calibration | If manager rated → included in calibration with proration visible. If not rated → excluded from calibration |
| Payout | `payout = variable_pay × rating_multiplier × proration_factor` |

## Auto-Freeze Logic (on user deactivation)

When admin deactivates a user:

1. Find all cycles where the user has an appraisal and cycle status is NOT `published`
2. For each active appraisal:
   - Set `exited_at = now()`
   - Set `is_exit_frozen = true`
   - Calculate `proration_factor` based on days worked vs total cycle days
3. If the user had a pending self-review, mark the review status appropriately
4. Log the exit in `audit_log` with action `employee_exited_cycle`
5. Notify the employee's manager via notification system

## UI Changes

### Admin → Users Page
- When deactivating a user who has active cycles, show confirmation dialog:
  *"This employee has an active cycle (cycle_name). Their cycle participation will be frozen at the current stage."*
- After deactivation, the user row shows "Inactive" badge

### Manager → Review Page
- Exited employees shown with amber "Exited on [date]" badge
- Rating form is available but not required — "Skip" button available
- If skipped, employee gets no rating and no payout

### Manager → Team Overview
- Exited employees shown at bottom with muted styling and "Exited" tag

### HRBP → Calibration Page
- Exited employees in a separate "Exited Employees" section below active employees
- Proration factor shown as a column (e.g., "83%")
- Can be included/excluded from bell curve distribution
- Payout column shows prorated amount

### Employee Dashboard
- If deactivated user accesses the system, they see their frozen data as read-only
- Banner: "Your account has been deactivated. Contact HR for questions."

## Guard Rails

- `is_exit_frozen = true` blocks: self-review submission, draft saving, achievement updates
- Manager can still rate an exited employee (optional)
- HRBP can still override/calibrate an exited employee's rating
- Exited employees cannot be re-added to a cycle (must create new cycle)
- Proration factor is calculated once at exit time and stored — not recalculated

## Notifications

On employee exit from cycle:
- Manager receives: "[Employee Name] has exited during [Cycle Name]. You may optionally complete their review."
- HRBP receives: "[Employee Name] exited [Cycle Name]. Proration factor: X%"

## Edge Cases

1. **Employee exits on day 1** → proration_factor ≈ 0, effectively no payout even if rated
2. **Employee exits after self-review submitted** → Self-review preserved, manager can use it for rating
3. **Employee exits after manager review** → Rating preserved, proration applied at payout
4. **Employee reactivated** → `is_exit_frozen` must be manually cleared by admin. Proration factor recalculated or removed
5. **Multiple active cycles** → All non-published cycles are frozen independently

## Files to Modify

1. `prisma/schema.prisma` — Add 3 fields to Appraisal model
2. `src/app/(dashboard)/admin/users/actions.ts` — Hook into user deactivation
3. `src/lib/db/appraisals.ts` — Update bulkLockAppraisals to apply proration
4. `src/app/(dashboard)/manager/[employeeId]/review/page.tsx` — Exit badge + skip option
5. `src/app/(dashboard)/hrbp/calibration/page.tsx` — Separate exited section
6. `src/app/(dashboard)/employee/page.tsx` — Read-only mode for frozen state
7. `src/app/(dashboard)/employee/actions.ts` — Guard against frozen submissions
8. `src/lib/email.ts` — Add exit notification templates
