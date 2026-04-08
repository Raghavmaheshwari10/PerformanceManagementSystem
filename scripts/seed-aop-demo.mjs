/**
 * seed-aop-demo.mjs
 * Idempotent seed script for AOP cascade QA testing.
 * Run from worktree directory: node scripts/seed-aop-demo.mjs
 */

import { readFileSync } from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// Load .env.local manually
const envPath = 'C:/Users/Raghav Maheshwari/Performance-System-hRMS/.claude/worktrees/charming-bouman/.env.local';
const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter(l => l.includes('='))
    .map(l => {
      const [k, ...v] = l.split('=');
      return [k.trim(), v.join('=').trim().replace(/^"|"$/g, '')];
    })
);

const { PrismaNeon } = await import('@prisma/adapter-neon');
const { neonConfig } = await import('@neondatabase/serverless');
neonConfig.webSocketConstructor = require('ws');

const { PrismaClient } = await import('@prisma/client');

const adapter = new PrismaNeon({ connectionString: env.DIRECT_URL });
const prisma = new PrismaClient({ adapter });

const RAGHAV_ID = '5d630194-5be7-4c81-960b-1ab4fdab5910';

// ─────────────────────────────────────────
// IDs
// ─────────────────────────────────────────
const DEPT_ENG = '00000000-0000-0000-0000-000000000011';
const DEPT_SAL = '00000000-0000-0000-0000-000000000012';
const DEPT_MKT = '00000000-0000-0000-0000-000000000013';

const USER_ALICE   = '00000000-0000-0000-0000-000000000021';
const USER_FRANK   = '00000000-0000-0000-0000-000000000022';
const USER_DAVE    = '00000000-0000-0000-0000-000000000023';
const USER_HANNAH  = '00000000-0000-0000-0000-000000000024';
const USER_MIKE    = '00000000-0000-0000-0000-000000000025';
const USER_EMMA    = '00000000-0000-0000-0000-000000000026';
const USER_ED      = '00000000-0000-0000-0000-000000000027';

const CYCLE_ID     = '00000000-0000-0000-0000-000000000031';

const results = {
  depts: false,
  users: false,
  cycle: false,
  orgAop: false,
  deptAop: false,
  empAop: false,
  misActuals: false,
  templates: false,
};

async function main() {
  console.log('=== AOP Demo Seed Script ===\n');

  // ── 1. Departments ──
  console.log('Seeding departments...');
  try {
    await prisma.department.upsert({
      where: { id: DEPT_ENG },
      create: { id: DEPT_ENG, name: 'Engineering' },
      update: { name: 'Engineering' },
    });
    await prisma.department.upsert({
      where: { id: DEPT_SAL },
      create: { id: DEPT_SAL, name: 'Sales' },
      update: { name: 'Sales' },
    });
    await prisma.department.upsert({
      where: { id: DEPT_MKT },
      create: { id: DEPT_MKT, name: 'Marketing' },
      update: { name: 'Marketing' },
    });
    console.log('  ✅ 3 departments upserted');
    results.depts = true;
  } catch (e) {
    console.error('  ❌ Departments failed:', e.message);
  }

  // ── 2. Users ──
  console.log('Seeding users...');
  try {
    const users = [
      {
        id: USER_ALICE,
        zimyo_id: 'zimyo-alice',
        emp_code: 'EMP301',
        email: 'alice@demo.com',
        full_name: 'Alice Admin',
        role: 'admin',
        department_id: DEPT_ENG,
        manager_id: null,
        is_active: true,
        is_also_employee: true,
        is_founder: false,
        variable_pay: 100000,
      },
      {
        id: USER_FRANK,
        zimyo_id: 'zimyo-frank',
        emp_code: 'EMP302',
        email: 'frank@demo.com',
        full_name: 'Frank Founder',
        role: 'founder',
        department_id: DEPT_ENG,
        manager_id: null,
        is_active: true,
        is_also_employee: true,
        is_founder: false,
        variable_pay: 100000,
      },
      {
        id: USER_DAVE,
        zimyo_id: 'zimyo-dave',
        emp_code: 'EMP303',
        email: 'dave@demo.com',
        full_name: 'Dave DeptHead',
        role: 'department_head',
        department_id: DEPT_SAL,
        manager_id: USER_ALICE,
        is_active: true,
        is_also_employee: true,
        is_founder: false,
        variable_pay: 100000,
      },
      {
        id: USER_HANNAH,
        zimyo_id: 'zimyo-hannah',
        emp_code: 'EMP304',
        email: 'hannah@demo.com',
        full_name: 'Hannah HRBP',
        role: 'hrbp',
        department_id: DEPT_ENG,
        manager_id: USER_ALICE,
        is_active: true,
        is_also_employee: true,
        is_founder: false,
        variable_pay: 100000,
      },
      {
        id: USER_MIKE,
        zimyo_id: 'zimyo-mike',
        emp_code: 'EMP305',
        email: 'mike@demo.com',
        full_name: 'Mike Manager',
        role: 'manager',
        department_id: DEPT_SAL,
        manager_id: USER_DAVE,
        is_active: true,
        is_also_employee: true,
        is_founder: false,
        variable_pay: 100000,
      },
      {
        id: USER_EMMA,
        zimyo_id: 'zimyo-emma',
        emp_code: 'EMP306',
        email: 'emma@demo.com',
        full_name: 'Emma Employee',
        role: 'employee',
        department_id: DEPT_SAL,
        manager_id: USER_MIKE,
        is_active: true,
        is_also_employee: false,
        is_founder: false,
        variable_pay: 100000,
        fixed_ctc: 1200000,
        annual_variable: 200000,
        salary_currency: 'INR',
      },
      {
        id: USER_ED,
        zimyo_id: 'zimyo-ed',
        emp_code: 'EMP307',
        email: 'ed@demo.com',
        full_name: 'Ed Employee2',
        role: 'employee',
        department_id: DEPT_SAL,
        manager_id: USER_MIKE,
        is_active: true,
        is_also_employee: false,
        is_founder: false,
        variable_pay: 100000,
        fixed_ctc: 1200000,
        annual_variable: 200000,
        salary_currency: 'INR',
      },
    ];

    for (const u of users) {
      const { fixed_ctc, annual_variable, salary_currency, ...base } = u;
      const extraFields = {};
      if (fixed_ctc !== undefined) extraFields.fixed_ctc = fixed_ctc;
      if (annual_variable !== undefined) extraFields.annual_variable = annual_variable;
      if (salary_currency !== undefined) extraFields.salary_currency = salary_currency;

      await prisma.user.upsert({
        where: { id: u.id },
        create: { ...base, ...extraFields, synced_at: new Date() },
        update: { ...base, ...extraFields },
      });
    }
    console.log('  ✅ 7 demo users upserted');
    results.users = true;
  } catch (e) {
    console.error('  ❌ Users failed:', e.message);
  }

  // ── 3. Cycle ──
  console.log('Seeding cycle...');
  try {
    await prisma.cycle.upsert({
      where: { id: CYCLE_ID },
      create: {
        id: CYCLE_ID,
        name: 'AOP FY25-26',
        cycle_type: 'annual',
        fiscal_year: 'FY25',
        status: 'draft',
        year: 2025,
        quarter: 'Q1',
        period: null,
        created_by: RAGHAV_ID,
      },
      update: {
        name: 'AOP FY25-26',
        fiscal_year: 'FY25',
        status: 'draft',
      },
    });
    console.log('  ✅ Cycle AOP FY25-26 upserted');
    results.cycle = true;
  } catch (e) {
    console.error('  ❌ Cycle failed:', e.message);
  }

  // ── 4. Org AOP ──
  console.log('Seeding Org AOP targets...');

  // Delivered Revenue: annual=120000000
  const revMonthly = {
    apr: 8000000, may: 8000000, jun: 9000000,
    jul: 9000000, aug: 10000000, sep: 11000000,
    oct: 11000000, nov: 11000000, dec: 12000000,
    jan: 12000000, feb: 10000000, mar: 9000000,
  };
  // sum = 120M ✓

  // Gross Margin: annual=36000000 (30% of revenue months)
  const marginMonthly = {
    apr: 2400000, may: 2400000, jun: 2700000,
    jul: 2700000, aug: 3000000, sep: 3300000,
    oct: 3300000, nov: 3300000, dec: 3600000,
    jan: 3600000, feb: 3000000, mar: 2700000,
  };
  // sum = 36M ✓

  // GMV: annual=200000000
  const gmvMonthly = {
    apr: 13000000, may: 13000000, jun: 15000000,
    jul: 15000000, aug: 17000000, sep: 18000000,
    oct: 18000000, nov: 18000000, dec: 20000000,
    jan: 20000000, feb: 17000000, mar: 16000000,
  };
  // sum = 200M ✓

  try {
    // Revenue
    const orgRevId = await prisma.orgAop.upsert({
      where: { fiscal_year_metric: { fiscal_year: 'FY25', metric: 'delivered_revenue' } },
      create: {
        fiscal_year: 'FY25',
        metric: 'delivered_revenue',
        annual_target: 120000000,
        ...revMonthly,
        created_by: RAGHAV_ID,
      },
      update: { annual_target: 120000000, ...revMonthly, updated_at: new Date() },
    });

    // Gross Margin
    const orgMarginId = await prisma.orgAop.upsert({
      where: { fiscal_year_metric: { fiscal_year: 'FY25', metric: 'gross_margin' } },
      create: {
        fiscal_year: 'FY25',
        metric: 'gross_margin',
        annual_target: 36000000,
        ...marginMonthly,
        created_by: RAGHAV_ID,
      },
      update: { annual_target: 36000000, ...marginMonthly, updated_at: new Date() },
    });

    // GMV
    const orgGmvId = await prisma.orgAop.upsert({
      where: { fiscal_year_metric: { fiscal_year: 'FY25', metric: 'gmv' } },
      create: {
        fiscal_year: 'FY25',
        metric: 'gmv',
        annual_target: 200000000,
        ...gmvMonthly,
        created_by: RAGHAV_ID,
      },
      update: { annual_target: 200000000, ...gmvMonthly, updated_at: new Date() },
    });

    console.log('  ✅ 3 OrgAop metrics upserted (delivered_revenue, gross_margin, gmv)');
    results.orgAop = true;

    // ── 5. Department AOP (Sales) ──
    console.log('Seeding Department AOP (Sales)...');

    // Sales = 50% of org
    const deptRevMonthly = {
      apr: 4000000, may: 4000000, jun: 4500000,
      jul: 4500000, aug: 5000000, sep: 5500000,
      oct: 5500000, nov: 5500000, dec: 6000000,
      jan: 6000000, feb: 5000000, mar: 4500000,
    };
    // sum = 60M ✓

    const deptMarginMonthly = {
      apr: 1200000, may: 1200000, jun: 1350000,
      jul: 1350000, aug: 1500000, sep: 1650000,
      oct: 1650000, nov: 1650000, dec: 1800000,
      jan: 1800000, feb: 1500000, mar: 1350000,
    };
    // sum = 18M ✓

    const deptGmvMonthly = {
      apr: 6500000, may: 6500000, jun: 7500000,
      jul: 7500000, aug: 8500000, sep: 9000000,
      oct: 9000000, nov: 9000000, dec: 10000000,
      jan: 10000000, feb: 8500000, mar: 8000000,
    };
    // sum = 100M ✓

    await prisma.departmentAop.upsert({
      where: { org_aop_id_department_id: { org_aop_id: orgRevId.id, department_id: DEPT_SAL } },
      create: {
        org_aop_id: orgRevId.id,
        department_id: DEPT_SAL,
        annual_target: 60000000,
        ...deptRevMonthly,
        status: 'cascaded',
      },
      update: { annual_target: 60000000, ...deptRevMonthly, status: 'cascaded', updated_at: new Date() },
    });

    await prisma.departmentAop.upsert({
      where: { org_aop_id_department_id: { org_aop_id: orgMarginId.id, department_id: DEPT_SAL } },
      create: {
        org_aop_id: orgMarginId.id,
        department_id: DEPT_SAL,
        annual_target: 18000000,
        ...deptMarginMonthly,
        status: 'cascaded',
      },
      update: { annual_target: 18000000, ...deptMarginMonthly, status: 'cascaded', updated_at: new Date() },
    });

    await prisma.departmentAop.upsert({
      where: { org_aop_id_department_id: { org_aop_id: orgGmvId.id, department_id: DEPT_SAL } },
      create: {
        org_aop_id: orgGmvId.id,
        department_id: DEPT_SAL,
        annual_target: 100000000,
        ...deptGmvMonthly,
        status: 'cascaded',
      },
      update: { annual_target: 100000000, ...deptGmvMonthly, status: 'cascaded', updated_at: new Date() },
    });

    console.log('  ✅ Sales DepartmentAop upserted (3 metrics)');
    results.deptAop = true;

    // ── 6. Employee AOP (Emma + Ed) ──
    console.log('Seeding Employee AOP (Emma + Ed)...');

    // Fetch the 3 dept AOP IDs
    const deptRevAop    = await prisma.departmentAop.findUniqueOrThrow({ where: { org_aop_id_department_id: { org_aop_id: orgRevId.id, department_id: DEPT_SAL } } });
    const deptMarginAop = await prisma.departmentAop.findUniqueOrThrow({ where: { org_aop_id_department_id: { org_aop_id: orgMarginId.id, department_id: DEPT_SAL } } });
    const deptGmvAop    = await prisma.departmentAop.findUniqueOrThrow({ where: { org_aop_id_department_id: { org_aop_id: orgGmvId.id, department_id: DEPT_SAL } } });

    // Emma proportional splits:
    // Revenue: 35M from 60M dept = 58.33%
    const emmaRevPct = 35000000 / 60000000;
    const emmaRevMonthly = {
      apr: Math.round(deptRevMonthly.apr * emmaRevPct),
      may: Math.round(deptRevMonthly.may * emmaRevPct),
      jun: Math.round(deptRevMonthly.jun * emmaRevPct),
      jul: Math.round(deptRevMonthly.jul * emmaRevPct),
      aug: Math.round(deptRevMonthly.aug * emmaRevPct),
      sep: Math.round(deptRevMonthly.sep * emmaRevPct),
      oct: Math.round(deptRevMonthly.oct * emmaRevPct),
      nov: Math.round(deptRevMonthly.nov * emmaRevPct),
      dec: Math.round(deptRevMonthly.dec * emmaRevPct),
      jan: Math.round(deptRevMonthly.jan * emmaRevPct),
      feb: Math.round(deptRevMonthly.feb * emmaRevPct),
      mar: Math.round(deptRevMonthly.mar * emmaRevPct),
    };
    // Fix rounding: adjust annual to exact
    const emmaRevSum = Object.values(emmaRevMonthly).reduce((s, v) => s + v, 0);
    const emmaRevAnnual = emmaRevSum; // use actual sum for idempotency

    const emmaMarginPct = 10500000 / 18000000;
    const emmaMarginMonthly = {
      apr: Math.round(deptMarginMonthly.apr * emmaMarginPct),
      may: Math.round(deptMarginMonthly.may * emmaMarginPct),
      jun: Math.round(deptMarginMonthly.jun * emmaMarginPct),
      jul: Math.round(deptMarginMonthly.jul * emmaMarginPct),
      aug: Math.round(deptMarginMonthly.aug * emmaMarginPct),
      sep: Math.round(deptMarginMonthly.sep * emmaMarginPct),
      oct: Math.round(deptMarginMonthly.oct * emmaMarginPct),
      nov: Math.round(deptMarginMonthly.nov * emmaMarginPct),
      dec: Math.round(deptMarginMonthly.dec * emmaMarginPct),
      jan: Math.round(deptMarginMonthly.jan * emmaMarginPct),
      feb: Math.round(deptMarginMonthly.feb * emmaMarginPct),
      mar: Math.round(deptMarginMonthly.mar * emmaMarginPct),
    };
    const emmaMarginSum = Object.values(emmaMarginMonthly).reduce((s, v) => s + v, 0);

    const emmaGmvPct = 60000000 / 100000000;
    const emmaGmvMonthly = {
      apr: Math.round(deptGmvMonthly.apr * emmaGmvPct),
      may: Math.round(deptGmvMonthly.may * emmaGmvPct),
      jun: Math.round(deptGmvMonthly.jun * emmaGmvPct),
      jul: Math.round(deptGmvMonthly.jul * emmaGmvPct),
      aug: Math.round(deptGmvMonthly.aug * emmaGmvPct),
      sep: Math.round(deptGmvMonthly.sep * emmaGmvPct),
      oct: Math.round(deptGmvMonthly.oct * emmaGmvPct),
      nov: Math.round(deptGmvMonthly.nov * emmaGmvPct),
      dec: Math.round(deptGmvMonthly.dec * emmaGmvPct),
      jan: Math.round(deptGmvMonthly.jan * emmaGmvPct),
      feb: Math.round(deptGmvMonthly.feb * emmaGmvPct),
      mar: Math.round(deptGmvMonthly.mar * emmaGmvPct),
    };
    const emmaGmvSum = Object.values(emmaGmvMonthly).reduce((s, v) => s + v, 0);

    // Ed = remaining from dept minus Emma
    function subtractMonthly(dept, emma) {
      const result = {};
      for (const k of Object.keys(dept)) {
        result[k] = dept[k] - emma[k];
      }
      return result;
    }
    const edRevMonthly    = subtractMonthly(deptRevMonthly, emmaRevMonthly);
    const edMarginMonthly = subtractMonthly(deptMarginMonthly, emmaMarginMonthly);
    const edGmvMonthly    = subtractMonthly(deptGmvMonthly, emmaGmvMonthly);

    const edRevSum    = Object.values(edRevMonthly).reduce((s, v) => s + v, 0);
    const edMarginSum = Object.values(edMarginMonthly).reduce((s, v) => s + v, 0);
    const edGmvSum    = Object.values(edGmvMonthly).reduce((s, v) => s + v, 0);

    // Upsert Emma
    await prisma.employeeAop.upsert({
      where: { department_aop_id_employee_id: { department_aop_id: deptRevAop.id, employee_id: USER_EMMA } },
      create: { department_aop_id: deptRevAop.id, employee_id: USER_EMMA, annual_target: emmaRevAnnual, ...emmaRevMonthly },
      update: { annual_target: emmaRevAnnual, ...emmaRevMonthly, updated_at: new Date() },
    });
    await prisma.employeeAop.upsert({
      where: { department_aop_id_employee_id: { department_aop_id: deptMarginAop.id, employee_id: USER_EMMA } },
      create: { department_aop_id: deptMarginAop.id, employee_id: USER_EMMA, annual_target: emmaMarginSum, ...emmaMarginMonthly },
      update: { annual_target: emmaMarginSum, ...emmaMarginMonthly, updated_at: new Date() },
    });
    await prisma.employeeAop.upsert({
      where: { department_aop_id_employee_id: { department_aop_id: deptGmvAop.id, employee_id: USER_EMMA } },
      create: { department_aop_id: deptGmvAop.id, employee_id: USER_EMMA, annual_target: emmaGmvSum, ...emmaGmvMonthly },
      update: { annual_target: emmaGmvSum, ...emmaGmvMonthly, updated_at: new Date() },
    });

    // Upsert Ed
    await prisma.employeeAop.upsert({
      where: { department_aop_id_employee_id: { department_aop_id: deptRevAop.id, employee_id: USER_ED } },
      create: { department_aop_id: deptRevAop.id, employee_id: USER_ED, annual_target: edRevSum, ...edRevMonthly },
      update: { annual_target: edRevSum, ...edRevMonthly, updated_at: new Date() },
    });
    await prisma.employeeAop.upsert({
      where: { department_aop_id_employee_id: { department_aop_id: deptMarginAop.id, employee_id: USER_ED } },
      create: { department_aop_id: deptMarginAop.id, employee_id: USER_ED, annual_target: edMarginSum, ...edMarginMonthly },
      update: { annual_target: edMarginSum, ...edMarginMonthly, updated_at: new Date() },
    });
    await prisma.employeeAop.upsert({
      where: { department_aop_id_employee_id: { department_aop_id: deptGmvAop.id, employee_id: USER_ED } },
      create: { department_aop_id: deptGmvAop.id, employee_id: USER_ED, annual_target: edGmvSum, ...edGmvMonthly },
      update: { annual_target: edGmvSum, ...edGmvMonthly, updated_at: new Date() },
    });

    console.log(`  ✅ Emma EmployeeAop: rev=${emmaRevAnnual}, margin=${emmaMarginSum}, gmv=${emmaGmvSum}`);
    console.log(`  ✅ Ed EmployeeAop:   rev=${edRevSum}, margin=${edMarginSum}, gmv=${edGmvSum}`);
    results.empAop = true;

    // ── 7. MIS Actuals (Emma + Ed, Apr/May/Jun) ──
    console.log('Seeding MIS actuals...');

    const emmaRevEmpAop    = await prisma.employeeAop.findUniqueOrThrow({ where: { department_aop_id_employee_id: { department_aop_id: deptRevAop.id, employee_id: USER_EMMA } } });
    const emmaMarginEmpAop = await prisma.employeeAop.findUniqueOrThrow({ where: { department_aop_id_employee_id: { department_aop_id: deptMarginAop.id, employee_id: USER_EMMA } } });
    const emmaGmvEmpAop    = await prisma.employeeAop.findUniqueOrThrow({ where: { department_aop_id_employee_id: { department_aop_id: deptGmvAop.id, employee_id: USER_EMMA } } });

    const edRevEmpAop    = await prisma.employeeAop.findUniqueOrThrow({ where: { department_aop_id_employee_id: { department_aop_id: deptRevAop.id, employee_id: USER_ED } } });
    const edMarginEmpAop = await prisma.employeeAop.findUniqueOrThrow({ where: { department_aop_id_employee_id: { department_aop_id: deptMarginAop.id, employee_id: USER_ED } } });
    const edGmvEmpAop    = await prisma.employeeAop.findUniqueOrThrow({ where: { department_aop_id_employee_id: { department_aop_id: deptGmvAop.id, employee_id: USER_ED } } });

    const emmaActuals = [
      { employee_aop_id: emmaRevEmpAop.id,    month: 'apr', actual_value: 2800000, uploaded_by: RAGHAV_ID },
      { employee_aop_id: emmaRevEmpAop.id,    month: 'may', actual_value: 3100000, uploaded_by: RAGHAV_ID },
      { employee_aop_id: emmaRevEmpAop.id,    month: 'jun', actual_value: 2600000, uploaded_by: RAGHAV_ID },
      { employee_aop_id: emmaMarginEmpAop.id, month: 'apr', actual_value: 850000,  uploaded_by: RAGHAV_ID },
      { employee_aop_id: emmaMarginEmpAop.id, month: 'may', actual_value: 940000,  uploaded_by: RAGHAV_ID },
      { employee_aop_id: emmaMarginEmpAop.id, month: 'jun', actual_value: 780000,  uploaded_by: RAGHAV_ID },
      { employee_aop_id: emmaGmvEmpAop.id,    month: 'apr', actual_value: 4900000, uploaded_by: RAGHAV_ID },
      { employee_aop_id: emmaGmvEmpAop.id,    month: 'may', actual_value: 5400000, uploaded_by: RAGHAV_ID },
      { employee_aop_id: emmaGmvEmpAop.id,    month: 'jun', actual_value: 4600000, uploaded_by: RAGHAV_ID },
    ];

    // Ed = 71% of Emma
    const edActuals = [
      { employee_aop_id: edRevEmpAop.id,    month: 'apr', actual_value: Math.round(2800000 * 0.71), uploaded_by: RAGHAV_ID },
      { employee_aop_id: edRevEmpAop.id,    month: 'may', actual_value: Math.round(3100000 * 0.71), uploaded_by: RAGHAV_ID },
      { employee_aop_id: edRevEmpAop.id,    month: 'jun', actual_value: Math.round(2600000 * 0.71), uploaded_by: RAGHAV_ID },
      { employee_aop_id: edMarginEmpAop.id, month: 'apr', actual_value: Math.round(850000  * 0.71), uploaded_by: RAGHAV_ID },
      { employee_aop_id: edMarginEmpAop.id, month: 'may', actual_value: Math.round(940000  * 0.71), uploaded_by: RAGHAV_ID },
      { employee_aop_id: edMarginEmpAop.id, month: 'jun', actual_value: Math.round(780000  * 0.71), uploaded_by: RAGHAV_ID },
      { employee_aop_id: edGmvEmpAop.id,    month: 'apr', actual_value: Math.round(4900000 * 0.71), uploaded_by: RAGHAV_ID },
      { employee_aop_id: edGmvEmpAop.id,    month: 'may', actual_value: Math.round(5400000 * 0.71), uploaded_by: RAGHAV_ID },
      { employee_aop_id: edGmvEmpAop.id,    month: 'jun', actual_value: Math.round(4600000 * 0.71), uploaded_by: RAGHAV_ID },
    ];

    for (const a of [...emmaActuals, ...edActuals]) {
      await prisma.employeeMisActual.upsert({
        where: { employee_aop_id_month: { employee_aop_id: a.employee_aop_id, month: a.month } },
        create: a,
        update: { actual_value: a.actual_value },
      });
    }
    console.log('  ✅ MIS actuals seeded (Emma + Ed, Apr/May/Jun, all 3 metrics)');
    results.misActuals = true;

  } catch (e) {
    console.error('  ❌ AOP seeding failed:', e.message);
    console.error(e.stack);
  }

  // ── 8. Protected Templates ──
  console.log('Seeding protected AOP templates...');
  try {
    const kraTemplate = await prisma.kraTemplate.upsert({
      where: { id: '00000000-0000-0000-0000-000000000041' },
      create: {
        id: '00000000-0000-0000-0000-000000000041',
        title: 'AOP Targets',
        category: 'performance',
        is_active: true,
        is_protected: true,
        created_by: RAGHAV_ID,
      },
      update: {
        title: 'AOP Targets',
        is_protected: true,
        updated_at: undefined,
      },
    });

    const kpiTemplates = [
      { id: '00000000-0000-0000-0000-000000000051', title: 'Delivered Revenue', unit: 'number' },
      { id: '00000000-0000-0000-0000-000000000052', title: 'Gross Margin',       unit: 'number' },
      { id: '00000000-0000-0000-0000-000000000053', title: 'New Sales (GMV)',    unit: 'number' },
    ];

    for (const t of kpiTemplates) {
      await prisma.kpiTemplate.upsert({
        where: { id: t.id },
        create: {
          id: t.id,
          title: t.title,
          unit: t.unit,
          category: 'performance',
          kra_template_id: kraTemplate.id,
          is_active: true,
          is_protected: true,
          created_by: RAGHAV_ID,
        },
        update: {
          title: t.title,
          is_protected: true,
          kra_template_id: kraTemplate.id,
        },
      });
    }
    console.log('  ✅ 1 KRA template + 3 KPI templates upserted (all is_protected=true)');
    results.templates = true;
  } catch (e) {
    console.error('  ❌ Templates failed:', e.message);
  }

  console.log('\n=== Seed complete ===');
  console.log('Results:', results);

  await prisma.$disconnect();
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
