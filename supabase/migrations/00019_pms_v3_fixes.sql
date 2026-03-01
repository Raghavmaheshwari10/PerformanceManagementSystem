-- Migration 00019: PMS v3 fixes
-- Fixes 5 issues found after migration 00018 was applied.

-- ============================================================
-- FIX 1 (Critical): Add IS NOT NULL guard to bulk_lock_appraisals
-- Appraisals with NULL final_rating AND NULL manager_rating must
-- be skipped (not locked with zero payout).
-- ============================================================

CREATE OR REPLACE FUNCTION public.bulk_lock_appraisals(p_cycle_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fee_mult  numeric;
  v_ee_mult   numeric;
  v_me_mult   numeric;
  v_sme_base  numeric;
  v_biz_mult  numeric;
  v_sme_extra numeric;
BEGIN
  SELECT
    COALESCE(c.fee_multiplier, (SELECT multiplier FROM payout_config WHERE rating_tier = 'FEE')),
    COALESCE(c.ee_multiplier,  (SELECT multiplier FROM payout_config WHERE rating_tier = 'EE')),
    COALESCE(c.me_multiplier,  (SELECT multiplier FROM payout_config WHERE rating_tier = 'ME')),
    (SELECT multiplier FROM payout_config WHERE rating_tier = 'SME'),
    COALESCE(c.business_multiplier, 1.0),
    COALESCE(c.sme_multiplier, 0)
  INTO v_fee_mult, v_ee_mult, v_me_mult, v_sme_base, v_biz_mult, v_sme_extra
  FROM cycles c WHERE c.id = p_cycle_id;

  -- Lock non-final rows: compute final_rating + payout
  -- GUARD: skip appraisals with no rating at all (both final_rating and manager_rating are NULL)
  UPDATE appraisals a
  SET
    final_rating      = COALESCE(a.final_rating, a.manager_rating),
    payout_multiplier = CASE COALESCE(a.final_rating, a.manager_rating)
                          WHEN 'FEE' THEN v_fee_mult
                          WHEN 'EE'  THEN v_ee_mult
                          WHEN 'ME'  THEN v_me_mult
                          WHEN 'SME' THEN v_sme_base + v_sme_extra
                          WHEN 'BE'  THEN 0
                          ELSE 0
                        END * v_biz_mult,
    payout_amount     = a.snapshotted_variable_pay * (
                          CASE COALESCE(a.final_rating, a.manager_rating)
                            WHEN 'FEE' THEN v_fee_mult
                            WHEN 'EE'  THEN v_ee_mult
                            WHEN 'ME'  THEN v_me_mult
                            WHEN 'SME' THEN v_sme_base + v_sme_extra
                            WHEN 'BE'  THEN 0
                            ELSE 0
                          END * v_biz_mult
                        ),
    locked_at         = now()
  WHERE a.cycle_id = p_cycle_id
    AND a.is_final = false
    AND COALESCE(a.final_rating, a.manager_rating) IS NOT NULL;  -- skip unrated

  -- Final (HRBP overridden) rows: just set locked_at, preserve payout
  UPDATE appraisals
  SET locked_at = now()
  WHERE cycle_id = p_cycle_id AND is_final = true AND locked_at IS NULL;
END;
$$;

-- ============================================================
-- FIX 2 (Critical): HRBP self-visibility — remove is_active guard
-- on the HRBP's own user row in hrbp_select_dept_users.
-- Convention (from 00013): HRBP/Admin policies have NO is_active
-- check so they can always see themselves.
-- ============================================================

DROP POLICY IF EXISTS "hrbp_select_dept_users" ON users;
CREATE POLICY "hrbp_select_dept_users" ON users
  FOR SELECT TO authenticated
  USING (
    public.user_role() = 'admin'
    OR id = public.user_id()  -- any authenticated user can always see themselves
    OR (
      public.user_role() = 'hrbp'
      AND is_active = true
      AND EXISTS (
        SELECT 1 FROM hrbp_departments hd
        WHERE hd.hrbp_id = public.user_id()
        AND hd.department_id = users.department_id
      )
    )
  );

-- ============================================================
-- FIX 3 (Important): Dept-scope HRBP write policies on kpis
-- and appraisals. Previously kpis_hr_insert / kpis_hr_update /
-- appraisals_hr_update allowed any HRBP to write org-wide.
-- ============================================================

-- kpis: drop old org-wide policies and replace with dept-scoped ones
DROP POLICY IF EXISTS "kpis_hr_insert" ON kpis;
DROP POLICY IF EXISTS "kpis_hr_update" ON kpis;

CREATE POLICY "hrbp_insert_dept_kpis" ON kpis
  FOR INSERT TO authenticated
  WITH CHECK (
    public.user_role() = 'admin'
    OR (
      public.user_role() = 'hrbp'
      AND EXISTS (
        SELECT 1 FROM users u
        JOIN hrbp_departments hd ON hd.department_id = u.department_id
        WHERE u.id = kpis.employee_id
        AND hd.hrbp_id = public.user_id()
      )
    )
  );

CREATE POLICY "hrbp_update_dept_kpis" ON kpis
  FOR UPDATE TO authenticated
  USING (
    public.user_role() = 'admin'
    OR (
      public.user_role() = 'hrbp'
      AND EXISTS (
        SELECT 1 FROM users u
        JOIN hrbp_departments hd ON hd.department_id = u.department_id
        WHERE u.id = kpis.employee_id
        AND hd.hrbp_id = public.user_id()
      )
    )
  );

-- appraisals: drop old org-wide policy and replace with dept-scoped one
DROP POLICY IF EXISTS "appraisals_hr_update" ON appraisals;

CREATE POLICY "hrbp_update_dept_appraisals" ON appraisals
  FOR UPDATE TO authenticated
  USING (
    public.user_role() = 'admin'
    OR (
      public.user_role() = 'hrbp'
      AND EXISTS (
        SELECT 1 FROM users u
        JOIN hrbp_departments hd ON hd.department_id = u.department_id
        WHERE u.id = appraisals.employee_id
        AND hd.hrbp_id = public.user_id()
      )
    )
  );

-- ============================================================
-- FIX 4 (Important): Restore status = 'draft' guard on review
-- update policy. The employees_and_hrbp_update_reviews policy
-- dropped this check, allowing employees to update submitted reviews.
-- ============================================================

DROP POLICY IF EXISTS "employees_and_hrbp_update_reviews" ON reviews;
CREATE POLICY "employees_and_hrbp_update_reviews" ON reviews
  FOR UPDATE TO authenticated
  USING (
    (
      public.user_role() = 'employee'
      OR (
        public.user_role() = 'hrbp'
        AND EXISTS (SELECT 1 FROM users WHERE id = public.user_id() AND is_also_employee = true)
      )
    )
    AND employee_id = public.user_id()
    AND status = 'draft'
    AND EXISTS (SELECT 1 FROM users WHERE id = public.user_id() AND is_active = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM cycles c WHERE c.id = cycle_id AND c.status = 'self_review')
  );

-- ============================================================
-- FIX 5 (Suggestion): Index on hrbp_departments(department_id)
-- Supports the many EXISTS subqueries that join on department_id.
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_hrbp_departments_department_id
  ON hrbp_departments(department_id);
