-- KPI Templates: reusable role-based KPI blueprints.

-- 1. Table
CREATE TABLE kpi_templates (
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