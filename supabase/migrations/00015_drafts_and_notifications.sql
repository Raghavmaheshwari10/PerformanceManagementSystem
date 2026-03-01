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
