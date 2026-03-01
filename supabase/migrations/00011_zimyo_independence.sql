-- Zimyo independence: make zimyo_id optional and track data_source.

-- 1. Drop NOT NULL on zimyo_id so manually-created users are supported
ALTER TABLE users ALTER COLUMN zimyo_id DROP NOT NULL;

-- 2. Ensure column defaults to NULL when omitted
ALTER TABLE users ALTER COLUMN zimyo_id SET DEFAULT NULL;

-- 3. Track the origin of each user record
ALTER TABLE users
  ADD COLUMN data_source text NOT NULL DEFAULT 'manual'
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