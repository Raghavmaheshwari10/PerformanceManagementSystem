import { prisma } from '@/lib/prisma'

/* ── Rating → score mapping (0-100 scale) ── */

const RATING_SCORE: Record<string, number> = {
  FEE: 95,
  EE: 80,
  ME: 60,
  SME: 40,
  BE: 20,
}

/* ── Types ── */

export interface GoalTreeKpi {
  id: string
  title: string
  weight: number | null
  score: number | null // 0-100 from appraisal or manager rating
  employeeName: string
}

export interface GoalTreeDeptGoal {
  id: string
  title: string
  description: string | null
  department: string
  departmentId: string
  creatorName: string
  progress: number // 0-100, weighted avg of linked KPI scores
  kpiCount: number
  kpis: GoalTreeKpi[]
}

export interface GoalTreeOrgGoal {
  id: string
  title: string
  description: string | null
  cycleName: string | null
  cycleId: string | null
  creatorName: string
  progress: number // 0-100, avg of dept goal progresses
  deptGoalCount: number
  deptGoals: GoalTreeDeptGoal[]
}

export interface GoalCascadingStats {
  totalOrgGoals: number
  avgCompletion: number
  deptsOnTrack: number // depts with avg progress >= 50
  deptsBehind: number // depts with avg progress < 50
  unlinkedKpis: number // KPIs without dept_goal_id for current cycle
}

/* ── Main tree query ── */

export async function fetchGoalTree(options?: {
  cycleId?: string
  departmentId?: string
  managerId?: string
}): Promise<GoalTreeOrgGoal[]> {
  // 1. Resolve target cycle (latest published if none specified)
  const targetCycle = options?.cycleId
    ? await prisma.cycle.findUnique({
        where: { id: options.cycleId },
        select: { id: true, name: true },
      })
    : await prisma.cycle.findFirst({
        where: { status: 'published' },
        orderBy: { published_at: 'desc' },
        select: { id: true, name: true },
      })

  if (!targetCycle) return []

  // 2. Build dept-goal filter
  const deptGoalWhere: Record<string, unknown> = {}
  if (options?.departmentId) {
    deptGoalWhere.department_id = options.departmentId
  }

  // Build KPI filter
  const kpiWhere: Record<string, unknown> = {}
  if (options?.managerId) {
    kpiWhere.manager_id = options.managerId
  }

  // 3. Fetch org goals with nested includes
  const orgGoals = await prisma.orgGoal.findMany({
    where: { cycle_id: targetCycle.id },
    include: {
      cycle: { select: { id: true, name: true } },
      creator: { select: { full_name: true } },
      dept_goals: {
        where: Object.keys(deptGoalWhere).length > 0 ? deptGoalWhere : undefined,
        include: {
          department: { select: { id: true, name: true } },
          creator: { select: { full_name: true } },
          kpis: {
            where: Object.keys(kpiWhere).length > 0 ? kpiWhere : undefined,
            include: {
              employee: { select: { id: true, full_name: true } },
            },
          },
        },
      },
    },
    orderBy: { created_at: 'asc' },
  })

  if (orgGoals.length === 0) return []

  // 4. Batch-fetch appraisal scores for all linked employees
  const employeeIds = new Set<string>()
  for (const og of orgGoals) {
    for (const dg of og.dept_goals) {
      for (const kpi of dg.kpis) {
        employeeIds.add(kpi.employee_id)
      }
    }
  }

  const appraisalScoreMap = new Map<string, number>()

  if (employeeIds.size > 0) {
    const appraisals = await prisma.appraisal.findMany({
      where: {
        cycle_id: targetCycle.id,
        employee_id: { in: [...employeeIds] },
      },
      select: {
        employee_id: true,
        mis_score: true,
      },
    })

    for (const a of appraisals) {
      if (a.mis_score != null) {
        appraisalScoreMap.set(a.employee_id, Number(a.mis_score))
      }
    }
  }

  // 5. Build the tree with computed progress
  const result: GoalTreeOrgGoal[] = []

  for (const og of orgGoals) {
    const deptGoals: GoalTreeDeptGoal[] = []

    for (const dg of og.dept_goals) {
      const kpis: GoalTreeKpi[] = []

      for (const kpi of dg.kpis) {
        // Score: appraisal mis_score first, fallback to manager_rating mapped score
        let score: number | null = appraisalScoreMap.get(kpi.employee_id) ?? null
        if (score == null && kpi.manager_rating) {
          score = RATING_SCORE[kpi.manager_rating] ?? null
        }

        kpis.push({
          id: kpi.id,
          title: kpi.title,
          weight: kpi.weight != null ? Number(kpi.weight) : null,
          score,
          employeeName: kpi.employee.full_name,
        })
      }

      // Dept goal progress: weighted average of linked KPI scores (default weight = 1)
      let progress = 0
      if (kpis.length > 0) {
        let totalWeight = 0
        let weightedSum = 0
        for (const k of kpis) {
          const w = k.weight ?? 1
          const s = k.score ?? 0
          totalWeight += w
          weightedSum += w * s
        }
        progress = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0
      }

      deptGoals.push({
        id: dg.id,
        title: dg.title,
        description: dg.description,
        department: dg.department.name,
        departmentId: dg.department.id,
        creatorName: dg.creator.full_name,
        progress,
        kpiCount: kpis.length,
        kpis,
      })
    }

    // Org goal progress: equal-weight avg of dept goals that have KPIs
    const deptGoalsWithKpis = deptGoals.filter(dg => dg.kpiCount > 0)
    let orgProgress = 0
    if (deptGoalsWithKpis.length > 0) {
      const sum = deptGoalsWithKpis.reduce((s, dg) => s + dg.progress, 0)
      orgProgress = Math.round(sum / deptGoalsWithKpis.length)
    }

    result.push({
      id: og.id,
      title: og.title,
      description: og.description,
      cycleName: og.cycle?.name ?? null,
      cycleId: og.cycle?.id ?? null,
      creatorName: og.creator.full_name,
      progress: orgProgress,
      deptGoalCount: deptGoals.length,
      deptGoals,
    })
  }

  return result
}

/* ── Summary stats ── */

export async function fetchGoalCascadingStats(options?: {
  cycleId?: string
  departmentId?: string
  managerId?: string
}): Promise<GoalCascadingStats> {
  const tree = await fetchGoalTree(options)

  // Resolve cycle for unlinked KPI count
  const targetCycle = options?.cycleId
    ? await prisma.cycle.findUnique({ where: { id: options.cycleId }, select: { id: true } })
    : await prisma.cycle.findFirst({
        where: { status: 'published' },
        orderBy: { published_at: 'desc' },
        select: { id: true },
      })

  const unlinkedKpis = targetCycle
    ? await prisma.kpi.count({
        where: { cycle_id: targetCycle.id, dept_goal_id: null },
      })
    : 0

  // Aggregate dept-level progress by department
  const deptProgressMap = new Map<string, number[]>()
  for (const og of tree) {
    for (const dg of og.deptGoals) {
      const arr = deptProgressMap.get(dg.departmentId) ?? []
      arr.push(dg.progress)
      deptProgressMap.set(dg.departmentId, arr)
    }
  }

  let deptsOnTrack = 0
  let deptsBehind = 0
  for (const progresses of deptProgressMap.values()) {
    const avg = progresses.reduce((s, v) => s + v, 0) / progresses.length
    if (avg >= 50) deptsOnTrack++
    else deptsBehind++
  }

  // Avg completion across all org goals
  const totalOrgGoals = tree.length
  const avgCompletion =
    totalOrgGoals > 0
      ? Math.round(tree.reduce((s, og) => s + og.progress, 0) / totalOrgGoals)
      : 0

  return {
    totalOrgGoals,
    avgCompletion,
    deptsOnTrack,
    deptsBehind,
    unlinkedKpis,
  }
}

/* ── CRUD helpers ── */

export async function createOrgGoal(data: {
  title: string
  description?: string
  cycleId?: string
  createdBy: string
}) {
  return prisma.orgGoal.create({
    data: {
      title: data.title,
      description: data.description,
      cycle_id: data.cycleId,
      created_by: data.createdBy,
    },
  })
}

export async function updateOrgGoal(
  id: string,
  data: { title?: string; description?: string; cycleId?: string }
) {
  return prisma.orgGoal.update({
    where: { id },
    data: {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.cycleId !== undefined && { cycle_id: data.cycleId }),
    },
  })
}

export async function deleteOrgGoal(id: string) {
  return prisma.orgGoal.delete({ where: { id } })
}

export async function createDeptGoal(data: {
  title: string
  description?: string
  orgGoalId: string
  departmentId: string
  createdBy: string
}) {
  return prisma.deptGoal.create({
    data: {
      title: data.title,
      description: data.description,
      org_goal_id: data.orgGoalId,
      department_id: data.departmentId,
      created_by: data.createdBy,
    },
  })
}

export async function updateDeptGoal(
  id: string,
  data: { title?: string; description?: string }
) {
  return prisma.deptGoal.update({
    where: { id },
    data: {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.description !== undefined && { description: data.description }),
    },
  })
}

export async function deleteDeptGoal(id: string) {
  return prisma.deptGoal.delete({ where: { id } })
}

export async function linkKpiToDeptGoal(kpiId: string, deptGoalId: string) {
  return prisma.kpi.update({
    where: { id: kpiId },
    data: { dept_goal_id: deptGoalId },
  })
}

export async function unlinkKpi(kpiId: string) {
  return prisma.kpi.update({
    where: { id: kpiId },
    data: { dept_goal_id: null },
  })
}
