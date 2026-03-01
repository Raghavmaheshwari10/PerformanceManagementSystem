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