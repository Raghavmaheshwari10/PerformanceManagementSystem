-- =====================================================
-- Combined migrations: 00013_is_active_rls + 00014_feature_flags + 00015_drafts_and_notifications
-- Apply via Supabase SQL Editor at:
--   https://supabase.com/dashboard/project/cekmehtfghzhnzmxjbcx/sql
-- =====================================================

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


-- =====================================================
-- 00014_feature_flags.sql
-- =====================================================
-- Feature flags: org/role/user cascade resolution.

CREATE TABLE feature_flags (
  key          text PRIMARY KEY,
  name         text NOT NULL,
  category     text NOT NULL DEFAULT 'module'
               CHECK (category IN ('module', 'ui', 'notify')),
  default_value boolean NOT NULL DEFAULT false,
  description  text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE feature_flag_overrides (
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

CREATE POLICY feature_flags_read_all ON feature_flags FOR SELECT USING (true);
CREATE POLICY feature_flag_overrides_read_all ON feature_flag_overrides FOR SELECT USING (true);
CREATE POLICY feature_flag_overrides_admin ON feature_flag_overrides FOR ALL
  USING (public.user_role() = 'admin')
  WITH CHECK (public.user_role() = 'admin');
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
CREATE TABLE drafts (
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
CREATE POLICY drafts_own ON drafts FOR ALL
  USING (user_id = public.user_id())
  WITH CHECK (user_id = public.user_id());

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER drafts_updated_at BEFORE UPDATE ON drafts
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Notification system upgrade: add snooze/dismiss support
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS snoozed_until timestamptz,
  ADD COLUMN IF NOT EXISTS dismissed_at  timestamptz;

-- Per-user notification preferences
CREATE TABLE notification_preferences (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notify_key   text        NOT NULL,  -- e.g. 'deadline.self_review'
  email_enabled boolean    NOT NULL DEFAULT true,
  in_app_enabled boolean   NOT NULL DEFAULT true,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, notify_key)
);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY notif_prefs_own ON notification_preferences FOR ALL
  USING (user_id = public.user_id())
  WITH CHECK (user_id = public.user_id());

-- Allow users to read their own notifications (not just hrbp/admin)
-- Drop old policy and recreate with broader access
DROP POLICY IF EXISTS notifications_hr_select ON notifications;

CREATE POLICY notifications_own_select ON notifications FOR SELECT
  USING (
    user_id = public.user_id()
    OR public.user_role() IN ('hrbp', 'admin')
  );

-- Allow users to update their own notifications (snooze/dismiss)
DROP POLICY IF EXISTS notifications_service_update ON notifications;

CREATE POLICY notifications_own_update ON notifications FOR UPDATE
  USING (
    user_id = public.user_id()
    OR public.user_role() IN ('hrbp', 'admin')
  );

