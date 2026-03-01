-- Fix incorrect payout multipliers in bulk_lock_appraisals:
--   FEE was 0   -> corrected to 1.25
--   EE  was 1.5 -> corrected to 1.10
-- SME dynamic calculation (1.0 + sme_multiplier) is preserved.
-- NOTE: Migration 00012 replaces this with the full budget-aware version.

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
    payout_amount = u.variable_pay * CASE COALESCE(a.final_rating, a.manager_rating)
      WHEN 'BE'  THEN 0
      WHEN 'ME'  THEN 1.0
      WHEN 'EE'  THEN 1.10
      WHEN 'FEE' THEN 1.25
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