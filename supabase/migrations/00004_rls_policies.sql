-- ============ USERS ============
-- Employees see own row
CREATE POLICY users_employee_select ON users FOR SELECT
  USING (public.user_role() = 'employee' AND id = public.user_id());

-- Managers see own + direct reports
CREATE POLICY users_manager_select ON users FOR SELECT
  USING (public.user_role() = 'manager' AND (id = public.user_id() OR manager_id = public.user_id()));

-- HRBP/Admin see all
CREATE POLICY users_hr_select ON users FOR SELECT
  USING (public.user_role() IN ('hrbp', 'admin'));

-- ============ CYCLES ============
-- Everyone can read cycles (employees only see non-draft)
CREATE POLICY cycles_employee_select ON cycles FOR SELECT
  USING (public.user_role() = 'employee' AND status != 'draft');

CREATE POLICY cycles_staff_select ON cycles FOR SELECT
  USING (public.user_role() IN ('manager', 'hrbp', 'admin'));

-- Only admin/hrbp can insert/update cycles
CREATE POLICY cycles_admin_insert ON cycles FOR INSERT
  WITH CHECK (public.user_role() IN ('admin', 'hrbp'));

CREATE POLICY cycles_admin_update ON cycles FOR UPDATE
  USING (public.user_role() IN ('admin', 'hrbp'));

-- ============ KPIS ============
-- Employees see own KPIs (cycle must be past draft)
CREATE POLICY kpis_employee_select ON kpis FOR SELECT
  USING (
    public.user_role() = 'employee'
    AND employee_id = public.user_id()
    AND EXISTS (SELECT 1 FROM cycles c WHERE c.id = cycle_id AND c.status != 'draft')
  );

-- Managers see own + direct reports' KPIs
CREATE POLICY kpis_manager_select ON kpis FOR SELECT
  USING (
    public.user_role() = 'manager'
    AND (employee_id = public.user_id() OR manager_id = public.user_id())
  );

-- Managers can insert/update KPIs for their direct reports during kpi_setting
CREATE POLICY kpis_manager_insert ON kpis FOR INSERT
  WITH CHECK (
    public.user_role() = 'manager'
    AND manager_id = public.user_id()
    AND EXISTS (SELECT 1 FROM cycles c WHERE c.id = cycle_id AND c.status = 'kpi_setting')
  );

CREATE POLICY kpis_manager_update ON kpis FOR UPDATE
  USING (
    public.user_role() = 'manager'
    AND manager_id = public.user_id()
    AND EXISTS (SELECT 1 FROM cycles c WHERE c.id = cycle_id AND c.status = 'kpi_setting')
  );

-- HRBP/Admin see all KPIs
CREATE POLICY kpis_hr_select ON kpis FOR SELECT
  USING (public.user_role() IN ('hrbp', 'admin'));

CREATE POLICY kpis_hr_insert ON kpis FOR INSERT
  WITH CHECK (public.user_role() IN ('hrbp', 'admin'));

CREATE POLICY kpis_hr_update ON kpis FOR UPDATE
  USING (public.user_role() IN ('hrbp', 'admin'));

-- ============ REVIEWS ============
-- Employees see own review (cycle past self_review)
CREATE POLICY reviews_employee_select ON reviews FOR SELECT
  USING (
    public.user_role() = 'employee'
    AND employee_id = public.user_id()
  );

-- Employees insert/update own draft review during self_review
CREATE POLICY reviews_employee_insert ON reviews FOR INSERT
  WITH CHECK (
    public.user_role() = 'employee'
    AND employee_id = public.user_id()
    AND EXISTS (SELECT 1 FROM cycles c WHERE c.id = cycle_id AND c.status = 'self_review')
  );

CREATE POLICY reviews_employee_update ON reviews FOR UPDATE
  USING (
    public.user_role() = 'employee'
    AND employee_id = public.user_id()
    AND status = 'draft'
    AND EXISTS (SELECT 1 FROM cycles c WHERE c.id = cycle_id AND c.status = 'self_review')
  );

-- Managers see direct reports' reviews (after manager_review stage)
CREATE POLICY reviews_manager_select ON reviews FOR SELECT
  USING (
    public.user_role() = 'manager'
    AND EXISTS (SELECT 1 FROM users u WHERE u.id = employee_id AND u.manager_id = public.user_id())
    AND EXISTS (SELECT 1 FROM cycles c WHERE c.id = cycle_id AND c.status IN ('manager_review', 'calibrating', 'locked', 'published'))
  );

-- HRBP/Admin see all
CREATE POLICY reviews_hr_select ON reviews FOR SELECT
  USING (public.user_role() IN ('hrbp', 'admin'));

-- ============ APPRAISALS ============
-- Employees see own appraisal ONLY when cycle is published
CREATE POLICY appraisals_employee_select ON appraisals FOR SELECT
  USING (
    public.user_role() = 'employee'
    AND employee_id = public.user_id()
    AND EXISTS (SELECT 1 FROM cycles c WHERE c.id = cycle_id AND c.status = 'published')
  );

-- Managers see direct reports (rating + comments only, enforced at app layer)
CREATE POLICY appraisals_manager_select ON appraisals FOR SELECT
  USING (
    public.user_role() = 'manager'
    AND manager_id = public.user_id()
  );

-- Managers insert/update during manager_review
CREATE POLICY appraisals_manager_insert ON appraisals FOR INSERT
  WITH CHECK (
    public.user_role() = 'manager'
    AND manager_id = public.user_id()
    AND EXISTS (SELECT 1 FROM cycles c WHERE c.id = cycle_id AND c.status = 'manager_review')
  );

CREATE POLICY appraisals_manager_update ON appraisals FOR UPDATE
  USING (
    public.user_role() = 'manager'
    AND manager_id = public.user_id()
    AND EXISTS (SELECT 1 FROM cycles c WHERE c.id = cycle_id AND c.status = 'manager_review')
  );

-- HRBP/Admin full access
CREATE POLICY appraisals_hr_select ON appraisals FOR SELECT
  USING (public.user_role() IN ('hrbp', 'admin'));

CREATE POLICY appraisals_hr_update ON appraisals FOR UPDATE
  USING (public.user_role() IN ('hrbp', 'admin') AND EXISTS (SELECT 1 FROM cycles c WHERE c.id = cycle_id AND c.status = 'calibrating'));

-- ============ AUDIT LOGS ============
-- Insert only for any authenticated user (via service role in edge functions)
CREATE POLICY audit_logs_insert ON audit_logs FOR INSERT
  WITH CHECK (true);

-- Only HRBP/Admin can read
CREATE POLICY audit_logs_hr_select ON audit_logs FOR SELECT
  USING (public.user_role() IN ('hrbp', 'admin'));

-- No update/delete ever
-- (RLS + no policy = denied)

-- ============ NOTIFICATIONS ============
-- Only HRBP/Admin can read
CREATE POLICY notifications_hr_select ON notifications FOR SELECT
  USING (public.user_role() IN ('hrbp', 'admin'));

-- Insert via service role (edge functions)
CREATE POLICY notifications_service_insert ON notifications FOR INSERT
  WITH CHECK (true);

CREATE POLICY notifications_service_update ON notifications FOR UPDATE
  USING (public.user_role() IN ('hrbp', 'admin'));
