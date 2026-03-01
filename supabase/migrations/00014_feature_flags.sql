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
