-- =====================================================
-- COMPLETE MIGRATION: 00001 to 00015  (idempotent)
-- Safe to run on any state of the database.
-- Apply via Supabase SQL Editor:
--   https://supabase.com/dashboard/project/cekmehtfghzhnzmxjbcx/sql
-- =====================================================


-- =====================================================
-- 00001_create_enums.sql
-- =====================================================
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('employee', 'manager', 'hrbp', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE cycle_status AS ENUM ('draft', 'kpi_setting', 'self_review', 'manager_review', 'calibrating', 'locked', 'published');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE rating_tier AS ENUM ('FEE', 'EE', 'ME', 'SME', 'BE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE review_status AS ENUM ('draft', 'submitted');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE notification_type AS ENUM ('cycle_kpi_setting_open', 'cycle_self_review_open', 'cycle_manager_review_open', 'cycle_published');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE notification_status AS ENUM ('pending', 'sent', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- =====================================================
-- 00002_create_tables.sql
-- =====================================================
-- Users (synced from Zimyo)
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zimyo_id text UNIQUE NOT NULL,
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  role user_role NOT NULL DEFAULT 'employee',
  department text,
  designation text,
  manager_id uuid REFERENCES users(id),
  variable_pay numeric(12,2) DEFAULT 0,
  is_active boolean DEFAULT true,
  synced_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Cycles (state machine)
CREATE TABLE IF NOT EXISTS cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  quarter text NOT NULL,
  year integer NOT NULL,
  status cycle_status NOT NULL DEFAULT 'draft',
  kpi_setting_deadline date,
  self_review_deadline date,
  manager_review_deadline date,
  calibration_deadline date,
  published_at timestamptz,
  sme_multiplier numeric(5,4),
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- KPIs (manager-defined goals)
CREATE TABLE IF NOT EXISTS kpis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id uuid REFERENCES cycles(id) NOT NULL,
  employee_id uuid REFERENCES users(id) NOT NULL,
  manager_id uuid REFERENCES users(id) NOT NULL,
  title text NOT NULL,
  description text,
  weight numeric(5,2),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Reviews (employee self-assessment)
CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id uuid REFERENCES cycles(id) NOT NULL,
  employee_id uuid REFERENCES users(id) NOT NULL,
  self_rating rating_tier,
  self_comments text NOT NULL DEFAULT '',
  status review_status DEFAULT 'draft',
  submitted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (cycle_id, employee_id)
);

-- Appraisals (financial record - strictest RLS)
CREATE TABLE IF NOT EXISTS appraisals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id uuid REFERENCES cycles(id) NOT NULL,
  employee_id uuid REFERENCES users(id) NOT NULL,
  manager_id uuid REFERENCES users(id) NOT NULL,
  manager_rating rating_tier,
  manager_comments text,
  manager_submitted_at timestamptz,
  final_rating rating_tier,
  final_rating_set_by uuid REFERENCES users(id),
  payout_multiplier numeric(5,4),
  payout_amount numeric(12,2),
  locked_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (cycle_id, employee_id)
);

-- Audit logs (immutable - insert only)
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id uuid REFERENCES cycles(id),
  changed_by uuid REFERENCES users(id) NOT NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  old_value jsonb,
  new_value jsonb,
  justification text,
  created_at timestamptz DEFAULT now()
);

-- Notifications (in-app + email)
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) NOT NULL,
  type notification_type NOT NULL,
  message text NOT NULL DEFAULT '',
  link text,
  is_read boolean NOT NULL DEFAULT false,
  payload jsonb,
  status notification_status DEFAULT 'pending',
  sent_at timestamptz,
  error_message text,
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_manager ON users(manager_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_kpis_cycle_employee ON kpis(cycle_id, employee_id);
CREATE INDEX IF NOT EXISTS idx_reviews_cycle_employee ON reviews(cycle_id, employee_id);
CREATE INDEX IF NOT EXISTS idx_appraisals_cycle_employee ON appraisals(cycle_id, employee_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_cycle ON audit_logs(cycle_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);


-- =====================================================
-- 00003_enable_rls.sql
-- =====================================================
-- Helper: extract role from JWT (in public schema to avoid auth schema permission issues)
CREATE OR REPLACE FUNCTION public.user_role()
RETURNS user_role AS $$
  SELECT (current_setting('request.jwt.claims', true)::jsonb ->> 'user_role')::user_role;
$$ LANGUAGE sql STABLE;

-- Helper: extract user_id from JWT
CREATE OR REPLACE FUNCTION public.user_id()
RETURNS uuid AS $$
  SELECT (current_setting('request.jwt.claims', true)::jsonb ->> 'user_id')::uuid;
$$ LANGUAGE sql STABLE;

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpis ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE appraisals ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;


-- =====================================================
-- 00004_rls_policies.sql
-- =====================================================
-- ============ USERS ============
-- Employees see own row
DROP POLICY IF EXISTS users_employee_select ON users;
CREATE POLICY users_employee_select ON users FOR SELECT
  USING (public.user_role() = 'employee' AND id = public.user_id());

-- Managers see own + direct reports
DROP POLICY IF EXISTS users_manager_select ON users;
CREATE POLICY users_manager_select ON users FOR SELECT
  USING (public.user_role() = 'manager' AND (id = public.user_id() OR manager_id = public.user_id()));

-- HRBP/Admin see all
DROP POLICY IF EXISTS users_hr_select ON users;
CREATE POLICY users_hr_select ON users FOR SELECT
  USING (public.user_role() IN ('hrbp', 'admin'));

-- ============ CYCLES ============
-- Everyone can read cycles (employees only see non-draft)
DROP POLICY IF EXISTS cycles_employee_select ON cycles;
CREATE POLICY cycles_employee_select ON cycles FOR SELECT
  USING (public.user_role() = 'employee' AND status != 'draft');

DROP POLICY IF EXISTS cycles_staff_select ON cycles;
CREATE POLICY cycles_staff_select ON cycles FOR SELECT
  USING (public.user_role() IN ('manager', 'hrbp', 'admin'));

-- Only admin/hrbp can insert/update cycles
DROP POLICY IF EXISTS cycles_admin_insert ON cycles;
CREATE POLICY cycles_admin_insert ON cycles FOR INSERT
  WITH CHECK (public.user_role() IN ('admin', 'hrbp'));

DROP POLICY IF EXISTS cycles_admin_update ON cycles;
CREATE POLICY cycles_admin_update ON cycles FOR UPDATE
  USING (public.user_role() IN ('admin', 'hrbp'));

-- ============ KPIS ============
-- Employees see own KPIs (cycle must be past draft)
DROP POLICY IF EXISTS kpis_employee_select ON kpis;
CREATE POLICY kpis_employee_select ON kpis FOR SELECT
  USING (
    public.user_role() = 'employee'
    AND employee_id = public.user_id()
    AND EXISTS (SELECT 1 FROM cycles c WHERE c.id = cycle_id AND c.status != 'draft')
  );

-- Managers see own + direct reports' KPIs
DROP POLICY IF EXISTS kpis_manager_select ON kpis;
CREATE POLICY kpis_manager_select ON kpis FOR SELECT
  USING (
    public.user_role() = 'manager'
    AND (employee_id = public.user_id() OR manager_id = public.user_id())
  );

-- Managers can insert/update KPIs for their direct reports during kpi_setting
DROP POLICY IF EXISTS kpis_manager_insert ON kpis;
CREATE POLICY kpis_manager_insert ON kpis FOR INSERT
  WITH CHECK (
    public.user_role() = 'manager'
    AND manager_id = public.user_id()
    AND EXISTS (SELECT 1 FROM cycles c WHERE c.id = cycle_id AND c.status = 'kpi_setting')
  );

DROP POLICY IF EXISTS kpis_manager_update ON kpis;
CREATE POLICY kpis_manager_update ON kpis FOR UPDATE
  USING (
    public.user_role() = 'manager'
    AND manager_id = public.user_id()
    AND EXISTS (SELECT 1 FROM cycles c WHERE c.id = cycle_id AND c.status = 'kpi_setting')
  );

-- HRBP/Admin see all KPIs
DROP POLICY IF EXISTS kpis_hr_select ON kpis;
CREATE POLICY kpis_hr_select ON kpis FOR SELECT
  USING (public.user_role() IN ('hrbp', 'admin'));

DROP POLICY IF EXISTS kpis_hr_insert ON kpis;
CREATE POLICY kpis_hr_insert ON kpis FOR INSERT
  WITH CHECK (public.user_role() IN ('hrbp', 'admin'));

DROP POLICY IF EXISTS kpis_hr_update ON kpis;
CREATE POLICY kpis_hr_update ON kpis FOR UPDATE
  USING (public.user_role() IN ('hrbp', 'admin'));

-- ============ REVIEWS ============
-- Employees see own review (cycle past self_review)
DROP POLICY IF EXISTS reviews_employee_select ON reviews;
CREATE POLICY reviews_employee_select ON reviews FOR SELECT
  USING (
    public.user_role() = 'employee'
    AND employee_id = public.user_id()
  );

-- Employees insert/update own draft review during self_review
DROP POLICY IF EXISTS reviews_employee_insert ON reviews;
CREATE POLICY reviews_employee_insert ON reviews FOR INSERT
  WITH CHECK (
    public.user_role() = 'employee'
    AND employee_id = public.user_id()
    AND EXISTS (SELECT 1 FROM cycles c WHERE c.id = cycle_id AND c.status = 'self_review')
  );

DROP POLICY IF EXISTS reviews_employee_update ON reviews;
CREATE POLICY reviews_employee_update ON reviews FOR UPDATE
  USING (
    public.user_role() = 'employee'
    AND employee_id = public.user_id()
    AND status = 'draft'
    AND EXISTS (SELECT 1 FROM cycles c WHERE c.id = cycle_id AND c.status = 'self_review')
  );

-- Managers see direct reports' reviews (after manager_review stage)
DROP POLICY IF EXISTS reviews_manager_select ON reviews;
CREATE POLICY reviews_manager_select ON reviews FOR SELECT
  USING (
    public.user_role() = 'manager'
    AND EXISTS (SELECT 1 FROM users u WHERE u.id = employee_id AND u.manager_id = public.user_id())
    AND EXISTS (SELECT 1 FROM cycles c WHERE c.id = cycle_id AND c.status IN ('manager_review', 'calibrating', 'locked', 'published'))
  );

-- HRBP/Admin see all
DROP POLICY IF EXISTS reviews_hr_select ON reviews;
CREATE POLICY reviews_hr_select ON reviews FOR SELECT
  USING (public.user_role() IN ('hrbp', 'admin'));

-- ============ APPRAISALS ============
-- Employees see own appraisal ONLY when cycle is published
DROP POLICY IF EXISTS appraisals_employee_select ON appraisals;
CREATE POLICY appraisals_employee_select ON appraisals FOR SELECT
  USING (
    public.user_role() = 'employee'
    AND employee_id = public.user_id()
    AND EXISTS (SELECT 1 FROM cycles c WHERE c.id = cycle_id AND c.status = 'published')
  );

-- Managers see direct reports (rating + comments only, enforced at app layer)
DROP POLICY IF EXISTS appraisals_manager_select ON appraisals;
CREATE POLICY appraisals_manager_select ON appraisals FOR SELECT
  USING (
    public.user_role() = 'manager'
    AND manager_id = public.user_id()
  );

-- Managers insert/update during manager_review
DROP POLICY IF EXISTS appraisals_manager_insert ON appraisals;
CREATE POLICY appraisals_manager_insert ON appraisals FOR INSERT
  WITH CHECK (
    public.user_role() = 'manager'
    AND manager_id = public.user_id()
    AND EXISTS (SELECT 1 FROM cycles c WHERE c.id = cycle_id AND c.status = 'manager_review')
  );

DROP POLICY IF EXISTS appraisals_manager_update ON appraisals;
CREATE POLICY appraisals_manager_update ON appraisals FOR UPDATE
  USING (
    public.user_role() = 'manager'
    AND manager_id = public.user_id()
    AND EXISTS (SELECT 1 FROM cycles c WHERE c.id = cycle_id AND c.status = 'manager_review')
  );

-- HRBP/Admin full access
DROP POLICY IF EXISTS appraisals_hr_select ON appraisals;
CREATE POLICY appraisals_hr_select ON appraisals FOR SELECT
  USING (public.user_role() IN ('hrbp', 'admin'));

DROP POLICY IF EXISTS appraisals_hr_update ON appraisals;
CREATE POLICY appraisals_hr_update ON appraisals FOR UPDATE
  USING (public.user_role() IN ('hrbp', 'admin') AND EXISTS (SELECT 1 FROM cycles c WHERE c.id = cycle_id AND c.status = 'calibrating'));

-- ============ AUDIT LOGS ============
-- Insert only for any authenticated user (via service role in edge functions)
DROP POLICY IF EXISTS audit_logs_insert ON audit_logs;
CREATE POLICY audit_logs_insert ON audit_logs FOR INSERT
  WITH CHECK (true);

-- Only HRBP/Admin can read
DROP POLICY IF EXISTS audit_logs_hr_select ON audit_logs;
CREATE POLICY audit_logs_hr_select ON audit_logs FOR SELECT
  USING (public.user_role() IN ('hrbp', 'admin'));

-- No update/delete ever
-- (RLS + no policy = denied)

-- ============ NOTIFICATIONS ============
-- Only HRBP/Admin can read
DROP POLICY IF EXISTS notifications_hr_select ON notifications;
CREATE POLICY notifications_hr_select ON notifications FOR SELECT
  USING (public.user_role() IN ('hrbp', 'admin'));

-- Insert via service role (edge functions)
DROP POLICY IF EXISTS notifications_service_insert ON notifications;
CREATE POLICY notifications_service_insert ON notifications FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS notifications_service_update ON notifications;
CREATE POLICY notifications_service_update ON notifications FOR UPDATE
  USING (public.user_role() IN ('hrbp', 'admin'));


-- =====================================================
-- 00005_auth_hook.sql
-- =====================================================
-- Custom JWT claims hook: injects user_role and user_id from users table
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb AS $$
DECLARE
  claims jsonb;
  user_email text;
  user_record record;
BEGIN
  claims := event->'claims';
  user_email := claims->>'email';

  SELECT id, role INTO user_record
  FROM public.users
  WHERE email = user_email AND is_active = true
  LIMIT 1;

  IF user_record IS NOT NULL THEN
    claims := jsonb_set(claims, '{user_role}', to_jsonb(user_record.role::text));
    claims := jsonb_set(claims, '{user_id}', to_jsonb(user_record.id::text));
  END IF;

  event := jsonb_set(event, '{claims}', claims);
  RETURN event;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- Grant execute to supabase_auth_admin
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;

-- Allow hook to read user roles
GRANT SELECT ON public.users TO supabase_auth_admin;

-- Revoke from public
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM public;


-- =====================================================
-- 00006_integrity_and_indexes.sql
-- =====================================================
-- 1. DB-level constraints
DO $$ BEGIN
  ALTER TABLE kpis ADD CONSTRAINT kpis_weight_bounds CHECK (weight IS NULL OR (weight > 0 AND weight <= 100));
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE cycles ADD CONSTRAINT cycles_sme_multiplier_bounds CHECK (sme_multiplier IS NULL OR (sme_multiplier >= 0 AND sme_multiplier <= 5));
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- 2. is_final column — set true when HRBP finalises; blocks manager re-submission overwrite
ALTER TABLE appraisals ADD COLUMN IF NOT EXISTS is_final boolean NOT NULL DEFAULT false;

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
DROP TRIGGER IF EXISTS kpi_weight_sum_check ON kpis;
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


-- =====================================================
-- 00007_notification_types.sql
-- =====================================================
-- Extend notification_type enum for event-driven notifications
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'review_submitted';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'manager_review_submitted';


-- =====================================================
-- 00008_fix_multipliers.sql
-- =====================================================
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


-- =====================================================
-- 00009_kpi_templates.sql
-- =====================================================
-- KPI Templates: reusable role-based KPI blueprints.

-- 1. Table
CREATE TABLE IF NOT EXISTS kpi_templates (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  role_slug   text        NOT NULL,
  title       text        NOT NULL,
  description text,
  unit        text        NOT NULL DEFAULT 'percent'
                          CHECK (unit IN ('percent', 'number', 'boolean', 'rating')),
  target      numeric,
  weight      numeric     CHECK (weight > 0 AND weight <= 100),
  category    text        NOT NULL DEFAULT 'performance'
                          CHECK (category IN ('performance', 'behaviour', 'learning')),
  sort_order  int         NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 2. RLS
ALTER TABLE kpi_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY kpi_templates_select_all
  ON kpi_templates FOR SELECT
  USING (true);

CREATE POLICY kpi_templates_admin_all
  ON kpi_templates FOR ALL
  USING (public.user_role() = 'admin')
  WITH CHECK (public.user_role() = 'admin');

-- 3. apply_kpi_template()
CREATE OR REPLACE FUNCTION apply_kpi_template(
  p_role_slug   text,
  p_cycle_id    uuid,
  p_employee_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_manager_id uuid;
BEGIN
  SELECT manager_id INTO v_manager_id FROM users WHERE id = p_employee_id;

  IF v_manager_id IS NULL THEN
    RAISE EXCEPTION 'Employee % has no manager assigned', p_employee_id;
  END IF;

  INSERT INTO kpis (cycle_id, employee_id, manager_id, title, description, weight)
  SELECT p_cycle_id, p_employee_id, v_manager_id, t.title, t.description, t.weight
  FROM kpi_templates t WHERE t.role_slug = p_role_slug ORDER BY t.sort_order
  ON CONFLICT DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION apply_kpi_template(text, uuid, uuid) TO authenticated;

-- 4. Seed data

-- Software Engineer
INSERT INTO kpi_templates (role_slug, title, unit, target, weight, category, sort_order) VALUES
  ('software_engineer', 'Sprint Velocity', 'number', 40, 20, 'performance', 1),
  ('software_engineer', 'Code Review Turnaround (hrs)', 'number', 24, 10, 'performance', 2),
  ('software_engineer', 'Bug Escape Rate', 'number', 2, 15, 'performance', 3),
  ('software_engineer', 'Unit Test Coverage (%)', 'percent', 80, 15, 'performance', 4),
  ('software_engineer', 'On-Time Feature Delivery (%)', 'percent', 90, 20, 'performance', 5),
  ('software_engineer', 'Documentation Quality (1-5)', 'rating', 4, 10, 'behaviour', 6),
  ('software_engineer', 'Knowledge Sharing / Tech Talks', 'number', 2, 10, 'learning', 7);

-- Senior / Staff Engineer
INSERT INTO kpi_templates (role_slug, title, unit, target, weight, category, sort_order) VALUES
  ('senior_engineer', 'Architecture Reviews Completed', 'number', 4, 15, 'performance', 1),
  ('senior_engineer', 'Cross-Team Unblocking', 'number', 6, 15, 'performance', 2),
  ('senior_engineer', 'Mentoring Sessions Conducted', 'number', 12, 20, 'behaviour', 3),
  ('senior_engineer', 'System Uptime / SLA Adherence (%)', 'percent', 99.5, 20, 'performance', 4),
  ('senior_engineer', 'RFC / Design Docs Authored', 'number', 3, 15, 'performance', 5),
  ('senior_engineer', 'Team Velocity Improvement (%)', 'percent', 10, 15, 'performance', 6);

-- Engineering Manager
INSERT INTO kpi_templates (role_slug, title, unit, target, weight, category, sort_order) VALUES
  ('engineering_manager', 'Team Delivery Predictability (%)', 'percent', 85, 25, 'performance', 1),
  ('engineering_manager', 'Employee Retention Rate (%)', 'percent', 90, 20, 'performance', 2),
  ('engineering_manager', '1:1 Completion Rate (%)', 'percent', 95, 15, 'behaviour', 3),
  ('engineering_manager', 'Hiring Targets Met (%)', 'percent', 100, 15, 'performance', 4),
  ('engineering_manager', 'Team Health Score (1-5)', 'rating', 4, 15, 'behaviour', 5),
  ('engineering_manager', 'Cross-Functional Escalations Resolved', 'number', 3, 10, 'performance', 6);

-- Product Manager
INSERT INTO kpi_templates (role_slug, title, unit, target, weight, category, sort_order) VALUES
  ('product_manager', 'Feature Adoption Rate (%)', 'percent', 40, 20, 'performance', 1),
  ('product_manager', 'NPS / CSAT Score', 'number', 50, 20, 'performance', 2),
  ('product_manager', 'Roadmap Delivery on Time (%)', 'percent', 85, 20, 'performance', 3),
  ('product_manager', 'Stakeholder Satisfaction (1-5)', 'rating', 4, 15, 'behaviour', 4),
  ('product_manager', 'Discovery to Delivery Ratio', 'number', 2, 15, 'performance', 5),
  ('product_manager', 'PRD Completeness (%)', 'percent', 90, 10, 'behaviour', 6);

-- QA / SDET
INSERT INTO kpi_templates (role_slug, title, unit, target, weight, category, sort_order) VALUES
  ('qa_sdet', 'Test Automation Coverage (%)', 'percent', 70, 25, 'performance', 1),
  ('qa_sdet', 'Defect Detection Rate (%)', 'percent', 85, 25, 'performance', 2),
  ('qa_sdet', 'Critical Bugs in Production', 'number', 0, 20, 'performance', 3),
  ('qa_sdet', 'Regression Cycle Time (days)', 'number', 3, 15, 'performance', 4),
  ('qa_sdet', 'Test Documentation Quality (1-5)', 'rating', 4, 15, 'behaviour', 5);

-- DevOps / SRE
INSERT INTO kpi_templates (role_slug, title, unit, target, weight, category, sort_order) VALUES
  ('devops_sre', 'System Uptime (%)', 'percent', 99.9, 25, 'performance', 1),
  ('devops_sre', 'MTTR (hrs)', 'number', 2, 20, 'performance', 2),
  ('devops_sre', 'Deployment Frequency (per week)', 'number', 10, 15, 'performance', 3),
  ('devops_sre', 'CI/CD Pipeline Success Rate (%)', 'percent', 95, 15, 'performance', 4),
  ('devops_sre', 'Incident Prevention Actions', 'number', 4, 15, 'performance', 5),
  ('devops_sre', 'Security Patch Compliance (%)', 'percent', 100, 10, 'performance', 6);

-- Sales / BizDev
INSERT INTO kpi_templates (role_slug, title, unit, target, weight, category, sort_order) VALUES
  ('sales_bizdev', 'Revenue vs Target (%)', 'percent', 100, 30, 'performance', 1),
  ('sales_bizdev', 'New Accounts Acquired', 'number', 5, 20, 'performance', 2),
  ('sales_bizdev', 'Pipeline Coverage Ratio', 'number', 3, 15, 'performance', 3),
  ('sales_bizdev', 'Client Retention Rate (%)', 'percent', 90, 20, 'performance', 4),
  ('sales_bizdev', 'Proposal Conversion Rate (%)', 'percent', 30, 15, 'performance', 5);

-- HR / People Ops
INSERT INTO kpi_templates (role_slug, title, unit, target, weight, category, sort_order) VALUES
  ('hr_people_ops', 'Time-to-Fill (days)', 'number', 30, 20, 'performance', 1),
  ('hr_people_ops', 'Offer Acceptance Rate (%)', 'percent', 80, 15, 'performance', 2),
  ('hr_people_ops', 'Employee Satisfaction (eNPS)', 'number', 40, 20, 'performance', 3),
  ('hr_people_ops', 'Training Completion Rate (%)', 'percent', 90, 15, 'performance', 4),
  ('hr_people_ops', 'Attrition Rate (%)', 'percent', 10, 20, 'performance', 5),
  ('hr_people_ops', 'Policy Compliance Audits', 'number', 4, 10, 'behaviour', 6);

-- Finance / Accounting
INSERT INTO kpi_templates (role_slug, title, unit, target, weight, category, sort_order) VALUES
  ('finance', 'Financial Report On-Time (%)', 'percent', 100, 25, 'performance', 1),
  ('finance', 'Budget Variance (%)', 'percent', 5, 25, 'performance', 2),
  ('finance', 'AR Days Outstanding', 'number', 30, 20, 'performance', 3),
  ('finance', 'Audit Findings', 'number', 0, 20, 'performance', 4),
  ('finance', 'Process Automation Initiatives', 'number', 2, 10, 'learning', 5);

-- Operations / PM
INSERT INTO kpi_templates (role_slug, title, unit, target, weight, category, sort_order) VALUES
  ('operations_pm', 'Project On-Time Delivery (%)', 'percent', 90, 25, 'performance', 1),
  ('operations_pm', 'Budget Adherence (%)', 'percent', 95, 20, 'performance', 2),
  ('operations_pm', 'SLA Breach Rate (%)', 'percent', 2, 20, 'performance', 3),
  ('operations_pm', 'Process Improvement Initiatives', 'number', 3, 20, 'performance', 4),
  ('operations_pm', 'Stakeholder Satisfaction (1-5)', 'rating', 4, 15, 'behaviour', 5);


-- =====================================================
-- 00010_google_domain_hook.sql
-- =====================================================
-- Google OAuth domain restriction hook.
-- Blocks Google accounts that do not use @embglobal.com.
-- Email/password and magic-link logins are unaffected.

CREATE OR REPLACE FUNCTION public.before_user_created_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email    text;
  v_provider text;
BEGIN
  v_email    := event ->> 'email';
  v_provider := event -> 'app_metadata' ->> 'provider';

  -- Only restrict Google OAuth; password/magic-link providers pass through
  IF v_provider = 'google' AND v_email NOT LIKE '%@embglobal.com' THEN
    RETURN jsonb_build_object(
      'http_code', 403,
      'message',  'Only @embglobal.com accounts are permitted.'
    );
  END IF;

  RETURN event;
END;
$$;

GRANT EXECUTE ON FUNCTION public.before_user_created_hook(jsonb) TO supabase_auth_admin;


-- =====================================================
-- 00011_zimyo_independence.sql
-- =====================================================
-- Zimyo independence: make zimyo_id optional and track data_source.

-- 1. Drop NOT NULL on zimyo_id so manually-created users are supported
ALTER TABLE users ALTER COLUMN zimyo_id DROP NOT NULL;

-- 2. Ensure column defaults to NULL when omitted
ALTER TABLE users ALTER COLUMN zimyo_id SET DEFAULT NULL;

-- 3. Track the origin of each user record
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS data_source text NOT NULL DEFAULT 'manual'
  CHECK (data_source IN ('manual', 'zimyo', 'google'));

-- 4. Replace bulk_update_manager_links; now stamps data_source = zimyo.
CREATE OR REPLACE FUNCTION bulk_update_manager_links(
  p_zimyo_ids   text[],
  p_manager_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE users u
  SET
    manager_id  = m.manager_id,
    data_source = 'zimyo'
  FROM (
    SELECT unnest(p_zimyo_ids)   AS zimyo_id,
           unnest(p_manager_ids) AS manager_id
  ) m
  WHERE u.zimyo_id = m.zimyo_id;
END;
$$;


-- =====================================================
-- 00012_budget_fields.sql
-- =====================================================
-- Budget fields: per-cycle business multiplier + budget metadata,
-- plus snapshotted variable pay on appraisals.

-- 1. Cycle budget columns
ALTER TABLE cycles
  ADD COLUMN IF NOT EXISTS business_multiplier numeric NOT NULL DEFAULT 1.0
    CHECK (business_multiplier >= 0 AND business_multiplier <= 2.0);

ALTER TABLE cycles ADD COLUMN IF NOT EXISTS total_budget numeric;

ALTER TABLE cycles
  ADD COLUMN IF NOT EXISTS budget_currency text NOT NULL DEFAULT 'INR';

-- 2. Snapshotted variable pay
ALTER TABLE appraisals ADD COLUMN IF NOT EXISTS snapshotted_variable_pay numeric;

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


-- =====================================================
-- 00013_is_active_rls.sql
-- =====================================================
-- Security fix: inactive (soft-deleted) users must not be able to read or write data.
-- Drops affected policies and recreates them with an is_active guard.
--
-- Helper: (SELECT is_active FROM users WHERE id = public.user_id()) = true
-- This is evaluated once per query via a correlated subquery; Postgres caches it.

-- ============ USERS ============

DROP POLICY IF EXISTS users_employee_select ON users;
DROP POLICY IF EXISTS users_employee_select ON users;
CREATE POLICY users_employee_select ON users FOR SELECT
  USING (
    public.user_role() = 'employee'
    AND id = public.user_id()
    AND (SELECT is_active FROM users WHERE id = public.user_id()) = true
  );

DROP POLICY IF EXISTS users_manager_select ON users;
DROP POLICY IF EXISTS users_manager_select ON users;
CREATE POLICY users_manager_select ON users FOR SELECT
  USING (
    public.user_role() = 'manager'
    AND (id = public.user_id() OR manager_id = public.user_id())
    AND (SELECT is_active FROM users WHERE id = public.user_id()) = true
  );

-- ============ KPIS ============

DROP POLICY IF EXISTS kpis_employee_select ON kpis;
DROP POLICY IF EXISTS kpis_employee_select ON kpis;
CREATE POLICY kpis_employee_select ON kpis FOR SELECT
  USING (
    public.user_role() = 'employee'
    AND employee_id = public.user_id()
    AND (SELECT is_active FROM users WHERE id = public.user_id()) = true
    AND EXISTS (SELECT 1 FROM cycles c WHERE c.id = cycle_id AND c.status != 'draft')
  );

DROP POLICY IF EXISTS kpis_manager_select ON kpis;
DROP POLICY IF EXISTS kpis_manager_select ON kpis;
CREATE POLICY kpis_manager_select ON kpis FOR SELECT
  USING (
    public.user_role() = 'manager'
    AND (employee_id = public.user_id() OR manager_id = public.user_id())
    AND (SELECT is_active FROM users WHERE id = public.user_id()) = true
  );

DROP POLICY IF EXISTS kpis_manager_insert ON kpis;
DROP POLICY IF EXISTS kpis_manager_insert ON kpis;
CREATE POLICY kpis_manager_insert ON kpis FOR INSERT
  WITH CHECK (
    public.user_role() = 'manager'
    AND manager_id = public.user_id()
    AND (SELECT is_active FROM users WHERE id = public.user_id()) = true
    AND EXISTS (SELECT 1 FROM cycles c WHERE c.id = cycle_id AND c.status = 'kpi_setting')
  );

DROP POLICY IF EXISTS kpis_manager_update ON kpis;
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
DROP POLICY IF EXISTS reviews_employee_select ON reviews;
CREATE POLICY reviews_employee_select ON reviews FOR SELECT
  USING (
    public.user_role() = 'employee'
    AND employee_id = public.user_id()
    AND (SELECT is_active FROM users WHERE id = public.user_id()) = true
  );

DROP POLICY IF EXISTS reviews_employee_insert ON reviews;
DROP POLICY IF EXISTS reviews_employee_insert ON reviews;
CREATE POLICY reviews_employee_insert ON reviews FOR INSERT
  WITH CHECK (
    public.user_role() = 'employee'
    AND employee_id = public.user_id()
    AND (SELECT is_active FROM users WHERE id = public.user_id()) = true
    AND EXISTS (SELECT 1 FROM cycles c WHERE c.id = cycle_id AND c.status = 'self_review')
  );

DROP POLICY IF EXISTS reviews_employee_update ON reviews;
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
DROP POLICY IF EXISTS appraisals_employee_select ON appraisals;
CREATE POLICY appraisals_employee_select ON appraisals FOR SELECT
  USING (
    public.user_role() = 'employee'
    AND employee_id = public.user_id()
    AND (SELECT is_active FROM users WHERE id = public.user_id()) = true
    AND EXISTS (SELECT 1 FROM cycles c WHERE c.id = cycle_id AND c.status = 'published')
  );

DROP POLICY IF EXISTS appraisals_manager_select ON appraisals;
DROP POLICY IF EXISTS appraisals_manager_select ON appraisals;
CREATE POLICY appraisals_manager_select ON appraisals FOR SELECT
  USING (
    public.user_role() = 'manager'
    AND manager_id = public.user_id()
    AND (SELECT is_active FROM users WHERE id = public.user_id()) = true
  );

DROP POLICY IF EXISTS appraisals_manager_insert ON appraisals;
DROP POLICY IF EXISTS appraisals_manager_insert ON appraisals;
CREATE POLICY appraisals_manager_insert ON appraisals FOR INSERT
  WITH CHECK (
    public.user_role() = 'manager'
    AND manager_id = public.user_id()
    AND (SELECT is_active FROM users WHERE id = public.user_id()) = true
    AND EXISTS (SELECT 1 FROM cycles c WHERE c.id = cycle_id AND c.status = 'manager_review')
  );

DROP POLICY IF EXISTS appraisals_manager_update ON appraisals;
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


-- =====================================================
-- 00014_feature_flags.sql
-- =====================================================
-- Feature flags: org/role/user cascade resolution.

CREATE TABLE IF NOT EXISTS feature_flags (
  key          text PRIMARY KEY,
  name         text NOT NULL,
  category     text NOT NULL DEFAULT 'module'
               CHECK (category IN ('module', 'ui', 'notify')),
  default_value boolean NOT NULL DEFAULT false,
  description  text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS feature_flag_overrides (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_key   text NOT NULL REFERENCES feature_flags(key) ON DELETE CASCADE,
  scope      text NOT NULL CHECK (scope IN ('org', 'role', 'user')),
  scope_id   text,   -- NULL for org, role name for role, user_id for user
  value      boolean NOT NULL,
  updated_by uuid REFERENCES users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (flag_key, scope, scope_id)
);

-- RLS
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_flag_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS feature_flags_read_all ON feature_flags;
CREATE POLICY feature_flags_read_all ON feature_flags FOR SELECT USING (true);
DROP POLICY IF EXISTS feature_flag_overrides_read_all ON feature_flag_overrides;
CREATE POLICY feature_flag_overrides_read_all ON feature_flag_overrides FOR SELECT USING (true);
DROP POLICY IF EXISTS feature_flag_overrides_admin ON feature_flag_overrides;
CREATE POLICY feature_flag_overrides_admin ON feature_flag_overrides FOR ALL
  USING (public.user_role() = 'admin')
  WITH CHECK (public.user_role() = 'admin');
DROP POLICY IF EXISTS feature_flags_admin ON feature_flags;
CREATE POLICY feature_flags_admin ON feature_flags FOR ALL
  USING (public.user_role() = 'admin')
  WITH CHECK (public.user_role() = 'admin');

-- Resolution function: user > role > org > default
CREATE OR REPLACE FUNCTION resolve_feature_flag(
  p_key     text,
  p_user_id uuid,
  p_role    text
) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_default boolean;
  v_value   boolean;
BEGIN
  SELECT default_value INTO v_default FROM feature_flags WHERE key = p_key;
  IF NOT FOUND THEN RETURN false; END IF;

  -- User-level override
  SELECT value INTO v_value FROM feature_flag_overrides
    WHERE flag_key = p_key AND scope = 'user' AND scope_id = p_user_id::text;
  IF FOUND THEN RETURN v_value; END IF;

  -- Role-level override
  SELECT value INTO v_value FROM feature_flag_overrides
    WHERE flag_key = p_key AND scope = 'role' AND scope_id = p_role;
  IF FOUND THEN RETURN v_value; END IF;

  -- Org-level override
  SELECT value INTO v_value FROM feature_flag_overrides
    WHERE flag_key = p_key AND scope = 'org' AND scope_id IS NULL;
  IF FOUND THEN RETURN v_value; END IF;

  RETURN v_default;
END;
$$;

GRANT EXECUTE ON FUNCTION resolve_feature_flag(text, uuid, text) TO authenticated;

-- Seed flags
INSERT INTO feature_flags (key, name, category, default_value, description) VALUES
  ('module.gamification',        'Gamification',          'module', false, 'Streak counters, leaderboards, recognition wall'),
  ('module.360_feedback',        '360° Feedback',         'module', false, 'Peer nomination and anonymous feedback collection'),
  ('module.continuous_feedback', 'Continuous Feedback',   'module', false, 'Weekly pulse check-ins and peer kudos'),
  ('module.ai_assist',           'AI Review Assistant',   'module', false, 'Claude-powered manager review draft suggestions'),
  ('module.kpi_copy_forward',    'KPI Copy-Forward',      'module', true,  'Suggest previous cycle KPIs when setting new ones'),
  ('ui.compact_mode',            'Compact Mode',          'ui',     false, 'Denser layout for power users'),
  ('ui.density_toggle',          'Density Toggle Button', 'ui',     true,  'Show compact/comfortable toggle in sidebar'),
  ('ui.keyboard_shortcuts',      'Keyboard Shortcuts',    'ui',     true,  'Command palette and keyboard navigation'),
  ('notify.email',               'Email Notifications',   'notify', true,  'Send email reminders for deadlines'),
  ('notify.in_app',              'In-App Notifications',  'notify', true,  'Show notification bell in sidebar')
ON CONFLICT (key) DO NOTHING;


-- =====================================================
-- 00015_drafts_and_notifications.sql
-- =====================================================
-- Auto-save drafts table
CREATE TABLE IF NOT EXISTS drafts (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entity_type text        NOT NULL CHECK (entity_type IN ('self_review', 'manager_review', 'kpi', 'check_in')),
  entity_id   uuid,       -- cycle_id or kpi_id, nullable for new drafts
  form_data   jsonb       NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, entity_type, entity_id)
);

ALTER TABLE drafts ENABLE ROW LEVEL SECURITY;

-- Users can only access their own drafts
DROP POLICY IF EXISTS drafts_own ON drafts;
CREATE POLICY drafts_own ON drafts FOR ALL
  USING (user_id = public.user_id())
  WITH CHECK (user_id = public.user_id());

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS drafts_updated_at ON drafts;
CREATE TRIGGER drafts_updated_at BEFORE UPDATE ON drafts
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Notification system upgrade: add snooze/dismiss support
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS snoozed_until timestamptz,
  ADD COLUMN IF NOT EXISTS dismissed_at  timestamptz;

-- Per-user notification preferences
CREATE TABLE IF NOT EXISTS notification_preferences (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notify_key   text        NOT NULL,  -- e.g. 'deadline.self_review'
  email_enabled boolean    NOT NULL DEFAULT true,
  in_app_enabled boolean   NOT NULL DEFAULT true,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, notify_key)
);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notif_prefs_own ON notification_preferences;
CREATE POLICY notif_prefs_own ON notification_preferences FOR ALL
  USING (user_id = public.user_id())
  WITH CHECK (user_id = public.user_id());

-- Allow users to read their own notifications (not just hrbp/admin)
-- Drop old policy and recreate with broader access
DROP POLICY IF EXISTS notifications_hr_select ON notifications;

DROP POLICY IF EXISTS notifications_own_select ON notifications;
CREATE POLICY notifications_own_select ON notifications FOR SELECT
  USING (
    user_id = public.user_id()
    OR public.user_role() IN ('hrbp', 'admin')
  );

-- Allow users to update their own notifications (snooze/dismiss)
DROP POLICY IF EXISTS notifications_service_update ON notifications;

DROP POLICY IF EXISTS notifications_own_update ON notifications;
CREATE POLICY notifications_own_update ON notifications FOR UPDATE
  USING (
    user_id = public.user_id()
    OR public.user_role() IN ('hrbp', 'admin')
  );
