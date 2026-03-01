-- 1. DB-level constraints
ALTER TABLE kpis ADD CONSTRAINT kpis_weight_bounds CHECK (weight IS NULL OR (weight > 0 AND weight <= 100));
ALTER TABLE cycles ADD CONSTRAINT cycles_sme_multiplier_bounds CHECK (sme_multiplier IS NULL OR (sme_multiplier >= 0 AND sme_multiplier <= 5));

-- 2. is_final column — set true when HRBP finalises; blocks manager re-submission overwrite
ALTER TABLE appraisals ADD COLUMN is_final boolean NOT NULL DEFAULT false;

-- 3. Composite index on reviews
CREATE INDEX IF NOT EXISTS idx_appraisals_cycle_manager ON appraisals(cycle_id, manager_id);

-- 4. KPI weight sum trigger
CREATE OR REPLACE FUNCTION check_kpi_weight_sum()
RETURNS TRIGGER AS $$
DECLARE total numeric;
BEGIN
  SELECT COALESCE(SUM(weight), 0) INTO total
  FROM kpis
  WHERE cycle_id = NEW.cycle_id AND employee_id = NEW.employee_id
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
  IF total + COALESCE(NEW.weight, 0) > 100 THEN
    RAISE EXCEPTION 'Total KPI weight would exceed 100%% (current: %, adding: %)', total, COALESCE(NEW.weight, 0);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER kpi_weight_sum_check BEFORE INSERT OR UPDATE ON kpis FOR EACH ROW EXECUTE FUNCTION check_kpi_weight_sum();

-- 5. Bulk lock appraisals — single UPDATE JOIN, no N+1 in lockCycle
-- Skips is_final=true appraisals (already overridden by HRBP)
CREATE OR REPLACE FUNCTION bulk_lock_appraisals(p_cycle_id uuid, p_sme_multiplier numeric)
RETURNS void AS $$
BEGIN
  UPDATE appraisals a
  SET
    final_rating = COALESCE(a.final_rating, a.manager_rating),
    payout_multiplier = CASE COALESCE(a.final_rating, a.manager_rating)
      WHEN 'BE'  THEN 0
      WHEN 'ME'  THEN 1.0
      WHEN 'EE'  THEN 1.5
      WHEN 'FEE' THEN 0
      WHEN 'SME' THEN 1.0 + p_sme_multiplier
      ELSE 0
    END,
    payout_amount = u.variable_pay * CASE COALESCE(a.final_rating, a.manager_rating)
      WHEN 'BE'  THEN 0
      WHEN 'ME'  THEN 1.0
      WHEN 'EE'  THEN 1.5
      WHEN 'FEE' THEN 0
      WHEN 'SME' THEN 1.0 + p_sme_multiplier
      ELSE 0
    END,
    locked_at = now()
  FROM users u
  WHERE a.cycle_id = p_cycle_id
    AND a.employee_id = u.id
    AND a.is_final = false
    AND COALESCE(a.final_rating, a.manager_rating) IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Bulk manager-link update — single UPDATE with unnest, no N+1 in Zimyo sync
CREATE OR REPLACE FUNCTION bulk_update_manager_links(p_zimyo_ids text[], p_manager_ids uuid[])
RETURNS void AS $$
BEGIN
  UPDATE users u
  SET manager_id = m.manager_id
  FROM (SELECT unnest(p_zimyo_ids) AS zimyo_id, unnest(p_manager_ids) AS manager_id) m
  WHERE u.zimyo_id = m.zimyo_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

