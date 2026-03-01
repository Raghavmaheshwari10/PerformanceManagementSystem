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
