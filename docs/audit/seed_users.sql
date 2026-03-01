-- =====================================================
-- SEED USERS
-- Creates 10 test users + their Supabase Auth accounts.
--
-- IMPORTANT: Run the migration file FIRST, then run this.
--
-- Step 1: Run this entire file in the Supabase SQL Editor.
--         It inserts directly into auth.users + public.users.
-- Step 2: Each user can log in with password "password123"
--         (or use the quick-fill pills on /login).
--
-- Accounts:
--   admin@test.com      → admin
--   hrbp@test.com       → hrbp
--   manager@test.com    → manager (Alice — manages Bob, Dave, Eve)
--   frank@test.com      → manager (Frank — manages Grace, Henry, Irene)
--   employee@test.com   → employee (Bob)
--   dave@test.com       → employee
--   eve@test.com        → employee
--   grace@test.com      → employee
--   henry@test.com      → employee
--   irene@test.com      → employee
-- =====================================================

-- ── 1. Insert auth users (password = "password123" for all) ──────────────
-- The bcrypt hash below corresponds to "password123".
-- Generated with: SELECT crypt('password123', gen_salt('bf'));
-- If it doesn't work, regenerate: SELECT crypt('password123', gen_salt('bf'));

DO $$
DECLARE
  pw_hash text := crypt('password123', gen_salt('bf'));

  id_admin    uuid := '00000000-0000-0000-0000-000000000001';
  id_hrbp     uuid := '00000000-0000-0000-0000-000000000002';
  id_alice    uuid := '00000000-0000-0000-0000-000000000003';
  id_frank    uuid := '00000000-0000-0000-0000-000000000004';
  id_bob      uuid := '00000000-0000-0000-0000-000000000005';
  id_dave     uuid := '00000000-0000-0000-0000-000000000006';
  id_eve      uuid := '00000000-0000-0000-0000-000000000007';
  id_grace    uuid := '00000000-0000-0000-0000-000000000008';
  id_henry    uuid := '00000000-0000-0000-0000-000000000009';
  id_irene    uuid := '00000000-0000-0000-0000-000000000010';

  emails text[] := ARRAY[
    'admin@test.com', 'hrbp@test.com', 'manager@test.com', 'frank@test.com',
    'employee@test.com', 'dave@test.com', 'eve@test.com',
    'grace@test.com', 'henry@test.com', 'irene@test.com'
  ];
  ids uuid[] := ARRAY[
    id_admin, id_hrbp, id_alice, id_frank,
    id_bob, id_dave, id_eve, id_grace, id_henry, id_irene
  ];
  i int;
BEGIN
  -- Insert into auth.users for each account
  FOR i IN 1..array_length(emails, 1) LOOP
    INSERT INTO auth.users (
      id, instance_id, aud, role,
      email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      is_super_admin, confirmation_token, recovery_token,
      email_change_token_new, email_change
    ) VALUES (
      ids[i],
      '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      emails[i], pw_hash,
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}',
      '{}',
      false, '', '', '', ''
    )
    ON CONFLICT (id) DO NOTHING;

    -- Identity record (required for password login)
    INSERT INTO auth.identities (
      id, user_id, provider_id, provider,
      identity_data, created_at, updated_at, last_sign_in_at
    ) VALUES (
      ids[i], ids[i], emails[i], 'email',
      json_build_object('sub', ids[i]::text, 'email', emails[i])::jsonb,
      now(), now(), now()
    )
    ON CONFLICT (provider, provider_id) DO NOTHING;
  END LOOP;
END $$;


-- ── 2. Insert public.users ────────────────────────────────────────────────
INSERT INTO public.users (id, zimyo_id, email, full_name, role, department, designation, variable_pay, is_active, data_source)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'Z001', 'admin@test.com',    'Admin User',    'admin',    'HR',          'System Admin',         0,      true, 'manual'),
  ('00000000-0000-0000-0000-000000000002', 'Z002', 'hrbp@test.com',     'HR Partner',    'hrbp',     'HR',          'HR Business Partner',  0,      true, 'manual'),
  ('00000000-0000-0000-0000-000000000003', 'Z003', 'manager@test.com',  'Alice Manager', 'manager',  'Engineering', 'Engineering Manager',  0,      true, 'manual'),
  ('00000000-0000-0000-0000-000000000004', 'Z004', 'frank@test.com',    'Frank Manager', 'manager',  'Product',     'Product Manager',      0,      true, 'manual'),
  ('00000000-0000-0000-0000-000000000005', 'Z005', 'employee@test.com', 'Bob Employee',  'employee', 'Engineering', 'Software Engineer',    50000,  true, 'manual'),
  ('00000000-0000-0000-0000-000000000006', 'Z006', 'dave@test.com',     'Dave Employee', 'employee', 'Engineering', 'Senior Engineer',      60000,  true, 'manual'),
  ('00000000-0000-0000-0000-000000000007', 'Z007', 'eve@test.com',      'Eve Employee',  'employee', 'Engineering', 'Software Engineer',    50000,  true, 'manual'),
  ('00000000-0000-0000-0000-000000000008', 'Z008', 'grace@test.com',    'Grace Employee','employee', 'Product',     'Product Designer',     55000,  true, 'manual'),
  ('00000000-0000-0000-0000-000000000009', 'Z009', 'henry@test.com',    'Henry Employee','employee', 'Product',     'Product Analyst',      52000,  true, 'manual'),
  ('00000000-0000-0000-0000-000000000010', 'Z010', 'irene@test.com',    'Irene Employee','employee', 'Product',     'UX Researcher',        53000,  true, 'manual')
ON CONFLICT (id) DO NOTHING;


-- ── 3. Wire up manager relationships ─────────────────────────────────────
-- Alice manages: Bob, Dave, Eve
UPDATE public.users SET manager_id = '00000000-0000-0000-0000-000000000003'
WHERE id IN (
  '00000000-0000-0000-0000-000000000005',
  '00000000-0000-0000-0000-000000000006',
  '00000000-0000-0000-0000-000000000007'
);

-- Frank manages: Grace, Henry, Irene
UPDATE public.users SET manager_id = '00000000-0000-0000-0000-000000000004'
WHERE id IN (
  '00000000-0000-0000-0000-000000000008',
  '00000000-0000-0000-0000-000000000009',
  '00000000-0000-0000-0000-000000000010'
);
