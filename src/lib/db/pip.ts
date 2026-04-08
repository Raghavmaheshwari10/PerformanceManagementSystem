import { prisma } from '@/lib/prisma'
import type { PipStatus, PipOutcome } from '@prisma/client'

/* ── Types ── */

export interface PipListItem {
  id: string
  employeeName: string
  employeeEmail: string
  department: string
  managerId: string
  managerName: string
  hrbpName: string
  reason: string
  startDate: Date
  endDate: Date
  status: string
  outcome: string | null
  daysRemaining: number
  milestoneProgress: { total: number; completed: number }
  isAcknowledged: boolean
  cycleId: string | null
  cycleName: string | null
  createdAt: Date
}

export interface PipDetail {
  id: string
  employee: { id: string; fullName: string; email: string; department: string; designation: string | null }
  manager: { id: string; fullName: string }
  initiator: { id: string; fullName: string }
  hrbp: { id: string; fullName: string }
  skipLevelManager: { id: string; fullName: string } | null
  cycle: { id: string; name: string } | null
  reason: string
  startDate: Date
  endDate: Date
  status: string
  outcome: string | null
  employeeAcknowledgedAt: Date | null
  escalationNote: string | null
  autoFlagNextCycle: boolean
  milestones: Array<{
    id: string
    title: string
    description: string | null
    targetMetric: string
    dueDate: Date
    status: string
    hrbpSignedOffAt: Date | null
    hrbpSignedOffBy: string | null
    sortOrder: number
  }>
  checkIns: Array<{
    id: string
    createdBy: { id: string; fullName: string }
    checkInDate: Date
    progressRating: number
    notes: string
    nextSteps: string | null
    employeeResponse: string | null
    createdAt: Date
  }>
  documents: Array<{
    id: string
    uploadedBy: { id: string; fullName: string }
    fileName: string
    fileUrl: string
    fileType: string
    description: string | null
    createdAt: Date
  }>
  createdAt: Date
  updatedAt: Date
}

export interface PipStats {
  totalActive: number
  totalAll: number
  byStatus: Record<string, number>
  byDepartment: Array<{ department: string; active: number; completed: number }>
  avgDurationDays: number
  outcomeDistribution: Record<string, number>
}

export interface PipRecommendation {
  employeeId: string
  employeeName: string
  email: string
  department: string
  managerId: string
  managerName: string
  finalRating: string
  cycleName: string
  cycleId: string
  hasActivePip: boolean
}

/* ── List ── */

export async function fetchPipList(options?: {
  status?: string
  managerId?: string
  hrbpDepartmentIds?: string[]
  employeeId?: string
}): Promise<PipListItem[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {}

  if (options?.status) {
    where.status = options.status as PipStatus
  }
  if (options?.managerId) {
    where.manager_id = options.managerId
  }
  if (options?.hrbpDepartmentIds && options.hrbpDepartmentIds.length > 0) {
    where.employee = { department_id: { in: options.hrbpDepartmentIds } }
  }
  if (options?.employeeId) {
    where.employee_id = options.employeeId
  }

  const pips = await prisma.pip.findMany({
    where,
    include: {
      employee: {
        select: {
          id: true,
          full_name: true,
          email: true,
          department: { select: { name: true } },
        },
      },
      manager: { select: { id: true, full_name: true } },
      hrbp: { select: { id: true, full_name: true } },
      cycle: { select: { id: true, name: true } },
      milestones: { select: { id: true, status: true } },
    },
  })

  const now = Date.now()

  const results: PipListItem[] = pips.map(pip => {
    const daysRemaining = Math.max(
      0,
      Math.ceil((new Date(pip.end_date).getTime() - now) / 86400000),
    )

    const total = pip.milestones.length
    const completed = pip.milestones.filter(m => m.status === 'completed').length

    return {
      id: pip.id,
      employeeName: pip.employee.full_name,
      employeeEmail: pip.employee.email,
      department: pip.employee.department?.name ?? '-',
      managerId: pip.manager.id,
      managerName: pip.manager.full_name,
      hrbpName: pip.hrbp.full_name,
      reason: pip.reason,
      startDate: pip.start_date,
      endDate: pip.end_date,
      status: pip.status,
      outcome: pip.outcome,
      daysRemaining,
      milestoneProgress: { total, completed },
      isAcknowledged: pip.employee_acknowledged_at != null,
      cycleId: pip.cycle?.id ?? null,
      cycleName: pip.cycle?.name ?? null,
      createdAt: pip.created_at,
    }
  })

  // Sort: active/extended first, then by end_date ascending
  const ACTIVE_STATUSES = new Set<string>(['active', 'extended'])

  results.sort((a, b) => {
    const aActive = ACTIVE_STATUSES.has(a.status) ? 0 : 1
    const bActive = ACTIVE_STATUSES.has(b.status) ? 0 : 1
    if (aActive !== bActive) return aActive - bActive
    return new Date(a.endDate).getTime() - new Date(b.endDate).getTime()
  })

  return results
}

/* ── Detail ── */

export async function fetchPipDetail(pipId: string): Promise<PipDetail | null> {
  const pip = await prisma.pip.findUnique({
    where: { id: pipId },
    include: {
      employee: {
        select: {
          id: true,
          full_name: true,
          email: true,
          designation: true,
          department: { select: { name: true } },
        },
      },
      manager: { select: { id: true, full_name: true } },
      initiator: { select: { id: true, full_name: true } },
      hrbp: { select: { id: true, full_name: true } },
      skip_level_manager: { select: { id: true, full_name: true } },
      cycle: { select: { id: true, name: true } },
      milestones: { orderBy: { sort_order: 'asc' } },
      check_ins: {
        include: { creator: { select: { id: true, full_name: true } } },
        orderBy: { check_in_date: 'desc' },
      },
      documents: {
        include: { uploader: { select: { id: true, full_name: true } } },
        orderBy: { created_at: 'desc' },
      },
    },
  })

  if (!pip) return null

  return {
    id: pip.id,
    employee: {
      id: pip.employee.id,
      fullName: pip.employee.full_name,
      email: pip.employee.email,
      department: pip.employee.department?.name ?? '-',
      designation: pip.employee.designation,
    },
    manager: { id: pip.manager.id, fullName: pip.manager.full_name },
    initiator: { id: pip.initiator.id, fullName: pip.initiator.full_name },
    hrbp: { id: pip.hrbp.id, fullName: pip.hrbp.full_name },
    skipLevelManager: pip.skip_level_manager
      ? { id: pip.skip_level_manager.id, fullName: pip.skip_level_manager.full_name }
      : null,
    cycle: pip.cycle ? { id: pip.cycle.id, name: pip.cycle.name } : null,
    reason: pip.reason,
    startDate: pip.start_date,
    endDate: pip.end_date,
    status: pip.status,
    outcome: pip.outcome,
    employeeAcknowledgedAt: pip.employee_acknowledged_at,
    escalationNote: pip.escalation_note,
    autoFlagNextCycle: pip.auto_flag_next_cycle,
    milestones: pip.milestones.map(m => ({
      id: m.id,
      title: m.title,
      description: m.description,
      targetMetric: m.target_metric,
      dueDate: m.due_date,
      status: m.status,
      hrbpSignedOffAt: m.hrbp_signed_off_at,
      hrbpSignedOffBy: m.hrbp_signed_off_by,
      sortOrder: m.sort_order,
    })),
    checkIns: pip.check_ins.map(c => ({
      id: c.id,
      createdBy: { id: c.creator.id, fullName: c.creator.full_name },
      checkInDate: c.check_in_date,
      progressRating: c.progress_rating,
      notes: c.notes,
      nextSteps: c.next_steps,
      employeeResponse: c.employee_response,
      createdAt: c.created_at,
    })),
    documents: pip.documents.map(d => ({
      id: d.id,
      uploadedBy: { id: d.uploader.id, fullName: d.uploader.full_name },
      fileName: d.file_name,
      fileUrl: d.file_url,
      fileType: d.file_type,
      description: d.description,
      createdAt: d.created_at,
    })),
    createdAt: pip.created_at,
    updatedAt: pip.updated_at,
  }
}

/* ── Stats ── */

export async function fetchPipStats(options?: {
  managerId?: string
  hrbpDepartmentIds?: string[]
}): Promise<PipStats> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const baseWhere: any = {}

  if (options?.managerId) {
    baseWhere.manager_id = options.managerId
  }
  if (options?.hrbpDepartmentIds && options.hrbpDepartmentIds.length > 0) {
    baseWhere.employee = { department_id: { in: options.hrbpDepartmentIds } }
  }

  // Total active PIPs (active + extended)
  const [totalActive, totalAll, allPips] = await Promise.all([
    prisma.pip.count({
      where: { ...baseWhere, status: { in: ['active', 'extended'] } },
    }),
    prisma.pip.count({ where: baseWhere }),
    prisma.pip.findMany({
      where: baseWhere,
      select: {
        status: true,
        outcome: true,
        start_date: true,
        end_date: true,
        updated_at: true,
        employee: {
          select: { department: { select: { name: true } } },
        },
      },
    }),
  ])

  // Group by status
  const byStatus: Record<string, number> = {}
  for (const pip of allPips) {
    byStatus[pip.status] = (byStatus[pip.status] ?? 0) + 1
  }

  // Group by department (active vs completed)
  const deptMap = new Map<string, { active: number; completed: number }>()
  for (const pip of allPips) {
    const dept = pip.employee.department?.name ?? '-'
    const entry = deptMap.get(dept) ?? { active: 0, completed: 0 }
    if (pip.status === 'active' || pip.status === 'extended') {
      entry.active++
    } else if (pip.status === 'completed' || pip.status === 'closed') {
      entry.completed++
    }
    deptMap.set(dept, entry)
  }
  const byDepartment = Array.from(deptMap.entries())
    .map(([department, counts]) => ({ department, ...counts }))
    .sort((a, b) => (b.active + b.completed) - (a.active + a.completed))

  // Average duration for completed/closed PIPs
  const completedPips = allPips.filter(
    p => p.status === 'completed' || p.status === 'closed',
  )
  let avgDurationDays = 0
  if (completedPips.length > 0) {
    const totalDays = completedPips.reduce((sum, p) => {
      const start = new Date(p.start_date).getTime()
      const end = new Date(p.updated_at).getTime()
      return sum + Math.ceil((end - start) / 86400000)
    }, 0)
    avgDurationDays = Math.round(totalDays / completedPips.length)
  }

  // Outcome distribution for completed PIPs
  const outcomeDistribution: Record<string, number> = {}
  for (const pip of completedPips) {
    if (pip.outcome) {
      outcomeDistribution[pip.outcome] = (outcomeDistribution[pip.outcome] ?? 0) + 1
    }
  }

  return {
    totalActive,
    totalAll,
    byStatus,
    byDepartment,
    avgDurationDays,
    outcomeDistribution,
  }
}

/* ── Recommendations ── */

export async function fetchPipRecommendations(
  cycleId?: string,
): Promise<PipRecommendation[]> {
  // Resolve target cycle
  const targetCycle = cycleId
    ? await prisma.cycle.findUnique({ where: { id: cycleId }, select: { id: true, name: true } })
    : await prisma.cycle.findFirst({
        where: { status: 'published' },
        orderBy: { published_at: 'desc' },
        select: { id: true, name: true },
      })

  if (!targetCycle) return []

  // Fetch appraisals with low ratings (SME / BE)
  const appraisals = await prisma.appraisal.findMany({
    where: {
      cycle_id: targetCycle.id,
      final_rating: { in: ['SME', 'BE'] },
      is_exit_frozen: false,
    },
    include: {
      employee: {
        select: {
          id: true,
          full_name: true,
          email: true,
          manager_id: true,
          department: { select: { name: true } },
          manager: { select: { full_name: true } },
        },
      },
    },
  })

  if (appraisals.length === 0) return []

  const employeeIds = appraisals.map(a => a.employee_id)

  // Check which employees already have an active PIP
  const activePips = await prisma.pip.findMany({
    where: {
      employee_id: { in: employeeIds },
      status: { in: ['draft', 'active', 'extended'] },
    },
    select: { employee_id: true },
  })

  const activePipSet = new Set(activePips.map(p => p.employee_id))

  return appraisals.map(appraisal => ({
    employeeId: appraisal.employee.id,
    employeeName: appraisal.employee.full_name,
    email: appraisal.employee.email,
    department: appraisal.employee.department?.name ?? '-',
    managerId: appraisal.employee.manager_id ?? '',
    managerName: appraisal.employee.manager?.full_name ?? '-',
    finalRating: appraisal.final_rating as string,
    cycleName: targetCycle.name,
    cycleId: targetCycle.id,
    hasActivePip: activePipSet.has(appraisal.employee.id),
  }))
}
