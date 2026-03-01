-- Security fix: inactive (soft-deleted) users must not be able to read or write data.
-- Drops affected policies and recreates them with an is_active guard.
--
-- Helper: (SELECT is_active FROM users WHERE id = public.user_id()) = true
-- This is evaluated once per query via a correlated subquery; Postgres caches it.

-- ============ USERS ============

DROP POLICY IF EXISTS users_employee_select ON users;
CREATE POLICY users_employee_select ON users FOR SELECT
  USING (
    public.user_role() = 'employee'
    AND id = public.user_id()
    AND (SELECT is_active FROM users WHERE id = public.user_id()) = true
  );

DROP POLICY IF EXISTS users_manager_select ON users;
CREATE POLICY users_manager_select ON users FOR SELECT
  USING (
    public.user_role() = 'manager'
    AND (id = public.user_id() OR manager_id = public.user_id())
    AND (SELECT is_active FROM users WHERE id = public.user_id()) = true
  );

-- ============ KPIS ============

DROP POLICY IF EXISTS kpis_employee_select ON kpis;
CREATE POLICY kpis_employee_select ON kpis FOR SELECT
  USING (
    public.user_role() = 'employee'
    AND employee_id = public.user_id()
    AND (SELECT is_active FROM users WHERE id = public.user_id()) = true
    AND EXISTS (SELECT 1 FROM cycles c WHERE c.id = cycle_id AND c.status != 'draft')
  );

DROP POLICY IF EXISTS kpis_manager_select ON kpis;
CREATE POLICY kpis_manager_select ON kpis FOR SELECT
  USING (
    public.user_role() = 'manager'
    AND (employee_id = public.user_id() OR manager_id = public.user_id())
    AND (SELECT is_active FROM users WHERE id = public.user_id()) = true
  );

DROP POLICY IF EXISTS kpis_manager_insert ON kpis;
CREATE POLICY kpis_manager_insert ON kpis FOR INSERT
  WITH CHECK (
    public.user_role() = 'manager'
    AND manager_id = public.user_id()
    AND (SELECT is_active FROM users WHERE id = public.user_id()) = true
    AND EXISTS (SELECT 1 FROM cycles c WHERE c.id = cycle_id AND c.status = 'kpi_setting')
  );

DROP POLICY IF EXISTS kpis_manager_update ON kpis;
CREATE POLICY kpis_manager_update ON kpis FOR UPDATE
  USING (
    public.user_role() = 'manager'
    AND manager_id = public.user_id()
    AND (SELECT is_active FROM users WHERE id = public.user_id()) = true
    AND EXISTS (SELECT 1 FROM cycles c WHERE c.id = cycle_id AND c.status = 'kpi_setting')
  );

-- ============ REVIEWS ============

DROP POLICY IF EXISTS reviews_employee_select ON reviews;
CREATE POLICY reviews_employee_select ON reviews FOR SELECT
  USING (
    public.user_role() = 'employee'
    AND employee_id = public.user_id()
    AND (SELECT is_active FROM users WHERE id = public.user_id()) = true
  );

DROP POLICY IF EXISTS reviews_employee_insert ON reviews;
CREATE POLICY reviews_employee_insert ON reviews FOR INSERT
  WITH CHECK (
    public.user_role() = 'employee'
    AND employee_id = public.user_id()
    AND (SELECT is_active FROM users WHERE id = public.user_id()) = true
    AND EXISTS (SELECT 1 FROM cycles c WHERE c.id = cycle_id AND c.status = 'self_review')
  );

DROP POLICY IF EXISTS reviews_employee_update ON reviews;
CREATE POLICY reviews_employee_update ON reviews FOR UPDATE
  USING (
    public.user_role() = 'employee'
    AND employee_id = public.user_id()
    AND (SELECT is_active FROM users WHERE id = public.user_id()) = true
    AND status = 'draft'
    AND EXISTS (SELECT 1 FROM cycles c WHERE c.id = cycle_id AND c.status = 'self_review')
  );

DROP POLICY IF EXISTS reviews_manager_select ON reviews;
CREATE POLICY reviews_manager_select ON reviews FOR SELECT
  USING (
    public.user_role() = 'manager'
    AND (SELECT is_active FROM users WHERE id = public.user_id()) = true
    AND EXISTS (SELECT 1 FROM users u WHERE u.id = employee_id AND u.manager_id = public.user_id())
    AND EXISTS (SELECT 1 FROM cycles c WHERE c.id = cycle_id AND c.status IN ('manager_review', 'calibrating', 'locked', 'published'))
  );

-- ============ APPRAISALS ============

DROP POLICY IF EXISTS appraisals_employee_select ON appraisals;
CREATE POLICY appraisals_employee_select ON appraisals FOR SELECT
  USING (
    public.user_role() = 'employee'
    AND employee_id = public.user_id()
    AND (SELECT is_active FROM users WHERE id = public.user_id()) = true
    AND EXISTS (SELECT 1 FROM cycles c WHERE c.id = cycle_id AND c.status = 'published')
  );

DROP POLICY IF EXISTS appraisals_manager_select ON appraisals;
CREATE POLICY appraisals_manager_select ON appraisals FOR SELECT
  USING (
    public.user_role() = 'manager'
    AND manager_id = public.user_id()
    AND (SELECT is_active FROM users WHERE id = public.user_id()) = true
  );

DROP POLICY IF EXISTS appraisals_manager_insert ON appraisals;
CREATE POLICY appraisals_manager_insert ON appraisals FOR INSERT
  WITH CHECK (
    public.user_role() = 'manager'
    AND manager_id = public.user_id()
    AND (SELECT is_active FROM users WHERE id = public.user_id()) = true
    AND EXISTS (SELECT 1 FROM cycles c WHERE c.id = cycle_id AND c.status = 'manager_review')
  );

DROP POLICY IF EXISTS appraisals_manager_update ON appraisals;
CREATE POLICY appraisals_manager_update ON appraisals FOR UPDATE
  USING (
    public.user_role() = 'manager'
    AND manager_id = public.user_id()
    AND (SELECT is_active FROM users WHERE id = public.user_id()) = true
    AND EXISTS (SELECT 1 FROM cycles c WHERE c.id = cycle_id AND c.status = 'manager_review')
  );

-- Note: HRBP/Admin SELECT policies intentionally have NO is_active check.
-- Admins must be able to view/manage all users including inactive ones.
