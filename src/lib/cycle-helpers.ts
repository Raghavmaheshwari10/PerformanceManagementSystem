import { prisma } from "@/lib/prisma";
import type { Cycle, CycleStatus, CycleDepartment, Department } from "@prisma/client";

// Statuses considered "active" for employee-facing flows (excludes draft + published)
const ACTIVE_STATUSES: CycleStatus[] = [
  "kpi_setting",
  "self_review",
  "manager_review",
  "calibrating",
  "locked",
];

// ─── Status Resolution ───────────────────────────────────────────────

/**
 * Resolve the effective cycle status for a specific employee.
 * Priority: CycleEmployee.status_override → CycleDepartment.status → Cycle.status
 */
export async function getStatusForEmployee(
  cycleId: string,
  employeeId: string
): Promise<CycleStatus> {
  // 1. Check employee-level override
  const empOverride = await prisma.cycleEmployee.findUnique({
    where: { cycle_id_employee_id: { cycle_id: cycleId, employee_id: employeeId } },
    select: { status_override: true, excluded: true },
  });
  if (empOverride?.excluded) return "draft"; // excluded employees see draft
  if (empOverride?.status_override) return empOverride.status_override;

  // 2. Check department-level status
  const user = await prisma.user.findUnique({
    where: { id: employeeId },
    select: { department_id: true },
  });
  if (user?.department_id) {
    const deptStatus = await prisma.cycleDepartment.findUnique({
      where: {
        cycle_id_department_id: {
          cycle_id: cycleId,
          department_id: user.department_id,
        },
      },
      select: { status: true },
    });
    if (deptStatus) return deptStatus.status;
  }

  // 3. Fallback to cycle-level status (org-wide)
  const cycle = await prisma.cycle.findUnique({
    where: { id: cycleId },
    select: { status: true },
  });
  return cycle?.status ?? "draft";
}

/**
 * Get the cycle status for a specific department within a cycle.
 * Falls back to Cycle.status for org-wide cycles.
 */
export async function getStatusForDepartment(
  cycleId: string,
  departmentId: string
): Promise<CycleStatus> {
  const cd = await prisma.cycleDepartment.findUnique({
    where: {
      cycle_id_department_id: {
        cycle_id: cycleId,
        department_id: departmentId,
      },
    },
    select: { status: true },
  });
  if (cd) return cd.status;

  const cycle = await prisma.cycle.findUnique({
    where: { id: cycleId },
    select: { status: true },
  });
  return cycle?.status ?? "draft";
}

/**
 * Get per-department status breakdown for a cycle.
 * For org-wide cycles (no departments), returns the cycle's own status.
 */
export async function getCycleDepartmentStatuses(cycleId: string): Promise<
  { departmentId: string; departmentName: string; status: CycleStatus }[]
> {
  const depts = await prisma.cycleDepartment.findMany({
    where: { cycle_id: cycleId },
    include: { department: { select: { name: true } } },
  });
  return depts.map((d) => ({
    departmentId: d.department_id,
    departmentName: d.department.name,
    status: d.status,
  }));
}

// ─── Cycle Discovery ─────────────────────────────────────────────────

/**
 * Find the active cycle for a user based on their department.
 * Checks department-level status (not just cycle-level) for dept-scoped cycles.
 */
export async function getActiveCycleForUser(
  userId: string
): Promise<Cycle | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, department_id: true },
  });
  if (!user) return null;

  // Check if user is explicitly excluded from any cycle
  const exclusions = await prisma.cycleEmployee.findMany({
    where: { employee_id: user.id, excluded: true },
    select: { cycle_id: true },
  });
  const excludedCycleIds = exclusions.map((e) => e.cycle_id);

  // Check for employee-level override (explicitly included in a cycle)
  const empOverride = await prisma.cycleEmployee.findFirst({
    where: {
      employee_id: user.id,
      excluded: false,
      status_override: { in: ACTIVE_STATUSES },
      cycle_id: { notIn: excludedCycleIds },
    },
    include: { cycle: true },
    orderBy: { created_at: "desc" },
  });
  if (empOverride) return empOverride.cycle;

  // Try dept-scoped cycle with active department status
  if (user.department_id) {
    const deptCycle = await prisma.cycleDepartment.findFirst({
      where: {
        department_id: user.department_id,
        status: { in: ACTIVE_STATUSES },
        cycle_id: { notIn: excludedCycleIds },
      },
      include: { cycle: true },
      orderBy: { cycle: { created_at: "desc" } },
    });
    if (deptCycle) return deptCycle.cycle;
  }

  // Fall back to org-wide cycle (no department assignments) with active status
  const orgCycle = await prisma.cycle.findFirst({
    where: {
      id: { notIn: excludedCycleIds },
      status: { in: ACTIVE_STATUSES },
      departments: { none: {} },
    },
    orderBy: { created_at: "desc" },
  });

  return orgCycle;
}

/**
 * Same as getActiveCycleForUser but uses a broader status filter
 * (everything except 'draft'). Used on the employee dashboard where
 * published cycles should still be visible to show final results.
 */
export async function getVisibleCycleForUser(
  userId: string
): Promise<Cycle | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, department_id: true },
  });
  if (!user) return null;

  const exclusions = await prisma.cycleEmployee.findMany({
    where: { employee_id: user.id, excluded: true },
    select: { cycle_id: true },
  });
  const excludedCycleIds = exclusions.map((e) => e.cycle_id);

  const VISIBLE_STATUSES: CycleStatus[] = [...ACTIVE_STATUSES, "published"];

  // Employee override
  const empOverride = await prisma.cycleEmployee.findFirst({
    where: {
      employee_id: user.id,
      excluded: false,
      status_override: { in: VISIBLE_STATUSES },
      cycle_id: { notIn: excludedCycleIds },
    },
    include: { cycle: true },
    orderBy: { created_at: "desc" },
  });
  if (empOverride) return empOverride.cycle;

  // Dept-scoped cycle with visible department status
  if (user.department_id) {
    const deptCycle = await prisma.cycleDepartment.findFirst({
      where: {
        department_id: user.department_id,
        status: { in: VISIBLE_STATUSES },
        cycle_id: { notIn: excludedCycleIds },
      },
      include: { cycle: true },
      orderBy: { cycle: { created_at: "desc" } },
    });
    if (deptCycle) return deptCycle.cycle;
  }

  // Org-wide cycle
  const orgCycle = await prisma.cycle.findFirst({
    where: {
      id: { notIn: excludedCycleIds },
      status: { not: "draft" },
      departments: { none: {} },
    },
    orderBy: { created_at: "desc" },
  });

  return orgCycle;
}

/**
 * For managers who may have direct reports across multiple departments.
 * Returns all active dept-scoped cycles matching those departments,
 * plus the org-wide active cycle (if any).
 */
export type CycleWithDepartments = Cycle & {
  departments: (CycleDepartment & { department: Department })[];
};

export async function getActiveCyclesForManager(managerId: string): Promise<{
  deptCycles: CycleWithDepartments[];
  orgCycle: Cycle | null;
}> {
  // Get unique department IDs from active direct reports
  const reports = await prisma.user.findMany({
    where: { manager_id: managerId, is_active: true },
    select: { department_id: true },
    distinct: ["department_id"],
  });

  const deptIds = reports
    .map((r) => r.department_id)
    .filter((id): id is string => id !== null);

  // Dept-scoped cycles where at least one department has active status
  const deptCycles =
    deptIds.length > 0
      ? await prisma.cycle.findMany({
          where: {
            departments: {
              some: {
                department_id: { in: deptIds },
                status: { in: ACTIVE_STATUSES },
              },
            },
          },
          include: { departments: { include: { department: true } } },
          orderBy: { created_at: "desc" },
        })
      : [];

  // Org-wide active cycle
  const orgCycle = await prisma.cycle.findFirst({
    where: {
      status: { in: ACTIVE_STATUSES },
      departments: { none: {} },
    },
    orderBy: { created_at: "desc" },
  });

  return { deptCycles, orgCycle };
}

// ─── Exit / Proration Helpers ────────────────────────────────────────

/**
 * Derive cycle start and end dates from quarter + year.
 * Quarters: Q1 = Apr-Jun, Q2 = Jul-Sep, Q3 = Oct-Dec, Q4 = Jan-Mar
 * Also supports "annual" / "H1" / "H2" quarter values.
 */
export function getCycleDateRange(quarter: string, year: number): { start: Date; end: Date } {
  const q = quarter.toUpperCase()
  if (q === 'Q1')     return { start: new Date(year, 3, 1), end: new Date(year, 5, 30) }
  if (q === 'Q2')     return { start: new Date(year, 6, 1), end: new Date(year, 8, 30) }
  if (q === 'Q3')     return { start: new Date(year, 9, 1), end: new Date(year, 11, 31) }
  if (q === 'Q4')     return { start: new Date(year + 1, 0, 1), end: new Date(year + 1, 2, 31) }
  if (q === 'H1')     return { start: new Date(year, 3, 1), end: new Date(year, 8, 30) }
  if (q === 'H2')     return { start: new Date(year, 9, 1), end: new Date(year + 1, 2, 31) }
  // Annual / fallback: full financial year Apr–Mar
  return { start: new Date(year, 3, 1), end: new Date(year + 1, 2, 31) }
}

/**
 * Calculate proration factor: days_worked / total_cycle_days.
 * Returns a number between 0 and 1 (capped).
 */
export function calculateProration(exitDate: Date, cycleStart: Date, cycleEnd: Date): number {
  const totalDays = Math.max(1, Math.ceil((cycleEnd.getTime() - cycleStart.getTime()) / (1000 * 60 * 60 * 24)))
  const daysWorked = Math.max(0, Math.ceil((exitDate.getTime() - cycleStart.getTime()) / (1000 * 60 * 60 * 24)))
  return Math.min(1, Math.max(0, daysWorked / totalDays))
}

/**
 * Freeze all active cycle participations for an employee on exit.
 * Called when admin deactivates a user.
 */
export async function freezeEmployeeCycles(employeeId: string, adminId: string): Promise<{
  frozenCount: number
  cycles: Array<{ cycleId: string; cycleName: string; prorationFactor: number }>
}> {
  const now = new Date()
  const result: Array<{ cycleId: string; cycleName: string; prorationFactor: number }> = []

  // Find all non-published appraisals for this employee
  const appraisals = await prisma.appraisal.findMany({
    where: {
      employee_id: employeeId,
      is_exit_frozen: false,
      cycle: { status: { notIn: ['published', 'draft'] } },
    },
    include: {
      cycle: { select: { id: true, name: true, quarter: true, year: true } },
    },
  })

  for (const appraisal of appraisals) {
    const { start, end } = getCycleDateRange(appraisal.cycle.quarter, appraisal.cycle.year)
    const prorationFactor = calculateProration(now, start, end)

    await prisma.appraisal.update({
      where: { id: appraisal.id },
      data: {
        exited_at: now,
        is_exit_frozen: true,
        proration_factor: prorationFactor,
        updated_at: now,
      },
    })

    await prisma.auditLog.create({
      data: {
        cycle_id: appraisal.cycle.id,
        changed_by: adminId,
        action: 'employee_exited_cycle',
        entity_type: 'appraisal',
        entity_id: appraisal.id,
        new_value: {
          employee_id: employeeId,
          cycle_id: appraisal.cycle.id,
          proration_factor: prorationFactor,
          exited_at: now.toISOString(),
        },
      },
    })

    result.push({
      cycleId: appraisal.cycle.id,
      cycleName: appraisal.cycle.name,
      prorationFactor,
    })
  }

  return { frozenCount: result.length, cycles: result }
}

// ─── Scoping Helpers ─────────────────────────────────────────────────

/**
 * Returns the department IDs scoped to a cycle.
 * An empty array means the cycle is org-wide.
 */
export async function getCycleDepartmentIds(
  cycleId: string
): Promise<string[]> {
  const records = await prisma.cycleDepartment.findMany({
    where: { cycle_id: cycleId },
    select: { department_id: true },
  });
  return records.map((r) => r.department_id);
}

/**
 * Returns a Prisma `where` clause for filtering employees to a cycle's scope.
 * Respects CycleEmployee exclusions and inclusions.
 */
export async function getScopedEmployeeWhere(cycleId: string) {
  const deptIds = await getCycleDepartmentIds(cycleId);

  // Get explicitly excluded employees
  const excluded = await prisma.cycleEmployee.findMany({
    where: { cycle_id: cycleId, excluded: true },
    select: { employee_id: true },
  });
  const excludedIds = excluded.map((e) => e.employee_id);

  // Get explicitly included employees (from non-scoped departments)
  const included = await prisma.cycleEmployee.findMany({
    where: { cycle_id: cycleId, excluded: false },
    select: { employee_id: true },
  });
  const includedIds = included.map((e) => e.employee_id);

  const base = {
    is_active: true,
    role: { notIn: ["admin" as const, "hrbp" as const] },
    id: excludedIds.length > 0 ? { notIn: excludedIds } : undefined,
  };

  if (deptIds.length > 0) {
    // Dept-scoped: employees in selected departments + explicitly included
    return {
      AND: [
        base,
        {
          OR: [
            { department_id: { in: deptIds } },
            ...(includedIds.length > 0 ? [{ id: { in: includedIds } }] : []),
          ],
        },
      ],
    };
  }

  // Org-wide
  return base;
}
