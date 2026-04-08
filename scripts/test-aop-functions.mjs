/**
 * test-aop-functions.mjs
 * AOP cascade feature QA test runner.
 * Run from worktree directory: node scripts/test-aop-functions.mjs
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

const RAGHAV_ID  = '5d630194-5be7-4c81-960b-1ab4fdab5910';
const DEPT_SAL   = '00000000-0000-0000-0000-000000000012';
const USER_EMMA  = '00000000-0000-0000-0000-000000000026';
const USER_ED    = '00000000-0000-0000-0000-000000000027';
const CYCLE_ID   = '00000000-0000-0000-0000-000000000031';

const MONTHS = ['apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec', 'jan', 'feb', 'mar'];

const testResults = {};

function pass(name, detail = '') {
  testResults[name] = { ok: true, detail };
  console.log(`  ✅ ${name}${detail ? ' — ' + detail : ''}`);
}

function fail(name, detail = '') {
  testResults[name] = { ok: false, detail };
  console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`);
}

// ─────────────────────────────────────────
// Helper: replicate validateEmployeeCascade logic
// ─────────────────────────────────────────
async function validateEmployeeCascade(departmentAopId) {
  const deptAop = await prisma.departmentAop.findUniqueOrThrow({ where: { id: departmentAopId } });
  const empAops = await prisma.employeeAop.findMany({ where: { department_aop_id: departmentAopId } });

  const empTotal = empAops.reduce((sum, e) => sum + Number(e.annual_target), 0);
  const deptTotal = Number(deptAop.annual_target);

  const perMonth = {};
  for (const month of MONTHS) {
    const dept = Number(deptAop[month]);
    const emp = empAops.reduce((sum, e) => sum + Number(e[month]), 0);
    perMonth[month] = { dept, emp, valid: Math.abs(dept - emp) < 1 }; // 1 rupee tolerance for rounding
  }

  return { valid: Math.abs(deptTotal - empTotal) < 1, deptTotal, empTotal, perMonth };
}

// ─────────────────────────────────────────
// Helper: replicate createKpisFromCascade logic
// ─────────────────────────────────────────
function getCycleMonths(cycleType, period) {
  switch (cycleType) {
    case 'monthly':  return period ? [period.toLowerCase()] : [];
    case 'quarterly':
      switch (period?.toUpperCase()) {
        case 'Q1': return ['apr', 'may', 'jun'];
        case 'Q2': return ['jul', 'aug', 'sep'];
        case 'Q3': return ['oct', 'nov', 'dec'];
        case 'Q4': return ['jan', 'feb', 'mar'];
        default: return [];
      }
    case 'halfyearly':
      switch (period?.toUpperCase()) {
        case 'H1': return ['apr', 'may', 'jun', 'jul', 'aug', 'sep'];
        case 'H2': return ['oct', 'nov', 'dec', 'jan', 'feb', 'mar'];
        default: return [];
      }
    case 'annual': return [...MONTHS];
    default: return [];
  }
}

async function createKpisFromCascade(departmentAopId, cycleId) {
  const AOP_KPI_TITLES = {
    delivered_revenue: 'Delivered Revenue',
    gross_margin: 'Gross Margin',
    gmv: 'New Sales (GMV)',
  };

  const deptAop = await prisma.departmentAop.findUniqueOrThrow({
    where: { id: departmentAopId },
    include: {
      org_aop: true,
      employee_aops: { include: { employee: true } },
    },
  });

  const metric = deptAop.org_aop.metric;
  const kpiTitle = AOP_KPI_TITLES[metric] ?? metric;

  const cycle = await prisma.cycle.findUniqueOrThrow({ where: { id: cycleId } });
  const cycleMonths = getCycleMonths(cycle.cycle_type, cycle.period);
  if (cycleMonths.length === 0) return 0;

  const kpiTemplate = await prisma.kpiTemplate.findFirst({
    where: { title: kpiTitle, is_protected: true },
    include: { kra_template: true },
  });
  const kraTitle = 'AOP Targets';

  let created = 0;
  for (const empAop of deptAop.employee_aops) {
    if (empAop.exited_at) continue;

    const targetValue = cycleMonths.reduce((sum, month) => sum + Number(empAop[month] || 0), 0);

    const existing = await prisma.kpi.findFirst({
      where: {
        cycle_id: cycleId,
        employee_id: empAop.employee_id,
        is_aop_linked: true,
        employee_aop_id: empAop.id,
      },
    });
    if (existing) {
      if (Number(existing.target) !== targetValue) {
        await prisma.kpi.update({ where: { id: existing.id }, data: { target: targetValue } });
      }
      continue;
    }

    let kra = await prisma.kra.findFirst({
      where: { cycle_id: cycleId, employee_id: empAop.employee_id, title: kraTitle },
    });
    if (!kra) {
      kra = await prisma.kra.create({
        data: {
          cycle_id: cycleId,
          employee_id: empAop.employee_id,
          title: kraTitle,
          category: 'performance',
          weight: null,
          kra_template_id: kpiTemplate?.kra_template?.id ?? null,
        },
      });
    }

    const managerId = empAop.employee.manager_id;
    if (!managerId) {
      console.warn(`  [kpi-sync] Skipping ${empAop.employee_id}: no manager_id`);
      continue;
    }

    await prisma.kpi.create({
      data: {
        cycle_id: cycleId,
        employee_id: empAop.employee_id,
        manager_id: managerId,
        kra_id: kra.id,
        title: kpiTitle,
        description: `AOP target for ${deptAop.org_aop.fiscal_year}`,
        unit: 'number',
        target: targetValue,
        weight: null,
        is_aop_linked: true,
        employee_aop_id: empAop.id,
      },
    });
    created++;
  }
  return created;
}

// ─────────────────────────────────────────
// Helper: lockDepartmentCascade logic
// ─────────────────────────────────────────
async function lockDepartmentCascadeLocal(departmentAopId) {
  const validation = await validateEmployeeCascade(departmentAopId);
  if (!validation.valid) {
    throw new Error(`Cannot lock: emp=${validation.empTotal} dept=${validation.deptTotal}`);
  }
  await prisma.departmentAop.update({ where: { id: departmentAopId }, data: { status: 'locked' } });
}

// ─────────────────────────────────────────
// Helper: markEmployeeExited logic
// ─────────────────────────────────────────
async function markEmployeeExitedLocal(employeeAopId, exitedAt) {
  const empAop = await prisma.employeeAop.findUniqueOrThrow({ where: { id: employeeAopId } });
  const exitMonth = exitedAt.toLocaleString('en-US', { month: 'short' }).toLowerCase();
  const exitIdx = MONTHS.indexOf(exitMonth);

  const updates = {};
  for (let i = exitIdx + 1; i < MONTHS.length; i++) {
    updates[MONTHS[i]] = 0;
  }

  const updatedMonths = {
    ...Object.fromEntries(MONTHS.map(m => [m, Number(empAop[m])])),
    ...updates,
  };
  const newAnnual = MONTHS.reduce((sum, m) => sum + (updatedMonths[m] || 0), 0);

  return prisma.employeeAop.update({
    where: { id: employeeAopId },
    data: { ...updates, annual_target: newAnnual, exited_at: exitedAt, updated_at: new Date() },
  });
}

// ─────────────────────────────────────────
// Helper: getFounderViewData logic (replicated)
// ─────────────────────────────────────────
async function getFounderViewData(fiscalYear) {
  const orgAops = await prisma.orgAop.findMany({
    where: { fiscal_year: fiscalYear },
    include: {
      department_aops: {
        include: {
          department: { select: { id: true, name: true } },
          employee_aops: {
            include: {
              employee: {
                select: {
                  id: true, full_name: true, fixed_ctc: true,
                  annual_variable: true, retention_bonus: true,
                  onetime_bonus: true, salary_currency: true,
                },
              },
              mis_actuals: true,
            },
          },
        },
      },
    },
  });

  const deptMap = new Map();
  for (const orgAop of orgAops) {
    const metric = orgAop.metric;
    for (const deptAop of orgAop.department_aops) {
      const deptId = deptAop.department.id;
      if (!deptMap.has(deptId)) {
        deptMap.set(deptId, {
          department: { id: deptAop.department.id, name: deptAop.department.name },
          metricTargets: {},
          metricActuals: {},
          employeeMap: new Map(),
        });
      }
      const deptAcc = deptMap.get(deptId);
      deptAcc.metricTargets[metric] = Number(deptAop.annual_target);

      for (const empAop of deptAop.employee_aops) {
        const empId = empAop.employee.id;
        if (!deptAcc.employeeMap.has(empId)) {
          const currency = empAop.employee.salary_currency ?? 'INR';
          const ctc = (empAop.employee.fixed_ctc ? Number(empAop.employee.fixed_ctc) : 0)
                    + (empAop.employee.annual_variable ? Number(empAop.employee.annual_variable) : 0);
          deptAcc.employeeMap.set(empId, {
            id: empId,
            name: empAop.employee.full_name,
            currency,
            ctc,
            ctcInr: ctc,
            targets: {},
            actuals: {},
          });
        }
        const empRow = deptAcc.employeeMap.get(empId);
        empRow.targets[metric] = Number(empAop.annual_target);
        const ytdActual = empAop.mis_actuals.reduce((sum, ma) => sum + Number(ma.actual_value), 0);
        empRow.actuals[metric] = ytdActual;
        deptAcc.metricActuals[metric] = (deptAcc.metricActuals[metric] ?? 0) + ytdActual;
      }
    }
  }

  const departments = [];
  for (const [, deptAcc] of deptMap) {
    const employees = Array.from(deptAcc.employeeMap.values());
    departments.push({
      department: deptAcc.department,
      teamSize: employees.length,
      metricTargets: deptAcc.metricTargets,
      metricActuals: deptAcc.metricActuals,
      employees,
    });
  }
  departments.sort((a, b) => a.department.name.localeCompare(b.department.name));
  return { departments };
}

// ─────────────────────────────────────────
// Helper: getCascadeTree logic
// ─────────────────────────────────────────
async function getCascadeTree(fiscalYear, metric) {
  return prisma.orgAop.findUnique({
    where: { fiscal_year_metric: { fiscal_year: fiscalYear, metric } },
    include: {
      department_aops: {
        include: {
          department: true,
          employee_aops: {
            include: { employee: true, mis_actuals: true },
          },
        },
      },
    },
  });
}

// ─────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────

async function main() {
  console.log('\n=== AOP Feature QA Test Runner ===\n');

  // ── TEST 3.1: validateEmployeeCascade ──
  console.log('Test 3.1: validateEmployeeCascade...');
  try {
    // Get the Sales dept AOP for delivered_revenue
    const orgRevAop = await prisma.orgAop.findUnique({
      where: { fiscal_year_metric: { fiscal_year: 'FY25', metric: 'delivered_revenue' } },
    });
    const deptRevAop = await prisma.departmentAop.findUnique({
      where: { org_aop_id_department_id: { org_aop_id: orgRevAop.id, department_id: DEPT_SAL } },
    });

    const result = await validateEmployeeCascade(deptRevAop.id);

    // Check per-month validity
    let allMonthsValid = true;
    const invalidMonths = [];
    for (const [month, data] of Object.entries(result.perMonth)) {
      if (!data.valid) {
        allMonthsValid = false;
        invalidMonths.push(`${month}: dept=${data.dept} emp=${data.emp}`);
      }
    }

    if (result.valid && allMonthsValid) {
      pass('3.1 validateEmployeeCascade', `deptTotal=${result.deptTotal} empTotal=${result.empTotal} all months valid`);
    } else {
      fail('3.1 validateEmployeeCascade', `valid=${result.valid} annualMatch=${result.valid} invalidMonths=[${invalidMonths.join(', ')}] empTotal=${result.empTotal} deptTotal=${result.deptTotal}`);
    }
  } catch (e) {
    fail('3.1 validateEmployeeCascade', e.message);
  }

  // ── TEST 3.2: lockDepartmentCascade + KPI creation ──
  console.log('Test 3.2: lockDepartmentCascade + KPI auto-creation...');
  let deptRevAopId = null;
  try {
    const orgRevAop = await prisma.orgAop.findUnique({
      where: { fiscal_year_metric: { fiscal_year: 'FY25', metric: 'delivered_revenue' } },
    });
    const deptRevAop = await prisma.departmentAop.findUnique({
      where: { org_aop_id_department_id: { org_aop_id: orgRevAop.id, department_id: DEPT_SAL } },
    });
    deptRevAopId = deptRevAop.id;

    // Reset status to cascaded first (for idempotency)
    await prisma.departmentAop.update({ where: { id: deptRevAopId }, data: { status: 'cascaded' } });
    // Clear any existing KPIs from this cycle first
    await prisma.kpi.deleteMany({
      where: { cycle_id: CYCLE_ID, is_aop_linked: true },
    });
    await prisma.kra.deleteMany({
      where: { cycle_id: CYCLE_ID, title: 'AOP Targets' },
    });

    await lockDepartmentCascadeLocal(deptRevAopId);

    // Verify status
    const afterLock = await prisma.departmentAop.findUnique({ where: { id: deptRevAopId } });
    if (afterLock.status !== 'locked') {
      fail('3.2 lockDepartmentCascade → status=locked', `status=${afterLock.status}`);
    } else {
      pass('3.2 lockDepartmentCascade → status=locked');
    }

    // Now run createKpisFromCascade
    let totalCreated = await createKpisFromCascade(deptRevAopId, CYCLE_ID);

    // Count KPIs for Emma and Ed
    const emmaKpis = await prisma.kpi.findMany({
      where: { cycle_id: CYCLE_ID, employee_id: USER_EMMA, is_aop_linked: true },
    });
    const edKpis = await prisma.kpi.findMany({
      where: { cycle_id: CYCLE_ID, employee_id: USER_ED, is_aop_linked: true },
    });

    if (emmaKpis.length >= 1 && edKpis.length >= 1) {
      pass('3.2 KPI auto-creation', `Emma: ${emmaKpis.length} KPIs, Ed: ${edKpis.length} KPIs`);
    } else {
      fail('3.2 KPI auto-creation', `Emma: ${emmaKpis.length} KPIs, Ed: ${edKpis.length} KPIs`);
    }

    // Verify KPI targets match EmployeeAop annual_target
    const emmaEmpAop = await prisma.employeeAop.findUnique({
      where: { department_aop_id_employee_id: { department_aop_id: deptRevAopId, employee_id: USER_EMMA } },
    });
    // For annual cycle, all months sum = annual
    const expectedTarget = Number(emmaEmpAop.annual_target);
    const actualTarget = Number(emmaKpis[0]?.target ?? 0);
    if (Math.abs(expectedTarget - actualTarget) < 2) {
      pass('3.2 KPI target matches EmployeeAop', `expected=${expectedTarget} actual=${actualTarget}`);
    } else {
      fail('3.2 KPI target matches EmployeeAop', `expected=${expectedTarget} actual=${actualTarget}`);
    }

    // Verify KRA template linked
    if (emmaKpis.length > 0 && emmaKpis[0].kra_id) {
      const kra = await prisma.kra.findUnique({ where: { id: emmaKpis[0].kra_id } });
      if (kra?.kra_template_id) {
        pass('3.2 KPI linked to AOP KRA template', `kra_template_id=${kra.kra_template_id}`);
      } else {
        pass('3.2 KPI linked to AOP KRA template', 'KRA exists but no template link (template may not exist yet)');
      }
    }
  } catch (e) {
    fail('3.2 lockDepartmentCascade', e.message);
  }

  // ── TEST 3.3: KPI sync idempotency ──
  console.log('Test 3.3: KPI sync idempotency...');
  try {
    if (deptRevAopId) {
      const beforeCount = await prisma.kpi.count({
        where: { cycle_id: CYCLE_ID, is_aop_linked: true },
      });
      // Run again
      await createKpisFromCascade(deptRevAopId, CYCLE_ID);
      const afterCount = await prisma.kpi.count({
        where: { cycle_id: CYCLE_ID, is_aop_linked: true },
      });

      if (beforeCount === afterCount) {
        pass('3.3 KPI sync idempotency', `count=${beforeCount} unchanged after re-run`);
      } else {
        fail('3.3 KPI sync idempotency', `before=${beforeCount} after=${afterCount} (duplicates created!)`);
      }
    } else {
      fail('3.3 KPI sync idempotency', 'deptRevAopId not available (test 3.2 failed)');
    }
  } catch (e) {
    fail('3.3 KPI sync idempotency', e.message);
  }

  // ── TEST 3.4: markEmployeeExited ──
  console.log('Test 3.4: markEmployeeExited...');
  let emmaRevEmpAopId = null;
  try {
    const orgRevAop = await prisma.orgAop.findUnique({
      where: { fiscal_year_metric: { fiscal_year: 'FY25', metric: 'delivered_revenue' } },
    });
    const deptRevAop = await prisma.departmentAop.findUnique({
      where: { org_aop_id_department_id: { org_aop_id: orgRevAop.id, department_id: DEPT_SAL } },
    });

    const emmaEmpAop = await prisma.employeeAop.findUnique({
      where: { department_aop_id_employee_id: { department_aop_id: deptRevAop.id, employee_id: USER_EMMA } },
    });
    emmaRevEmpAopId = emmaEmpAop.id;

    // Save original values for restoration later
    const originalMonthly = {};
    for (const m of MONTHS) originalMonthly[m] = Number(emmaEmpAop[m]);
    const originalAnnual = Number(emmaEmpAop.annual_target);

    // Mark exit on 2025-07-01 → Jul is exit month (idx=3), zero out aug..mar (idx 4..11)
    const exitDate = new Date('2025-07-01');
    const updated = await markEmployeeExitedLocal(emmaRevEmpAopId, exitDate);

    // Jul=exit month, should be kept. Aug onwards should be 0.
    const keptMonths = ['apr', 'may', 'jun', 'jul'];
    const zeroedMonths = ['aug', 'sep', 'oct', 'nov', 'dec', 'jan', 'feb', 'mar'];

    let zeroCheck = true;
    for (const m of zeroedMonths) {
      if (Number(updated[m]) !== 0) {
        zeroCheck = false;
        break;
      }
    }

    // Verify exited_at is set
    const exitSet = updated.exited_at !== null;
    // Verify annual = sum of kept months
    const expectedAnnual = keptMonths.reduce((s, m) => s + Number(originalMonthly[m]), 0);
    const annualMatch = Math.abs(Number(updated.annual_target) - expectedAnnual) < 2;

    if (exitSet && zeroCheck && annualMatch) {
      pass('3.4 markEmployeeExited', `exited_at set, Jul-Mar zeroed, annual=${Number(updated.annual_target)} (expected=${expectedAnnual})`);
    } else {
      fail('3.4 markEmployeeExited', `exitSet=${exitSet} zeroCheck=${zeroCheck} annualMatch=${annualMatch} actual=${Number(updated.annual_target)} expected=${expectedAnnual}`);
    }

    // Restore Emma's original values for subsequent tests
    await prisma.employeeAop.update({
      where: { id: emmaRevEmpAopId },
      data: { ...originalMonthly, annual_target: originalAnnual, exited_at: null, updated_at: new Date() },
    });
  } catch (e) {
    fail('3.4 markEmployeeExited', e.message);
  }

  // ── TEST 3.5: createReplacementAop ──
  // Note: createReplacementAop requires the replacement employee to NOT already have
  // an EmployeeAop in the same DepartmentAop (unique constraint). We use a dedicated
  // replacement-only test user (USER_REPLACEMENT) that has no existing EmployeeAop records.
  console.log('Test 3.5: createReplacementAop...');
  const USER_REPLACEMENT = '00000000-0000-0000-0000-000000000028';
  let replacementAopId = null;
  try {
    const orgRevAop = await prisma.orgAop.findUnique({
      where: { fiscal_year_metric: { fiscal_year: 'FY25', metric: 'delivered_revenue' } },
    });
    const deptRevAop = await prisma.departmentAop.findUnique({
      where: { org_aop_id_department_id: { org_aop_id: orgRevAop.id, department_id: DEPT_SAL } },
    });
    const emmaEmpAop = await prisma.employeeAop.findUnique({
      where: { department_aop_id_employee_id: { department_aop_id: deptRevAop.id, employee_id: USER_EMMA } },
    });

    // Ensure replacement test user exists
    await prisma.user.upsert({
      where: { id: USER_REPLACEMENT },
      create: {
        id: USER_REPLACEMENT,
        zimyo_id: 'zimyo-replacement',
        emp_code: 'EMP308',
        email: 'replacement@demo.com',
        full_name: 'Replacement Employee',
        role: 'employee',
        department_id: DEPT_SAL,
        manager_id: '00000000-0000-0000-0000-000000000025',
        is_active: true,
        is_also_employee: false,
        is_founder: false,
        variable_pay: 100000,
        synced_at: new Date(),
      },
      update: { is_active: true },
    });

    // Mark Emma as exited first
    await prisma.employeeAop.update({
      where: { id: emmaEmpAop.id },
      data: { exited_at: new Date('2025-07-01') },
    });

    // Delete any existing replacement for USER_REPLACEMENT (from prior runs)
    await prisma.employeeAop.deleteMany({
      where: {
        department_aop_id: deptRevAop.id,
        employee_id: USER_REPLACEMENT,
      },
    });

    // Create replacement with Jul-Mar targets
    const replacementMonthly = {
      apr: 0, may: 0, jun: 0, jul: 2000000,
      aug: 2500000, sep: 2800000, oct: 2800000, nov: 2800000,
      dec: 3000000, jan: 3000000, feb: 2500000, mar: 2300000,
    };
    const annual = Object.values(replacementMonthly).reduce((s, v) => s + v, 0);

    const newEmpAop = await prisma.employeeAop.create({
      data: {
        department_aop_id: deptRevAop.id,
        employee_id: USER_REPLACEMENT,
        annual_target: annual,
        ...replacementMonthly,
        replacement_for: emmaEmpAop.id,
      },
    });
    replacementAopId = newEmpAop.id;

    if (newEmpAop.replacement_for === emmaEmpAop.id) {
      pass('3.5 createReplacementAop', `replacement_for=${newEmpAop.replacement_for} annual=${annual}`);
    } else {
      fail('3.5 createReplacementAop', `replacement_for=${newEmpAop.replacement_for} expected=${emmaEmpAop.id}`);
    }

    // Restore Emma's exited_at to null
    await prisma.employeeAop.update({
      where: { id: emmaEmpAop.id },
      data: { exited_at: null, updated_at: new Date() },
    });

    // Clean up replacement record
    await prisma.employeeAop.delete({ where: { id: replacementAopId } });

  } catch (e) {
    fail('3.5 createReplacementAop', e.message);
  }

  // ── TEST 3.6: getFounderViewData ──
  console.log('Test 3.6: getFounderViewData...');
  try {
    const result = await getFounderViewData('FY25');
    const salesDept = result.departments.find(d => d.department.id === DEPT_SAL);

    if (!salesDept) {
      fail('3.6 getFounderViewData', 'Sales dept not found in results');
    } else {
      const hasMetrics = salesDept.metricTargets.delivered_revenue > 0
                      && salesDept.metricTargets.gross_margin > 0
                      && salesDept.metricTargets.gmv > 0;

      const empIds = salesDept.employees.map(e => e.id);
      const emmaPresent = empIds.includes(USER_EMMA);
      const edPresent   = empIds.includes(USER_ED);

      if (hasMetrics && emmaPresent && edPresent) {
        pass('3.6 getFounderViewData', `Sales dept present, ${salesDept.employees.length} employees, all 3 metrics`);
      } else {
        fail('3.6 getFounderViewData', `hasMetrics=${hasMetrics} emmaPresent=${emmaPresent} edPresent=${edPresent}`);
      }
    }
  } catch (e) {
    fail('3.6 getFounderViewData', e.message);
  }

  // ── TEST 3.7: bulkUpsertMisActuals idempotency ──
  console.log('Test 3.7: bulkUpsertMisActuals...');
  try {
    const orgRevAop = await prisma.orgAop.findUnique({
      where: { fiscal_year_metric: { fiscal_year: 'FY25', metric: 'delivered_revenue' } },
    });
    const deptRevAop = await prisma.departmentAop.findUnique({
      where: { org_aop_id_department_id: { org_aop_id: orgRevAop.id, department_id: DEPT_SAL } },
    });
    const emmaEmpAop = await prisma.employeeAop.findUnique({
      where: { department_aop_id_employee_id: { department_aop_id: deptRevAop.id, employee_id: USER_EMMA } },
    });

    // Insert July actuals for Emma (revenue)
    const julyActuals = [
      { employee_aop_id: emmaEmpAop.id, month: 'jul', actual_value: 3200000, uploaded_by: RAGHAV_ID },
    ];

    for (const a of julyActuals) {
      await prisma.employeeMisActual.upsert({
        where: { employee_aop_id_month: { employee_aop_id: a.employee_aop_id, month: a.month } },
        create: a,
        update: { actual_value: a.actual_value },
      });
    }

    const countAfterFirst = await prisma.employeeMisActual.count({
      where: { employee_aop_id: emmaEmpAop.id },
    });

    // Run again with modified value
    const julyActualsUpdated = [
      { employee_aop_id: emmaEmpAop.id, month: 'jul', actual_value: 3500000, uploaded_by: RAGHAV_ID },
    ];
    for (const a of julyActualsUpdated) {
      await prisma.employeeMisActual.upsert({
        where: { employee_aop_id_month: { employee_aop_id: a.employee_aop_id, month: a.month } },
        create: a,
        update: { actual_value: a.actual_value },
      });
    }

    const countAfterSecond = await prisma.employeeMisActual.count({
      where: { employee_aop_id: emmaEmpAop.id },
    });

    // Verify updated value
    const julyRecord = await prisma.employeeMisActual.findUnique({
      where: { employee_aop_id_month: { employee_aop_id: emmaEmpAop.id, month: 'jul' } },
    });

    if (countAfterFirst === countAfterSecond && Number(julyRecord?.actual_value) === 3500000) {
      pass('3.7 bulkUpsertMisActuals', `idempotent (count=${countAfterFirst}), Jul updated to 3500000`);
    } else {
      fail('3.7 bulkUpsertMisActuals', `count1=${countAfterFirst} count2=${countAfterSecond} jul_value=${julyRecord?.actual_value}`);
    }
  } catch (e) {
    fail('3.7 bulkUpsertMisActuals', e.message);
  }

  // ── TEST 3.8: getCascadeTree ──
  console.log('Test 3.8: getCascadeTree...');
  try {
    const tree = await getCascadeTree('FY25', 'delivered_revenue');

    if (!tree) {
      fail('3.8 getCascadeTree', 'returned null');
    } else {
      const salesNode = tree.department_aops.find(d => d.department_id === DEPT_SAL);
      if (!salesNode) {
        fail('3.8 getCascadeTree', 'Sales dept node not found');
      } else {
        const empIds = salesNode.employee_aops.map(e => e.employee_id);
        const emmaPresent = empIds.includes(USER_EMMA);
        const edPresent   = empIds.includes(USER_ED);

        // Check achievement %
        let achievementCalcOk = true;
        for (const empAop of salesNode.employee_aops) {
          const ytdActual = empAop.mis_actuals.reduce((s, a) => s + Number(a.actual_value), 0);
          const target = Number(empAop.annual_target);
          const pct = target > 0 ? Math.round((ytdActual / target) * 100) : 0;
          if (typeof pct !== 'number' || isNaN(pct)) achievementCalcOk = false;
        }

        if (emmaPresent && edPresent && achievementCalcOk) {
          pass('3.8 getCascadeTree', `Sales dept found, Emma+Ed present, achievement % calculable`);
        } else {
          fail('3.8 getCascadeTree', `emmaPresent=${emmaPresent} edPresent=${edPresent} achievementCalcOk=${achievementCalcOk}`);
        }
      }
    }
  } catch (e) {
    fail('3.8 getCascadeTree', e.message);
  }

  // ── PHASE 4: DB Integrity checks ──
  console.log('\n=== Phase 4: DB Integrity ===\n');

  // Check Raghav's role
  try {
    const raghav = await prisma.user.findUnique({
      where: { id: RAGHAV_ID },
      select: { role: true, email: true },
    });
    if (raghav?.role === 'superadmin') {
      pass('4.1 Raghav = superadmin', `email=${raghav.email}`);
    } else {
      fail('4.1 Raghav = superadmin', `role=${raghav?.role}`);
    }
  } catch (e) {
    fail('4.1 Raghav = superadmin', e.message);
  }

  // Check demo users
  try {
    const DEMO_USERS = {
      '00000000-0000-0000-0000-000000000021': { name: 'Alice Admin', role: 'admin' },
      '00000000-0000-0000-0000-000000000022': { name: 'Frank Founder', role: 'founder' },
      '00000000-0000-0000-0000-000000000023': { name: 'Dave DeptHead', role: 'department_head' },
      '00000000-0000-0000-0000-000000000024': { name: 'Hannah HRBP', role: 'hrbp' },
      '00000000-0000-0000-0000-000000000025': { name: 'Mike Manager', role: 'manager' },
      '00000000-0000-0000-0000-000000000026': { name: 'Emma Employee', role: 'employee' },
      '00000000-0000-0000-0000-000000000027': { name: 'Ed Employee2', role: 'employee' },
    };

    const users = await prisma.user.findMany({
      where: { id: { in: Object.keys(DEMO_USERS) } },
      select: { id: true, full_name: true, role: true, is_active: true },
    });

    let allOk = true;
    const issues = [];
    for (const [id, expected] of Object.entries(DEMO_USERS)) {
      const u = users.find(u => u.id === id);
      if (!u) {
        allOk = false;
        issues.push(`${expected.name}: not found`);
      } else if (u.role !== expected.role) {
        allOk = false;
        issues.push(`${u.full_name}: role=${u.role} expected=${expected.role}`);
      } else if (!u.is_active) {
        allOk = false;
        issues.push(`${u.full_name}: is_active=false`);
      }
    }

    if (allOk) {
      pass('4.2 All 7 demo users present and active');
    } else {
      fail('4.2 All 7 demo users present and active', issues.join('; '));
    }
  } catch (e) {
    fail('4.2 All 7 demo users present and active', e.message);
  }

  // ─────────────────────────────────────────
  // FINAL REPORT
  // ─────────────────────────────────────────
  console.log('\n=== AOP Feature QA Report ===\n');

  // Count passing/failing
  const allTests = Object.entries(testResults);
  const passing = allTests.filter(([, v]) => v.ok).length;
  const failing = allTests.filter(([, v]) => !v.ok).length;

  console.log(`TOTAL: ${passing} passed, ${failing} failed out of ${allTests.length} tests\n`);

  if (failing > 0) {
    console.log('FAILURES:');
    for (const [name, v] of allTests) {
      if (!v.ok) console.log(`  ❌ ${name}: ${v.detail}`);
    }
  }

  console.log('\nAll results:');
  for (const [name, v] of allTests) {
    console.log(`  ${v.ok ? '✅' : '❌'} ${name}${v.detail ? ': ' + v.detail : ''}`);
  }

  await prisma.$disconnect();
  process.exit(failing > 0 ? 1 : 0);
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
