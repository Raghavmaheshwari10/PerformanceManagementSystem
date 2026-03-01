-- ============================================================
-- 00018_pms_v3.sql
-- ============================================================

-- ── 1. departments ────────────────────────────────────────────
CREATE TABLE departments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now()
);

-- ── 2. hrbp_departments ──────────────────────────────────────
CREATE TABLE hrbp_departments (
  hrbp_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  PRIMARY KEY (hrbp_id, department_id)
);

-- ── 3. payout_config ─────────────────────────────────────────
CREATE TABLE payout_config (
  rating_tier  rating_tier PRIMARY KEY,
  multiplier   numeric NOT NULL,
  updated_by   uuid REFERENCES users(id),
  updated_at   timestamptz DEFAULT now()
);
INSERT INTO payout_config (rating_tier, multiplier) VALUES
  ('FEE', 1.25), ('EE', 1.10), ('ME', 1.00), ('SME', 1.00), ('BE', 0.00);

-- ── 4. Add columns to users ───────────────────────────────────
ALTER TABLE users
  ADD COLUMN department_id uuid REFERENCES departments(id),
  ADD COLUMN is_also_employee boolean NOT NULL DEFAULT false;

-- ── 5. Migrate department text → FK ──────────────────────────
-- Populate departments from distinct values
INSERT INTO departments (name)
SELECT DISTINCT department FROM users
WHERE department IS NOT NULL AND department <> ''
ON CONFLICT (name) DO NOTHING;

-- Back-fill department_id
UPDATE users u
SET department_id = d.id
FROM departments d
WHERE d.name = u.department;

-- Drop old text column
ALTER TABLE users DROP COLUMN department;

-- ── 6. Per-cycle multiplier overrides ────────────────────────
ALTER TABLE cycles
  ADD COLUMN fee_multiplier numeric,
  ADD COLUMN ee_multiplier  numeric,
  ADD COLUMN me_multiplier  numeric;

-- ── 7. Replace bulk_lock_appraisals ──────────────────────────
-- Drop old version (signature changed: remove p_sme_multiplier param)
DROP FUNCTION IF EXISTS bulk_lock_appraisals(uuid, numeric);

CREATE OR REPLACE FUNCTION bulk_lock_appraisals(p_cycle_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fee_mult numeric;
  v_ee_mult  numeric;
  v_me_mult  numeric;
  v_sme_base numeric;
  v_biz_mult numeric;
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
  WHERE a.cycle_id = p_cycle_id AND a.is_final = false;

  -- Final (HRBP overridden) rows: just set locked_at, preserve payout
  UPDATE appraisals
  SET locked_at = now()
  WHERE cycle_id = p_cycle_id AND is_final = true AND locked_at IS NULL;
END;
$$;

-- ── 8. RLS on new tables ──────────────────────────────────────
ALTER TABLE departments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE hrbp_departments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE payout_config     ENABLE ROW LEVEL SECURITY;

-- departments: all authenticated can read; admin can write
CREATE POLICY "all_read_departments" ON departments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_write_departments" ON departments
  FOR ALL TO authenticated
  USING (public.user_role() = 'admin')
  WITH CHECK (public.user_role() = 'admin');

-- hrbp_departments: admin full; hrbp can read own rows
CREATE POLICY "admin_all_hrbp_departments" ON hrbp_departments
  FOR ALL TO authenticated
  USING (public.user_role() = 'admin')
  WITH CHECK (public.user_role() = 'admin');
CREATE POLICY "hrbp_read_own_depts" ON hrbp_departments
  FOR SELECT TO authenticated
  USING (public.user_role() = 'hrbp' AND hrbp_id = public.user_id());

-- payout_config: all read; admin write
CREATE POLICY "all_read_payout_config" ON payout_config
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_write_payout_config" ON payout_config
  FOR ALL TO authenticated
  USING (public.user_role() = 'admin')
  WITH CHECK (public.user_role() = 'admin');

-- ── 9. Update HRBP RLS policies to be dept-scoped ─────────────
-- Exact policy names verified from pg_policies before writing this migration.

-- users table: drop broad HRBP select, recreate dept-scoped
DROP POLICY IF EXISTS "users_hr_select" ON users;
CREATE POLICY "hrbp_select_dept_users" ON users
  FOR SELECT TO authenticated
  USING (
    public.user_role() = 'admin'
    OR (
      public.user_role() = 'hrbp'
      AND is_active = true
      AND (
        id = public.user_id()
        OR EXISTS (
          SELECT 1 FROM hrbp_departments hd
          WHERE hd.hrbp_id = public.user_id()
          AND hd.department_id = users.department_id
        )
      )
    )
  );

-- reviews table: drop broad HRBP select, recreate dept-scoped
DROP POLICY IF EXISTS "reviews_hr_select" ON reviews;
CREATE POLICY "hrbp_select_dept_reviews" ON reviews
  FOR SELECT TO authenticated
  USING (
    public.user_role() = 'admin'
    OR (
      public.user_role() = 'hrbp'
      AND EXISTS (
        SELECT 1 FROM users u
        JOIN hrbp_departments hd ON hd.department_id = u.department_id
        WHERE u.id = reviews.employee_id
        AND hd.hrbp_id = public.user_id()
        AND u.is_active = true
      )
    )
  );

-- Allow HRBP with is_also_employee to insert/update their own review
DROP POLICY IF EXISTS "reviews_employee_insert" ON reviews;
DROP POLICY IF EXISTS "reviews_employee_update" ON reviews;
CREATE POLICY "employees_and_hrbp_insert_reviews" ON reviews
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      public.user_role() = 'employee'
      OR (
        public.user_role() = 'hrbp'
        AND EXISTS (SELECT 1 FROM users WHERE id = public.user_id() AND is_also_employee = true)
      )
    )
    AND employee_id = public.user_id()
    AND EXISTS (SELECT 1 FROM users WHERE id = public.user_id() AND is_active = true)
    AND EXISTS (SELECT 1 FROM cycles c WHERE c.id = cycle_id AND c.status = 'self_review')
  );
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
    AND EXISTS (SELECT 1 FROM users WHERE id = public.user_id() AND is_active = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM cycles c WHERE c.id = cycle_id AND c.status = 'self_review')
  );

-- appraisals table: drop broad HRBP select, recreate dept-scoped
DROP POLICY IF EXISTS "appraisals_hr_select" ON appraisals;
CREATE POLICY "hrbp_select_dept_appraisals" ON appraisals
  FOR SELECT TO authenticated
  USING (
    public.user_role() = 'admin'
    OR (
      public.user_role() = 'hrbp'
      AND EXISTS (
        SELECT 1 FROM users u
        JOIN hrbp_departments hd ON hd.department_id = u.department_id
        WHERE u.id = appraisals.employee_id
        AND hd.hrbp_id = public.user_id()
        AND u.is_active = true
      )
    )
  );

-- kpis table: drop broad HRBP select, recreate dept-scoped
DROP POLICY IF EXISTS "kpis_hr_select" ON kpis;
CREATE POLICY "hrbp_select_dept_kpis" ON kpis
  FOR SELECT TO authenticated
  USING (
    public.user_role() = 'admin'
    OR (
      public.user_role() = 'hrbp'
      AND EXISTS (
        SELECT 1 FROM users u
        JOIN hrbp_departments hd ON hd.department_id = u.department_id
        WHERE u.id = kpis.employee_id
        AND hd.hrbp_id = public.user_id()
        AND u.is_active = true
      )
    )
  );

-- ── 10. touch_updated_at for new tables ───────────────────────
CREATE TRIGGER set_payout_config_updated_at
  BEFORE UPDATE ON payout_config
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
