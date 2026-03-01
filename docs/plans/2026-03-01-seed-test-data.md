# Seed Test Data Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create migration `00017_seed_test_data.sql` that inserts 10 users, 5 cycles across all pipeline stages, and realistic KPI/review/appraisal data for UX testing.

**Architecture:** Single SQL migration file built up in four tasks. Hardcoded deterministic UUIDs for cross-table FK readability (users: `00000001-...-000N`, cycles: `00000002-...-000N`). Users inserted with `ON CONFLICT (id) DO NOTHING` for idempotency. KPIs/reviews/appraisals inserted plain (start empty after `db reset`). No unit tests — verification is `db reset` + psql count/spot queries.

**Tech Stack:** PostgreSQL 17, Supabase Auth schema, pgcrypto (`crypt`/`gen_salt`), Supabase CLI (`npx supabase db reset`), psql connection string `postgresql://postgres:postgres@127.0.0.1:54161/postgres`

---

## UUID Reference

```
Users:
  admin:   00000001-0000-0000-0000-000000000001  (admin@test.com / admin123)
  hrbp:    00000001-0000-0000-0000-000000000002  (hrbp@test.com / hrbp123)
  alice:   00000001-0000-0000-0000-000000000003  (manager@test.com / manager123)
  frank:   00000001-0000-0000-0000-000000000004  (frank@test.com / frank123)
  bob:     00000001-0000-0000-0000-000000000005  (employee@test.com / employee123)
  dave:    00000001-0000-0000-0000-000000000006  (dave@test.com / dave123)
  eve:     00000001-0000-0000-0000-000000000007  (eve@test.com / eve123)
  grace:   00000001-0000-0000-0000-000000000008  (grace@test.com / grace123)
  henry:   00000001-0000-0000-0000-000000000009  (henry@test.com / henry123)
  irene:   00000001-0000-0000-0000-000000000010  (irene@test.com / irene123)

Cycles:
  q1_pub:  00000002-0000-0000-0000-000000000001  Q1 2025  published
  q2_cal:  00000002-0000-0000-0000-000000000002  Q2 2025  calibrating
  q3_mgr:  00000002-0000-0000-0000-000000000003  Q3 2025  manager_review
  q4_slf:  00000002-0000-0000-0000-000000000004  Q4 2025  self_review
  q1_kpi:  00000002-0000-0000-0000-000000000005  Q1 2026  kpi_setting
```

---

### Task 1: Create migration file — auth users + public users

**Files:**
- Create: `supabase/migrations/00017_seed_test_data.sql`

**Step 1: Create the file with this exact content**

```sql
-- ============================================================
-- 00017_seed_test_data.sql
-- Seed realistic test data for local dev UX testing.
-- Safe to re-run: auth.users and public.users use ON CONFLICT DO NOTHING.
-- KPIs, reviews, appraisals: plain INSERT (tables start empty after db reset).
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- SECTION 1: AUTH USERS
-- ──────────────────────────────────────────────────────────
INSERT INTO auth.users (
  id, instance_id, aud, role,
  email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) VALUES
  ('00000001-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated',
   'admin@test.com',    crypt('admin123',    gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}','{}', now(), now(), '','','',''),
  ('00000001-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated',
   'hrbp@test.com',     crypt('hrbp123',     gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}','{}', now(), now(), '','','',''),
  ('00000001-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated',
   'manager@test.com',  crypt('manager123',  gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}','{}', now(), now(), '','','',''),
  ('00000001-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated',
   'frank@test.com',    crypt('frank123',    gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}','{}', now(), now(), '','','',''),
  ('00000001-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000000','authenticated','authenticated',
   'employee@test.com', crypt('employee123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}','{}', now(), now(), '','','',''),
  ('00000001-0000-0000-0000-000000000006','00000000-0000-0000-0000-000000000000','authenticated','authenticated',
   'dave@test.com',     crypt('dave123',     gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}','{}', now(), now(), '','','',''),
  ('00000001-0000-0000-0000-000000000007','00000000-0000-0000-0000-000000000000','authenticated','authenticated',
   'eve@test.com',      crypt('eve123',      gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}','{}', now(), now(), '','','',''),
  ('00000001-0000-0000-0000-000000000008','00000000-0000-0000-0000-000000000000','authenticated','authenticated',
   'grace@test.com',    crypt('grace123',    gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}','{}', now(), now(), '','','',''),
  ('00000001-0000-0000-0000-000000000009','00000000-0000-0000-0000-000000000000','authenticated','authenticated',
   'henry@test.com',    crypt('henry123',    gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}','{}', now(), now(), '','','',''),
  ('00000001-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000000','authenticated','authenticated',
   'irene@test.com',    crypt('irene123',    gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}','{}', now(), now(), '','','','')
ON CONFLICT (id) DO NOTHING;

-- ──────────────────────────────────────────────────────────
-- SECTION 2: PUBLIC USERS
-- Managers inserted before employees (FK manager_id self-reference).
-- ──────────────────────────────────────────────────────────
INSERT INTO public.users (id, email, full_name, role, department, designation, variable_pay) VALUES
  ('00000001-0000-0000-0000-000000000001', 'admin@test.com',   'Admin User',  'admin',   'Administration',   'System Admin',          0),
  ('00000001-0000-0000-0000-000000000002', 'hrbp@test.com',    'Priya HRBP',  'hrbp',    'Human Resources',  'HR Business Partner',   0),
  ('00000001-0000-0000-0000-000000000003', 'manager@test.com', 'Alice Chen',  'manager', 'Engineering',      'Engineering Manager',   120000),
  ('00000001-0000-0000-0000-000000000004', 'frank@test.com',   'Frank Ramos', 'manager', 'Product',          'Product Manager',       100000)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.users (id, email, full_name, role, department, designation, manager_id, variable_pay) VALUES
  ('00000001-0000-0000-0000-000000000005', 'employee@test.com', 'Bob Kumar',    'employee', 'Engineering', 'Software Engineer',  '00000001-0000-0000-0000-000000000003', 80000),
  ('00000001-0000-0000-0000-000000000006', 'dave@test.com',     'Dave Singh',   'employee', 'Engineering', 'Software Engineer',  '00000001-0000-0000-0000-000000000003', 75000),
  ('00000001-0000-0000-0000-000000000007', 'eve@test.com',      'Eve Nair',     'employee', 'Engineering', 'Senior Engineer',    '00000001-0000-0000-0000-000000000003', 72000),
  ('00000001-0000-0000-0000-000000000008', 'grace@test.com',    'Grace Liu',    'employee', 'Product',     'Product Analyst',    '00000001-0000-0000-0000-000000000004', 68000),
  ('00000001-0000-0000-0000-000000000009', 'henry@test.com',    'Henry Park',   'employee', 'Product',     'UX Designer',        '00000001-0000-0000-0000-000000000004', 65000),
  ('00000001-0000-0000-0000-000000000010', 'irene@test.com',    'Irene Thomas', 'employee', 'Product',     'Business Analyst',   '00000001-0000-0000-0000-000000000004', 60000)
ON CONFLICT (id) DO NOTHING;
```

**Step 2: Run db reset**

```bash
npx supabase db reset
```

Expected: "Finished supabase db reset" with no errors.

**Step 3: Verify user counts**

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54161/postgres" \
  -c "SELECT COUNT(*) FROM auth.users;" \
  -c "SELECT role, COUNT(*) FROM public.users GROUP BY role ORDER BY role;"
```

Expected:
```
 count
-------
    10

  role   | count
----------+-------
 admin    |     1
 employee |     6
 hrbp     |     1
 manager  |     2
```

**Step 4: Commit**

```bash
git add supabase/migrations/00017_seed_test_data.sql
git commit -m "feat: seed migration — users (auth + public)"
```

---

### Task 2: Add cycles and KPIs

**Files:**
- Modify: `supabase/migrations/00017_seed_test_data.sql` (append to end)

**Step 1: Append the cycles section**

```sql
-- ──────────────────────────────────────────────────────────
-- SECTION 3: CYCLES
-- ──────────────────────────────────────────────────────────
INSERT INTO cycles (
  id, name, quarter, year, status,
  kpi_setting_deadline, self_review_deadline, manager_review_deadline, calibration_deadline,
  sme_multiplier, business_multiplier, total_budget, budget_currency,
  published_at, created_by
) VALUES
  -- Q1 2025: published (fully complete)
  ('00000002-0000-0000-0000-000000000001',
   'Annual Review FY2025-Q1', 'Q1', 2025, 'published',
   '2025-01-20', '2025-02-10', '2025-02-28', '2025-03-10',
   0.25, 0.9, 500000, 'INR',
   '2025-03-15 12:00:00+00', '00000001-0000-0000-0000-000000000001'),

  -- Q2 2025: calibrating (manager reviews done, HRBP calibrating)
  ('00000002-0000-0000-0000-000000000002',
   'Mid-Year Review FY2025-Q2', 'Q2', 2025, 'calibrating',
   '2025-04-20', '2025-05-10', '2025-05-28', '2025-06-10',
   0.25, 1.0, 550000, 'INR',
   NULL, '00000001-0000-0000-0000-000000000001'),

  -- Q3 2025: manager_review (self-reviews done, managers rating)
  ('00000002-0000-0000-0000-000000000003',
   'Q3 Review FY2025', 'Q3', 2025, 'manager_review',
   '2025-07-20', '2025-08-10', '2025-08-28', '2025-09-10',
   NULL, 1.0, NULL, 'INR',
   NULL, '00000001-0000-0000-0000-000000000001'),

  -- Q4 2025: self_review (KPIs set, employees reviewing)
  ('00000002-0000-0000-0000-000000000004',
   'Q4 Review FY2025', 'Q4', 2025, 'self_review',
   '2025-10-20', '2025-11-10', '2025-11-28', '2025-12-10',
   NULL, 1.0, NULL, 'INR',
   NULL, '00000001-0000-0000-0000-000000000001'),

  -- Q1 2026: kpi_setting (just started)
  ('00000002-0000-0000-0000-000000000005',
   'Q1 Review FY2026', 'Q1', 2026, 'kpi_setting',
   '2026-01-20', '2026-02-10', '2026-02-28', '2026-03-10',
   NULL, 1.0, NULL, 'INR',
   NULL, '00000001-0000-0000-0000-000000000001');
```

**Step 2: Append the KPIs section**

KPIs: 3 per employee per cycle. Weights: 40 / 35 / 25 = 100.
Q1–Q4: all 6 employees. Q1 FY2026: Alice's team only (Bob, Dave, Eve).

```sql
-- ──────────────────────────────────────────────────────────
-- SECTION 4: KPIs
-- 3 KPIs per employee, weights 40+35+25=100.
-- Q1-Q4: all 6 employees. Q1 FY2026: Bob/Dave/Eve only.
-- ──────────────────────────────────────────────────────────
INSERT INTO kpis (cycle_id, employee_id, manager_id, title, description, weight) VALUES
-- ── Q1 2025 (published) ──────────────────────────────────
  ('00000002-0000-0000-0000-000000000001','00000001-0000-0000-0000-000000000005','00000001-0000-0000-0000-000000000003','Delivery Quality','Maintain high standard across all deliverables',40),
  ('00000002-0000-0000-0000-000000000001','00000001-0000-0000-0000-000000000005','00000001-0000-0000-0000-000000000003','Collaboration & Communication','Effective teamwork and stakeholder communication',35),
  ('00000002-0000-0000-0000-000000000001','00000001-0000-0000-0000-000000000005','00000001-0000-0000-0000-000000000003','Learning & Development','Continuous skill growth and knowledge sharing',25),

  ('00000002-0000-0000-0000-000000000001','00000001-0000-0000-0000-000000000006','00000001-0000-0000-0000-000000000003','Delivery Quality','Maintain high standard across all deliverables',40),
  ('00000002-0000-0000-0000-000000000001','00000001-0000-0000-0000-000000000006','00000001-0000-0000-0000-000000000003','Collaboration & Communication','Effective teamwork and stakeholder communication',35),
  ('00000002-0000-0000-0000-000000000001','00000001-0000-0000-0000-000000000006','00000001-0000-0000-0000-000000000003','Learning & Development','Continuous skill growth and knowledge sharing',25),

  ('00000002-0000-0000-0000-000000000001','00000001-0000-0000-0000-000000000007','00000001-0000-0000-0000-000000000003','Delivery Quality','Maintain high standard across all deliverables',40),
  ('00000002-0000-0000-0000-000000000001','00000001-0000-0000-0000-000000000007','00000001-0000-0000-0000-000000000003','Collaboration & Communication','Effective teamwork and stakeholder communication',35),
  ('00000002-0000-0000-0000-000000000001','00000001-0000-0000-0000-000000000007','00000001-0000-0000-0000-000000000003','Learning & Development','Continuous skill growth and knowledge sharing',25),

  ('00000002-0000-0000-0000-000000000001','00000001-0000-0000-0000-000000000008','00000001-0000-0000-0000-000000000004','Delivery Quality','Maintain high standard across all deliverables',40),
  ('00000002-0000-0000-0000-000000000001','00000001-0000-0000-0000-000000000008','00000001-0000-0000-0000-000000000004','Collaboration & Communication','Effective teamwork and stakeholder communication',35),
  ('00000002-0000-0000-0000-000000000001','00000001-0000-0000-0000-000000000008','00000001-0000-0000-0000-000000000004','Learning & Development','Continuous skill growth and knowledge sharing',25),

  ('00000002-0000-0000-0000-000000000001','00000001-0000-0000-0000-000000000009','00000001-0000-0000-0000-000000000004','Delivery Quality','Maintain high standard across all deliverables',40),
  ('00000002-0000-0000-0000-000000000001','00000001-0000-0000-0000-000000000009','00000001-0000-0000-0000-000000000004','Collaboration & Communication','Effective teamwork and stakeholder communication',35),
  ('00000002-0000-0000-0000-000000000001','00000001-0000-0000-0000-000000000009','00000001-0000-0000-0000-000000000004','Learning & Development','Continuous skill growth and knowledge sharing',25),

  ('00000002-0000-0000-0000-000000000001','00000001-0000-0000-0000-000000000010','00000001-0000-0000-0000-000000000004','Delivery Quality','Maintain high standard across all deliverables',40),
  ('00000002-0000-0000-0000-000000000001','00000001-0000-0000-0000-000000000010','00000001-0000-0000-0000-000000000004','Collaboration & Communication','Effective teamwork and stakeholder communication',35),
  ('00000002-0000-0000-0000-000000000001','00000001-0000-0000-0000-000000000010','00000001-0000-0000-0000-000000000004','Learning & Development','Continuous skill growth and knowledge sharing',25),

-- ── Q2 2025 (calibrating) ────────────────────────────────
  ('00000002-0000-0000-0000-000000000002','00000001-0000-0000-0000-000000000005','00000001-0000-0000-0000-000000000003','Delivery Quality','Maintain high standard across all deliverables',40),
  ('00000002-0000-0000-0000-000000000002','00000001-0000-0000-0000-000000000005','00000001-0000-0000-0000-000000000003','Collaboration & Communication','Effective teamwork and stakeholder communication',35),
  ('00000002-0000-0000-0000-000000000002','00000001-0000-0000-0000-000000000005','00000001-0000-0000-0000-000000000003','Learning & Development','Continuous skill growth and knowledge sharing',25),

  ('00000002-0000-0000-0000-000000000002','00000001-0000-0000-0000-000000000006','00000001-0000-0000-0000-000000000003','Delivery Quality','Maintain high standard across all deliverables',40),
  ('00000002-0000-0000-0000-000000000002','00000001-0000-0000-0000-000000000006','00000001-0000-0000-0000-000000000003','Collaboration & Communication','Effective teamwork and stakeholder communication',35),
  ('00000002-0000-0000-0000-000000000002','00000001-0000-0000-0000-000000000006','00000001-0000-0000-0000-000000000003','Learning & Development','Continuous skill growth and knowledge sharing',25),

  ('00000002-0000-0000-0000-000000000002','00000001-0000-0000-0000-000000000007','00000001-0000-0000-0000-000000000003','Delivery Quality','Maintain high standard across all deliverables',40),
  ('00000002-0000-0000-0000-000000000002','00000001-0000-0000-0000-000000000007','00000001-0000-0000-0000-000000000003','Collaboration & Communication','Effective teamwork and stakeholder communication',35),
  ('00000002-0000-0000-0000-000000000002','00000001-0000-0000-0000-000000000007','00000001-0000-0000-0000-000000000003','Learning & Development','Continuous skill growth and knowledge sharing',25),

  ('00000002-0000-0000-0000-000000000002','00000001-0000-0000-0000-000000000008','00000001-0000-0000-0000-000000000004','Delivery Quality','Maintain high standard across all deliverables',40),
  ('00000002-0000-0000-0000-000000000002','00000001-0000-0000-0000-000000000008','00000001-0000-0000-0000-000000000004','Collaboration & Communication','Effective teamwork and stakeholder communication',35),
  ('00000002-0000-0000-0000-000000000002','00000001-0000-0000-0000-000000000008','00000001-0000-0000-0000-000000000004','Learning & Development','Continuous skill growth and knowledge sharing',25),

  ('00000002-0000-0000-0000-000000000002','00000001-0000-0000-0000-000000000009','00000001-0000-0000-0000-000000000004','Delivery Quality','Maintain high standard across all deliverables',40),
  ('00000002-0000-0000-0000-000000000002','00000001-0000-0000-0000-000000000009','00000001-0000-0000-0000-000000000004','Collaboration & Communication','Effective teamwork and stakeholder communication',35),
  ('00000002-0000-0000-0000-000000000002','00000001-0000-0000-0000-000000000009','00000001-0000-0000-0000-000000000004','Learning & Development','Continuous skill growth and knowledge sharing',25),

  ('00000002-0000-0000-0000-000000000002','00000001-0000-0000-0000-000000000010','00000001-0000-0000-0000-000000000004','Delivery Quality','Maintain high standard across all deliverables',40),
  ('00000002-0000-0000-0000-000000000002','00000001-0000-0000-0000-000000000010','00000001-0000-0000-0000-000000000004','Collaboration & Communication','Effective teamwork and stakeholder communication',35),
  ('00000002-0000-0000-0000-000000000002','00000001-0000-0000-0000-000000000010','00000001-0000-0000-0000-000000000004','Learning & Development','Continuous skill growth and knowledge sharing',25),

-- ── Q3 2025 (manager_review) ─────────────────────────────
  ('00000002-0000-0000-0000-000000000003','00000001-0000-0000-0000-000000000005','00000001-0000-0000-0000-000000000003','Delivery Quality','Maintain high standard across all deliverables',40),
  ('00000002-0000-0000-0000-000000000003','00000001-0000-0000-0000-000000000005','00000001-0000-0000-0000-000000000003','Collaboration & Communication','Effective teamwork and stakeholder communication',35),
  ('00000002-0000-0000-0000-000000000003','00000001-0000-0000-0000-000000000005','00000001-0000-0000-0000-000000000003','Learning & Development','Continuous skill growth and knowledge sharing',25),

  ('00000002-0000-0000-0000-000000000003','00000001-0000-0000-0000-000000000006','00000001-0000-0000-0000-000000000003','Delivery Quality','Maintain high standard across all deliverables',40),
  ('00000002-0000-0000-0000-000000000003','00000001-0000-0000-0000-000000000006','00000001-0000-0000-0000-000000000003','Collaboration & Communication','Effective teamwork and stakeholder communication',35),
  ('00000002-0000-0000-0000-000000000003','00000001-0000-0000-0000-000000000006','00000001-0000-0000-0000-000000000003','Learning & Development','Continuous skill growth and knowledge sharing',25),

  ('00000002-0000-0000-0000-000000000003','00000001-0000-0000-0000-000000000007','00000001-0000-0000-0000-000000000003','Delivery Quality','Maintain high standard across all deliverables',40),
  ('00000002-0000-0000-0000-000000000003','00000001-0000-0000-0000-000000000007','00000001-0000-0000-0000-000000000003','Collaboration & Communication','Effective teamwork and stakeholder communication',35),
  ('00000002-0000-0000-0000-000000000003','00000001-0000-0000-0000-000000000007','00000001-0000-0000-0000-000000000003','Learning & Development','Continuous skill growth and knowledge sharing',25),

  ('00000002-0000-0000-0000-000000000003','00000001-0000-0000-0000-000000000008','00000001-0000-0000-0000-000000000004','Delivery Quality','Maintain high standard across all deliverables',40),
  ('00000002-0000-0000-0000-000000000003','00000001-0000-0000-0000-000000000008','00000001-0000-0000-0000-000000000004','Collaboration & Communication','Effective teamwork and stakeholder communication',35),
  ('00000002-0000-0000-0000-000000000003','00000001-0000-0000-0000-000000000008','00000001-0000-0000-0000-000000000004','Learning & Development','Continuous skill growth and knowledge sharing',25),

  ('00000002-0000-0000-0000-000000000003','00000001-0000-0000-0000-000000000009','00000001-0000-0000-0000-000000000004','Delivery Quality','Maintain high standard across all deliverables',40),
  ('00000002-0000-0000-0000-000000000003','00000001-0000-0000-0000-000000000009','00000001-0000-0000-0000-000000000004','Collaboration & Communication','Effective teamwork and stakeholder communication',35),
  ('00000002-0000-0000-0000-000000000003','00000001-0000-0000-0000-000000000009','00000001-0000-0000-0000-000000000004','Learning & Development','Continuous skill growth and knowledge sharing',25),

  ('00000002-0000-0000-0000-000000000003','00000001-0000-0000-0000-000000000010','00000001-0000-0000-0000-000000000004','Delivery Quality','Maintain high standard across all deliverables',40),
  ('00000002-0000-0000-0000-000000000003','00000001-0000-0000-0000-000000000010','00000001-0000-0000-0000-000000000004','Collaboration & Communication','Effective teamwork and stakeholder communication',35),
  ('00000002-0000-0000-0000-000000000003','00000001-0000-0000-0000-000000000010','00000001-0000-0000-0000-000000000004','Learning & Development','Continuous skill growth and knowledge sharing',25),

-- ── Q4 2025 (self_review) ────────────────────────────────
  ('00000002-0000-0000-0000-000000000004','00000001-0000-0000-0000-000000000005','00000001-0000-0000-0000-000000000003','Delivery Quality','Maintain high standard across all deliverables',40),
  ('00000002-0000-0000-0000-000000000004','00000001-0000-0000-0000-000000000005','00000001-0000-0000-0000-000000000003','Collaboration & Communication','Effective teamwork and stakeholder communication',35),
  ('00000002-0000-0000-0000-000000000004','00000001-0000-0000-0000-000000000005','00000001-0000-0000-0000-000000000003','Learning & Development','Continuous skill growth and knowledge sharing',25),

  ('00000002-0000-0000-0000-000000000004','00000001-0000-0000-0000-000000000006','00000001-0000-0000-0000-000000000003','Delivery Quality','Maintain high standard across all deliverables',40),
  ('00000002-0000-0000-0000-000000000004','00000001-0000-0000-0000-000000000006','00000001-0000-0000-0000-000000000003','Collaboration & Communication','Effective teamwork and stakeholder communication',35),
  ('00000002-0000-0000-0000-000000000004','00000001-0000-0000-0000-000000000006','00000001-0000-0000-0000-000000000003','Learning & Development','Continuous skill growth and knowledge sharing',25),

  ('00000002-0000-0000-0000-000000000004','00000001-0000-0000-0000-000000000007','00000001-0000-0000-0000-000000000003','Delivery Quality','Maintain high standard across all deliverables',40),
  ('00000002-0000-0000-0000-000000000004','00000001-0000-0000-0000-000000000007','00000001-0000-0000-0000-000000000003','Collaboration & Communication','Effective teamwork and stakeholder communication',35),
  ('00000002-0000-0000-0000-000000000004','00000001-0000-0000-0000-000000000007','00000001-0000-0000-0000-000000000003','Learning & Development','Continuous skill growth and knowledge sharing',25),

  ('00000002-0000-0000-0000-000000000004','00000001-0000-0000-0000-000000000008','00000001-0000-0000-0000-000000000004','Delivery Quality','Maintain high standard across all deliverables',40),
  ('00000002-0000-0000-0000-000000000004','00000001-0000-0000-0000-000000000008','00000001-0000-0000-0000-000000000004','Collaboration & Communication','Effective teamwork and stakeholder communication',35),
  ('00000002-0000-0000-0000-000000000004','00000001-0000-0000-0000-000000000008','00000001-0000-0000-0000-000000000004','Learning & Development','Continuous skill growth and knowledge sharing',25),

  ('00000002-0000-0000-0000-000000000004','00000001-0000-0000-0000-000000000009','00000001-0000-0000-0000-000000000004','Delivery Quality','Maintain high standard across all deliverables',40),
  ('00000002-0000-0000-0000-000000000004','00000001-0000-0000-0000-000000000009','00000001-0000-0000-0000-000000000004','Collaboration & Communication','Effective teamwork and stakeholder communication',35),
  ('00000002-0000-0000-0000-000000000004','00000001-0000-0000-0000-000000000009','00000001-0000-0000-0000-000000000004','Learning & Development','Continuous skill growth and knowledge sharing',25),

  ('00000002-0000-0000-0000-000000000004','00000001-0000-0000-0000-000000000010','00000001-0000-0000-0000-000000000004','Delivery Quality','Maintain high standard across all deliverables',40),
  ('00000002-0000-0000-0000-000000000004','00000001-0000-0000-0000-000000000010','00000001-0000-0000-0000-000000000004','Collaboration & Communication','Effective teamwork and stakeholder communication',35),
  ('00000002-0000-0000-0000-000000000004','00000001-0000-0000-0000-000000000010','00000001-0000-0000-0000-000000000004','Learning & Development','Continuous skill growth and knowledge sharing',25),

-- ── Q1 2026 (kpi_setting) — Alice's team only ────────────
  ('00000002-0000-0000-0000-000000000005','00000001-0000-0000-0000-000000000005','00000001-0000-0000-0000-000000000003','Delivery Quality','Maintain high standard across all deliverables',40),
  ('00000002-0000-0000-0000-000000000005','00000001-0000-0000-0000-000000000005','00000001-0000-0000-0000-000000000003','Collaboration & Communication','Effective teamwork and stakeholder communication',35),
  ('00000002-0000-0000-0000-000000000005','00000001-0000-0000-0000-000000000005','00000001-0000-0000-0000-000000000003','Learning & Development','Continuous skill growth and knowledge sharing',25),

  ('00000002-0000-0000-0000-000000000005','00000001-0000-0000-0000-000000000006','00000001-0000-0000-0000-000000000003','Delivery Quality','Maintain high standard across all deliverables',40),
  ('00000002-0000-0000-0000-000000000005','00000001-0000-0000-0000-000000000006','00000001-0000-0000-0000-000000000003','Collaboration & Communication','Effective teamwork and stakeholder communication',35),
  ('00000002-0000-0000-0000-000000000005','00000001-0000-0000-0000-000000000006','00000001-0000-0000-0000-000000000003','Learning & Development','Continuous skill growth and knowledge sharing',25),

  ('00000002-0000-0000-0000-000000000005','00000001-0000-0000-0000-000000000007','00000001-0000-0000-0000-000000000003','Delivery Quality','Maintain high standard across all deliverables',40),
  ('00000002-0000-0000-0000-000000000005','00000001-0000-0000-0000-000000000007','00000001-0000-0000-0000-000000000003','Collaboration & Communication','Effective teamwork and stakeholder communication',35),
  ('00000002-0000-0000-0000-000000000005','00000001-0000-0000-0000-000000000007','00000001-0000-0000-0000-000000000003','Learning & Development','Continuous skill growth and knowledge sharing',25);
```

**Step 3: Run db reset and verify**

```bash
npx supabase db reset
```

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54161/postgres" \
  -c "SELECT status, COUNT(*) FROM cycles GROUP BY status ORDER BY status;" \
  -c "SELECT cycle_id, COUNT(*) as kpi_count FROM kpis GROUP BY cycle_id ORDER BY cycle_id;"
```

Expected cycles:
```
    status     | count
---------------+-------
 calibrating   |     1
 kpi_setting   |     1
 manager_review|     1
 published     |     1
 self_review   |     1
```

Expected KPI counts: cycles 001–004 = 18 each, cycle 005 = 9.

**Step 4: Commit**

```bash
git add supabase/migrations/00017_seed_test_data.sql
git commit -m "feat: seed migration — cycles and KPIs"
```

---

### Task 3: Add reviews

**Files:**
- Modify: `supabase/migrations/00017_seed_test_data.sql` (append to end)

**Step 1: Append the reviews section**

Rating spread per cycle:
- Q1 (published): Bob ME-self/EE-mgr, Dave ME/ME, Eve EE/FEE, Grace ME/ME, Henry ME/BE, Irene EE/EE
- Q2 (calibrating): Bob EE, Dave ME, Eve EE, Grace ME, Henry BE, Irene EE
- Q3 (manager_review): all 6 submitted, same ratings as Q2
- Q4 (self_review): Bob EE, Dave ME, Grace EE submitted; Eve/Henry/Irene draft

```sql
-- ──────────────────────────────────────────────────────────
-- SECTION 5: REVIEWS
-- ──────────────────────────────────────────────────────────
INSERT INTO reviews (cycle_id, employee_id, self_rating, self_comments, status, submitted_at) VALUES
-- ── Q1 2025 (published) — all 6 submitted ───────────────
  ('00000002-0000-0000-0000-000000000001','00000001-0000-0000-0000-000000000005',
   'ME','I focused on shipping reliably this quarter and improved my code review turnaround. Areas to grow: proactive communication with cross-team stakeholders.','submitted','2025-02-08 10:00:00+00'),
  ('00000002-0000-0000-0000-000000000001','00000001-0000-0000-0000-000000000006',
   'ME','Delivered all sprint commitments on time. Strengthened documentation practices. Looking to take on more ownership next cycle.','submitted','2025-02-08 11:00:00+00'),
  ('00000002-0000-0000-0000-000000000001','00000001-0000-0000-0000-000000000007',
   'EE','Led the migration project end-to-end, mentored two junior engineers, and reduced CI flakiness by 60%. Exceeded my OKRs.','submitted','2025-02-07 14:00:00+00'),
  ('00000002-0000-0000-0000-000000000001','00000001-0000-0000-0000-000000000008',
   'ME','Completed all roadmap items with solid stakeholder alignment. Struggled with estimation accuracy in H2 — will focus on this next quarter.','submitted','2025-02-09 09:00:00+00'),
  ('00000002-0000-0000-0000-000000000001','00000001-0000-0000-0000-000000000009',
   'ME','Contributed to 3 major feature launches. My research quality improved, but collaboration with engineering was inconsistent at times.','submitted','2025-02-09 16:00:00+00'),
  ('00000002-0000-0000-0000-000000000001','00000001-0000-0000-0000-000000000010',
   'EE','Delivered the analytics dashboard ahead of schedule. Drove adoption across two teams and built self-serve reporting for stakeholders.','submitted','2025-02-08 15:00:00+00'),

-- ── Q2 2025 (calibrating) — all 6 submitted ─────────────
  ('00000002-0000-0000-0000-000000000002','00000001-0000-0000-0000-000000000005',
   'EE','Shipped the auth redesign and improved p95 latency by 40%. Took on incident lead rotation and resolved 3 P1s.','submitted','2025-05-08 10:00:00+00'),
  ('00000002-0000-0000-0000-000000000002','00000001-0000-0000-0000-000000000006',
   'ME','Maintained steady delivery pace. Started contributing to architecture discussions. Want to take more initiative next half.','submitted','2025-05-08 11:00:00+00'),
  ('00000002-0000-0000-0000-000000000002','00000001-0000-0000-0000-000000000007',
   'EE','Completed platform unification ahead of schedule, enabled 2 new product lines. Strong cross-team collaboration throughout.','submitted','2025-05-07 14:00:00+00'),
  ('00000002-0000-0000-0000-000000000002','00000001-0000-0000-0000-000000000008',
   'ME','Feature roadmap on track. Discovery quality improved. Some miscommunications on scope with engineering — resolved quickly.','submitted','2025-05-09 09:00:00+00'),
  ('00000002-0000-0000-0000-000000000002','00000001-0000-0000-0000-000000000009',
   'ME','Good foundational work on design systems. Delivery was slower than expected due to scope changes outside my control.','submitted','2025-05-09 16:00:00+00'),
  ('00000002-0000-0000-0000-000000000002','00000001-0000-0000-0000-000000000010',
   'EE','Drove the data platform migration. Enabled 3 new data products and cut manual reporting effort by 70%.','submitted','2025-05-08 15:00:00+00'),

-- ── Q3 2025 (manager_review) — all 6 submitted ──────────
  ('00000002-0000-0000-0000-000000000003','00000001-0000-0000-0000-000000000005',
   'EE','Led the backend API consolidation. Reduced service count from 12 to 7 with zero downtime. Strong quarter.','submitted','2025-08-08 10:00:00+00'),
  ('00000002-0000-0000-0000-000000000003','00000001-0000-0000-0000-000000000006',
   'ME','Delivered feature work consistently. Starting to own more complex scopes. Good progress on mentoring the intern.','submitted','2025-08-08 11:00:00+00'),
  ('00000002-0000-0000-0000-000000000003','00000001-0000-0000-0000-000000000007',
   'FEE','Defined and delivered the new observability stack used by 5 teams. Became the go-to for production debugging org-wide.','submitted','2025-08-07 14:00:00+00'),
  ('00000002-0000-0000-0000-000000000003','00000001-0000-0000-0000-000000000008',
   'ME','Ran successful beta for new pricing page. Good stakeholder communication throughout.','submitted','2025-08-09 09:00:00+00'),
  ('00000002-0000-0000-0000-000000000003','00000001-0000-0000-0000-000000000009',
   'EE','Redesigned onboarding flow — completion rate up 25%. Collaborated closely with product and engineering.','submitted','2025-08-09 16:00:00+00'),
  ('00000002-0000-0000-0000-000000000003','00000001-0000-0000-0000-000000000010',
   'ME','Delivered quarterly business review deck on time. Identified two cost optimisation opportunities worth ₹8L/year.','submitted','2025-08-08 15:00:00+00'),

-- ── Q4 2025 (self_review) — 3 submitted, 3 draft ────────
  ('00000002-0000-0000-0000-000000000004','00000001-0000-0000-0000-000000000005',
   'EE','Shipped the real-time notifications feature. Users love it — 80% opt-in in first week.','submitted','2025-11-08 10:00:00+00'),
  ('00000002-0000-0000-0000-000000000004','00000001-0000-0000-0000-000000000006',
   'ME','Focused on tech debt reduction this quarter. Removed 4 deprecated services, cut build time by 30%.','submitted','2025-11-09 11:00:00+00'),
  ('00000002-0000-0000-0000-000000000004','00000001-0000-0000-0000-000000000008',
   'EE','Launched 3 key features ahead of schedule. NPS for product area up 8 points.','submitted','2025-11-08 09:00:00+00'),
  -- Draft reviews (no self_rating, empty comments, no submitted_at)
  ('00000002-0000-0000-0000-000000000004','00000001-0000-0000-0000-000000000007',
   NULL,'','draft',NULL),
  ('00000002-0000-0000-0000-000000000004','00000001-0000-0000-0000-000000000009',
   NULL,'','draft',NULL),
  ('00000002-0000-0000-0000-000000000004','00000001-0000-0000-0000-000000000010',
   NULL,'','draft',NULL);
```

**Step 2: Run db reset and verify**

```bash
npx supabase db reset
```

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54161/postgres" \
  -c "SELECT cycle_id, status, COUNT(*) FROM reviews GROUP BY cycle_id, status ORDER BY cycle_id, status;"
```

Expected:
```
            cycle_id                | status    | count
------------------------------------+-----------+-------
 00000002-...-000000000001          | submitted |     6
 00000002-...-000000000002          | submitted |     6
 00000002-...-000000000003          | submitted |     6
 00000002-...-000000000004          | draft     |     3
 00000002-...-000000000004          | submitted |     3
```

**Step 3: Commit**

```bash
git add supabase/migrations/00017_seed_test_data.sql
git commit -m "feat: seed migration — reviews"
```

---

### Task 4: Add appraisals + final verification

**Files:**
- Modify: `supabase/migrations/00017_seed_test_data.sql` (append to end)

**Step 1: Append the appraisals section**

Payout multipliers (from migration 00012): BE=0, ME=1.0, EE=1.10, FEE=1.25, SME=1.0+sme.
Q1 business_multiplier=0.9, sme_multiplier=0.25.
Payout = variable_pay × rating_multiplier × business_multiplier.

```
Bob  (80000): EE  → 80000 × 1.10 × 0.9 = 79200
Dave (75000): ME  → 75000 × 1.00 × 0.9 = 67500
Eve  (72000): FEE → 72000 × 1.25 × 0.9 = 81000
Grace(68000): ME  → 68000 × 1.00 × 0.9 = 61200
Henry(65000): BE  → 65000 × 0    × 0.9 = 0
Irene(60000): EE  → 60000 × 1.10 × 0.9 = 59400
```

The `snapshotted_variable_pay` column is set automatically by the `appraisal_snapshot_var_pay` trigger on INSERT — do NOT include it in the INSERT statement.

```sql
-- ──────────────────────────────────────────────────────────
-- SECTION 6: APPRAISALS
-- snapshotted_variable_pay is auto-set by trigger on INSERT.
-- ──────────────────────────────────────────────────────────

-- ── Q1 2025 (published) — fully locked ──────────────────
INSERT INTO appraisals (
  cycle_id, employee_id, manager_id,
  manager_rating, manager_submitted_at,
  final_rating, final_rating_set_by,
  payout_multiplier, payout_amount,
  locked_at, is_final
) VALUES
  ('00000002-0000-0000-0000-000000000001','00000001-0000-0000-0000-000000000005','00000001-0000-0000-0000-000000000003',
   'EE','2025-02-25 10:00:00+00','EE','00000001-0000-0000-0000-000000000003',
   1.10,79200,'2025-03-12 12:00:00+00',false),
  ('00000002-0000-0000-0000-000000000001','00000001-0000-0000-0000-000000000006','00000001-0000-0000-0000-000000000003',
   'ME','2025-02-25 11:00:00+00','ME','00000001-0000-0000-0000-000000000003',
   1.00,67500,'2025-03-12 12:00:00+00',false),
  ('00000002-0000-0000-0000-000000000001','00000001-0000-0000-0000-000000000007','00000001-0000-0000-0000-000000000003',
   'FEE','2025-02-24 14:00:00+00','FEE','00000001-0000-0000-0000-000000000003',
   1.25,81000,'2025-03-12 12:00:00+00',false),
  ('00000002-0000-0000-0000-000000000001','00000001-0000-0000-0000-000000000008','00000001-0000-0000-0000-000000000004',
   'ME','2025-02-26 09:00:00+00','ME','00000001-0000-0000-0000-000000000004',
   1.00,61200,'2025-03-12 12:00:00+00',false),
  ('00000002-0000-0000-0000-000000000001','00000001-0000-0000-0000-000000000009','00000001-0000-0000-0000-000000000004',
   'BE','2025-02-26 10:00:00+00','BE','00000001-0000-0000-0000-000000000004',
   0.00,0,'2025-03-12 12:00:00+00',false),
  ('00000002-0000-0000-0000-000000000001','00000001-0000-0000-0000-000000000010','00000001-0000-0000-0000-000000000004',
   'EE','2025-02-25 15:00:00+00','EE','00000001-0000-0000-0000-000000000004',
   1.10,59400,'2025-03-12 12:00:00+00',false);

-- ── Q2 2025 (calibrating) — mgr ratings done, 2 HRBP overrides ──
-- Grace: manager=ME, HRBP overrides to EE (is_final=true)
-- Henry: manager=BE, HRBP overrides to ME (is_final=true)
-- Others: manager_rating set, no final_rating yet
INSERT INTO appraisals (
  cycle_id, employee_id, manager_id,
  manager_rating, manager_submitted_at,
  final_rating, final_rating_set_by, is_final
) VALUES
  ('00000002-0000-0000-0000-000000000002','00000001-0000-0000-0000-000000000005','00000001-0000-0000-0000-000000000003',
   'EE','2025-05-25 10:00:00+00', NULL, NULL, false),
  ('00000002-0000-0000-0000-000000000002','00000001-0000-0000-0000-000000000006','00000001-0000-0000-0000-000000000003',
   'ME','2025-05-25 11:00:00+00', NULL, NULL, false),
  ('00000002-0000-0000-0000-000000000002','00000001-0000-0000-0000-000000000007','00000001-0000-0000-0000-000000000003',
   'EE','2025-05-24 14:00:00+00', NULL, NULL, false),
  ('00000002-0000-0000-0000-000000000002','00000001-0000-0000-0000-000000000008','00000001-0000-0000-0000-000000000004',
   'ME','2025-05-26 09:00:00+00', 'EE','00000001-0000-0000-0000-000000000002', true),
  ('00000002-0000-0000-0000-000000000002','00000001-0000-0000-0000-000000000009','00000001-0000-0000-0000-000000000004',
   'BE','2025-05-26 10:00:00+00', 'ME','00000001-0000-0000-0000-000000000002', true),
  ('00000002-0000-0000-0000-000000000002','00000001-0000-0000-0000-000000000010','00000001-0000-0000-0000-000000000004',
   'EE','2025-05-25 15:00:00+00', NULL, NULL, false);

-- ── Q3 2025 (manager_review) — Alice's team rated, Frank's team pending ──
INSERT INTO appraisals (
  cycle_id, employee_id, manager_id,
  manager_rating, manager_submitted_at, is_final
) VALUES
  ('00000002-0000-0000-0000-000000000003','00000001-0000-0000-0000-000000000005','00000001-0000-0000-0000-000000000003',
   'EE','2025-08-25 10:00:00+00', false),
  ('00000002-0000-0000-0000-000000000003','00000001-0000-0000-0000-000000000006','00000001-0000-0000-0000-000000000003',
   'ME','2025-08-25 11:00:00+00', false),
  ('00000002-0000-0000-0000-000000000003','00000001-0000-0000-0000-000000000007','00000001-0000-0000-0000-000000000003',
   'FEE','2025-08-24 14:00:00+00', false);
-- Note: Grace, Henry, Irene have no appraisal row yet — Frank hasn't submitted ratings.
```

**Step 2: Run db reset and verify**

```bash
npx supabase db reset
```

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54161/postgres" -c "
SELECT
  c.name,
  c.status,
  COUNT(a.id) AS appraisals,
  SUM(a.payout_amount) AS total_payout
FROM cycles c
LEFT JOIN appraisals a ON a.cycle_id = c.id
GROUP BY c.id, c.name, c.status
ORDER BY c.year, c.quarter;
"
```

Expected:
```
           name              |    status     | appraisals | total_payout
-----------------------------+---------------+------------+--------------
 Annual Review FY2025-Q1     | published     |          6 |       348300
 Mid-Year Review FY2025-Q2   | calibrating   |          6 |         null
 Q3 Review FY2025            | manager_review|          3 |         null
 Q4 Review FY2025            | self_review   |          0 |         null
 Q1 Review FY2026            | kpi_setting   |          0 |         null
```

(Total payout for Q1: 79200+67500+81000+61200+0+59400 = 348300 ✓)

**Step 3: Spot-check appraisals for Q2 HRBP overrides**

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54161/postgres" -c "
SELECT u.full_name, a.manager_rating, a.final_rating, a.is_final
FROM appraisals a
JOIN users u ON u.id = a.employee_id
WHERE a.cycle_id = '00000002-0000-0000-0000-000000000002'
ORDER BY u.full_name;
"
```

Expected: Grace shows ME/EE is_final=true, Henry shows BE/ME is_final=true.

**Step 4: Commit**

```bash
git add supabase/migrations/00017_seed_test_data.sql
git commit -m "feat: seed migration — appraisals (complete)"
```

**Step 5: Final end-to-end check — login as each role**

Start the dev server if not running:
```bash
npx supabase db reset  # clean slate
# then start Next.js: npm run dev
```

Spot checks:
- `employee@test.com` / `employee123` → `/employee` — should see Q4 self_review form (Bob's review submitted, KPIs visible)
- `manager@test.com` / `manager123` → `/manager` — team table shows Bob, Dave, Eve; Q3 has 3 pending ratings
- `hrbp@test.com` / `hrbp123` → `/hrbp/calibration` — Q2 calibrating cycle with 6 appraisals, 2 already overridden
- `admin@test.com` / `admin123` → `/admin/cycles` — 5 cycles across all stages visible
