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

/**
 * Find the active cycle for a user based on their department.
 * - First looks for a dept-scoped active cycle matching the user's department.
 * - Falls back to an org-wide cycle (one with no CycleDepartment records).
 */
export async function getActiveCycleForUser(
  userId: string
): Promise<Cycle | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { department_id: true },
  });
  if (!user) return null;

  // Try dept-scoped cycle first
  if (user.department_id) {
    const deptCycle = await prisma.cycle.findFirst({
      where: {
        status: { in: ACTIVE_STATUSES },
        departments: {
          some: { department_id: user.department_id },
        },
      },
      orderBy: { created_at: "desc" },
    });
    if (deptCycle) return deptCycle;
  }

  // Fall back to org-wide cycle (no department assignments)
  const orgCycle = await prisma.cycle.findFirst({
    where: {
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
    select: { department_id: true },
  });
  if (!user) return null;

  // Try dept-scoped cycle first
  if (user.department_id) {
    const deptCycle = await prisma.cycle.findFirst({
      where: {
        status: { not: "draft" },
        departments: {
          some: { department_id: user.department_id },
        },
      },
      orderBy: { created_at: "desc" },
    });
    if (deptCycle) return deptCycle;
  }

  // Fall back to org-wide cycle
  const orgCycle = await prisma.cycle.findFirst({
    where: {
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
/** A cycle with its department assignments and department details included. */
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

  // Dept-scoped active cycles for those departments
  const deptCycles =
    deptIds.length > 0
      ? await prisma.cycle.findMany({
          where: {
            status: { in: ACTIVE_STATUSES },
            departments: {
              some: { department_id: { in: deptIds } },
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
 * Useful when building queries for reviews, appraisals, KPIs, etc.
 */
export async function getScopedEmployeeWhere(cycleId: string) {
  const deptIds = await getCycleDepartmentIds(cycleId);
  const base = {
    is_active: true,
    role: { notIn: ["admin" as const, "hrbp" as const] },
  };
  if (deptIds.length > 0) {
    return { ...base, department_id: { in: deptIds } };
  }
  return base;
}
