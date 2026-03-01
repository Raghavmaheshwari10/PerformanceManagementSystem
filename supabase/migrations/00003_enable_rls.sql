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
