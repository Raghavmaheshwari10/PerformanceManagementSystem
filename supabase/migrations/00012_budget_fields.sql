-- Budget fields: per-cycle business multiplier + budget metadata,
-- plus snapshotted variable pay on appraisals.

-- 1. Cycle budget columns
ALTER TABLE cycles
  ADD COLUMN business_multiplier numeric NOT NULL DEFAULT 1.0
    CHECK (business_multiplier >= 0 AND business_multiplier <= 2.0);

ALTER TABLE cycles ADD COLUMN total_budget numeric;

ALTER TABLE cycles
  ADD COLUMN budget_currency text NOT NULL DEFAULT 'INR';

-- 2. Snapshotted variable pay
ALTER TABLE appraisals ADD COLUMN snapshotted_variable_pay numeric;

-- 3. Trigger: auto-populate snapshotted_variable_pay on INSERT
CREATE OR REPLACE FUNCTION snapshot_variable_pay()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.snapshotted_variable_pay IS NULL THEN
    SELECT variable_pay
      INTO NEW.snapshotted_variable_pay
      FROM users
     WHERE id = NEW.employee_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER appraisal_snapshot_var_pay
  BEFORE INSERT ON appraisals
  FOR EACH ROW
  EXECUTE FUNCTION snapshot_variable_pay();

-- 4. Full budget-aware bulk_lock_appraisals
CREATE OR REPLACE FUNCTION bulk_lock_appraisals(p_cycle_id uuid, p_sme_multiplier numeric)
RETURNS void AS $$
BEGIN
  UPDATE appraisals a
  SET
    final_rating = COALESCE(a.final_rating, a.manager_rating),
    payout_multiplier = CASE COALESCE(a.final_rating, a.manager_rating)
      WHEN 'BE'  THEN 0
      WHEN 'ME'  THEN 1.0
      WHEN 'EE'  THEN 1.10
      WHEN 'FEE' THEN 1.25
      WHEN 'SME' THEN 1.0 + p_sme_multiplier
      ELSE 0
    END,
    payout_amount = (
      COALESCE(a.snapshotted_variable_pay, u.variable_pay)
      * CASE COALESCE(a.final_rating, a.manager_rating)
          WHEN 'BE'  THEN 0
          WHEN 'ME'  THEN 1.0
          WHEN 'EE'  THEN 1.10
          WHEN 'FEE' THEN 1.25
          WHEN 'SME' THEN 1.0 + p_sme_multiplier
          ELSE 0
        END
      * COALESCE(c.business_multiplier, 1.0)
    ),
    locked_at = now()
  FROM users u
  JOIN cycles c ON c.id = p_cycle_id
  WHERE a.cycle_id = p_cycle_id
    AND a.employee_id = u.id
    AND a.is_final = false
    AND COALESCE(a.final_rating, a.manager_rating) IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;