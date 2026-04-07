import { prisma } from '@/lib/prisma'

/* ── Types ── */

export interface CompetencyGapRow {
  employeeId: string
  employeeName: string
  department: string
  competencyScores: Record<string, number | null> // competencyId -> avg rating (1-5)
}

export interface CompetencyMeta {
  id: string
  name: string
  category: string // core, functional, leadership
}

export interface CompetencyGapStats {
  competencies: CompetencyMeta[]
  overallAvg: Record<string, number> // competencyId -> org-wide avg rating
  deptAvg: Record<string, Record<string, number>> // deptName -> competencyId -> avg
  lowestCompetency: { name: string; avg: number } | null
  lowestDept: { name: string; avg: number } | null
  overallScore: number
}

export interface CompetencyTrendPoint {
  cycleName: string
  cycleId: string
  averages: Record<string, number> // competencyId -> avg rating
}

/* ── Helpers ── */

interface FetchOptions {
  managerId?: string
  departmentId?: string
}

/* ── Per-employee per-competency manager ratings ── */

export async function fetchCompetencyGapData(
  cycleId: string,
  options?: FetchOptions,
): Promise<{ rows: CompetencyGapRow[]; competencies: CompetencyMeta[] }> {
  // 1. Get active competencies
  const competencies = await prisma.competency.findMany({
    where: { is_active: true },
    select: { id: true, name: true, category: true },
    orderBy: [{ category: 'asc' }, { sort_order: 'asc' }],
  })

  if (competencies.length === 0) return { rows: [], competencies: [] }

  // 2. Get cycle's review template -> find competency-linked questions
  const cycle = await prisma.cycle.findUnique({
    where: { id: cycleId },
    select: { review_template_id: true },
  })

  if (!cycle?.review_template_id) return { rows: [], competencies: [] }

  const competencyIds = competencies.map(c => c.id)

  const questions = await prisma.reviewQuestion.findMany({
    where: {
      template_id: cycle.review_template_id,
      competency_id: { in: competencyIds },
      answer_type: 'rating',
    },
    select: { id: true, competency_id: true },
  })

  if (questions.length === 0) return { rows: [], competencies: [] }

  // Build questionId -> competencyId map
  const questionCompetencyMap = new Map<string, string>()
  for (const q of questions) {
    if (q.competency_id) questionCompetencyMap.set(q.id, q.competency_id)
  }
  const questionIds = Array.from(questionCompetencyMap.keys())

  // 3. Get reviews for this cycle (with optional filters)
  const reviewWhere: any = { cycle_id: cycleId }
  if (options?.managerId) {
    reviewWhere.employee = { manager_id: options.managerId }
  }
  if (options?.departmentId) {
    reviewWhere.employee = {
      ...reviewWhere.employee,
      department_id: options.departmentId,
    }
  }

  const reviews = await prisma.review.findMany({
    where: reviewWhere,
    select: {
      id: true,
      employee_id: true,
      employee: {
        select: {
          id: true,
          full_name: true,
          department: { select: { name: true } },
        },
      },
    },
  })

  if (reviews.length === 0) return { rows: [], competencies: [] }

  const reviewIds = reviews.map(r => r.id)
  const employeeIdSet = new Set(reviews.map(r => r.employee_id))

  // 4. Get responses — only manager responses (respondent_id != employee_id)
  const responses = await prisma.reviewResponse.findMany({
    where: {
      review_id: { in: reviewIds },
      question_id: { in: questionIds },
      rating_value: { not: null },
    },
    select: {
      review_id: true,
      question_id: true,
      respondent_id: true,
      rating_value: true,
    },
  })

  // Build review -> employee map
  const reviewEmployeeMap = new Map<string, string>()
  for (const r of reviews) {
    reviewEmployeeMap.set(r.id, r.employee_id)
  }

  // 5. Aggregate per employee per competency (manager responses only)
  // employeeId -> competencyId -> rating values
  const aggMap = new Map<string, Map<string, number[]>>()

  for (const resp of responses) {
    const employeeId = reviewEmployeeMap.get(resp.review_id)
    if (!employeeId) continue

    // Filter: only manager responses (respondent is not the employee)
    if (resp.respondent_id === employeeId) continue

    const competencyId = questionCompetencyMap.get(resp.question_id)
    if (!competencyId) continue

    if (!aggMap.has(employeeId)) aggMap.set(employeeId, new Map())
    const empMap = aggMap.get(employeeId)!
    if (!empMap.has(competencyId)) empMap.set(competencyId, [])
    empMap.get(competencyId)!.push(resp.rating_value!)
  }

  // Build employee info map
  const employeeInfoMap = new Map<string, { name: string; department: string }>()
  for (const r of reviews) {
    if (!employeeInfoMap.has(r.employee_id)) {
      employeeInfoMap.set(r.employee_id, {
        name: r.employee.full_name,
        department: r.employee.department?.name ?? '-',
      })
    }
  }

  // 6. Build result rows
  const rows: CompetencyGapRow[] = []

  for (const empId of employeeIdSet) {
    const info = employeeInfoMap.get(empId)
    if (!info) continue

    const empCompMap = aggMap.get(empId)
    const scores: Record<string, number | null> = {}

    for (const comp of competencies) {
      const ratings = empCompMap?.get(comp.id)
      if (ratings && ratings.length > 0) {
        scores[comp.id] = Math.round(
          (ratings.reduce((s, v) => s + v, 0) / ratings.length) * 100,
        ) / 100
      } else {
        scores[comp.id] = null
      }
    }

    rows.push({
      employeeId: empId,
      employeeName: info.name,
      department: info.department,
      competencyScores: scores,
    })
  }

  // Sort by employee name
  rows.sort((a, b) => a.employeeName.localeCompare(b.employeeName))

  const meta: CompetencyMeta[] = competencies.map(c => ({
    id: c.id,
    name: c.name,
    category: c.category,
  }))

  return { rows, competencies: meta }
}

/* ── Aggregated stats ── */

export async function fetchCompetencyGapStats(
  cycleId: string,
  options?: FetchOptions,
): Promise<CompetencyGapStats> {
  const { rows, competencies } = await fetchCompetencyGapData(cycleId, options)

  // Overall avg per competency
  const overallAvg: Record<string, number> = {}
  for (const comp of competencies) {
    const values = rows
      .map(r => r.competencyScores[comp.id])
      .filter((v): v is number => v != null)
    if (values.length > 0) {
      overallAvg[comp.id] =
        Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 100) / 100
    }
  }

  // Dept avg per competency — group rows by department
  const deptRows = new Map<string, CompetencyGapRow[]>()
  for (const row of rows) {
    const arr = deptRows.get(row.department) ?? []
    arr.push(row)
    deptRows.set(row.department, arr)
  }

  const deptAvg: Record<string, Record<string, number>> = {}
  for (const [deptName, deptRowList] of deptRows) {
    deptAvg[deptName] = {}
    for (const comp of competencies) {
      const values = deptRowList
        .map(r => r.competencyScores[comp.id])
        .filter((v): v is number => v != null)
      if (values.length > 0) {
        deptAvg[deptName][comp.id] =
          Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 100) / 100
      }
    }
  }

  // Lowest competency (org-wide)
  let lowestCompetency: { name: string; avg: number } | null = null
  for (const comp of competencies) {
    const avg = overallAvg[comp.id]
    if (avg != null && (lowestCompetency == null || avg < lowestCompetency.avg)) {
      lowestCompetency = { name: comp.name, avg }
    }
  }

  // Lowest dept (average across all competencies per dept)
  let lowestDept: { name: string; avg: number } | null = null
  for (const [deptName, compAvgs] of Object.entries(deptAvg)) {
    const values = Object.values(compAvgs)
    if (values.length === 0) continue
    const deptOverall =
      Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 100) / 100
    if (lowestDept == null || deptOverall < lowestDept.avg) {
      lowestDept = { name: deptName, avg: deptOverall }
    }
  }

  // Overall score: average of all overallAvg values
  const allAvgs = Object.values(overallAvg)
  const overallScore =
    allAvgs.length > 0
      ? Math.round((allAvgs.reduce((s, v) => s + v, 0) / allAvgs.length) * 100) / 100
      : 0

  return {
    competencies,
    overallAvg,
    deptAvg,
    lowestCompetency,
    lowestDept,
    overallScore,
  }
}

/* ── Trend across cycles ── */

export async function fetchCompetencyTrends(
  competencyIds: string[],
  options?: FetchOptions,
): Promise<CompetencyTrendPoint[]> {
  // Get last 5 published cycles (chronological: oldest first)
  const publishedCycles = await prisma.cycle.findMany({
    where: { status: 'published' },
    orderBy: { published_at: 'desc' },
    take: 5,
    select: { id: true, name: true },
  })

  if (publishedCycles.length === 0) return []

  const chronological = [...publishedCycles].reverse()
  const targetCompetencyIds = new Set(competencyIds)

  const results: CompetencyTrendPoint[] = []

  for (const cycle of chronological) {
    const { rows, competencies } = await fetchCompetencyGapData(cycle.id, options)

    // Compute averages only for requested competencyIds
    const averages: Record<string, number> = {}

    for (const comp of competencies) {
      if (!targetCompetencyIds.has(comp.id)) continue

      const values = rows
        .map(r => r.competencyScores[comp.id])
        .filter((v): v is number => v != null)
      if (values.length > 0) {
        averages[comp.id] =
          Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 100) / 100
      }
    }

    results.push({
      cycleName: cycle.name,
      cycleId: cycle.id,
      averages,
    })
  }

  return results
}
