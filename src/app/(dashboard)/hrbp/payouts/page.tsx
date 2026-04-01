import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { PayoutDashboard } from '@/components/payout-table'

export default async function HrbpPayoutsPage() {
  const user = await requireRole(['hrbp'])

  // Get departments assigned to this HRBP
  const hrbpDepts = await prisma.hrbpDepartment.findMany({
    where: { hrbp_id: user.id },
    select: { department_id: true },
  })
  const deptIds = hrbpDepts.map(d => d.department_id)

  const allCycles = await prisma.cycle.findMany({
    orderBy: { created_at: 'desc' },
    select: { id: true, name: true, status: true },
  })

  const lockedCycleIds = allCycles
    .filter(c => ['locked', 'published'].includes(c.status))
    .map(c => c.id)

  // Fetch appraisals scoped to HRBP's departments
  const appraisals = lockedCycleIds.length > 0
    ? await prisma.appraisal.findMany({
        where: {
          cycle_id: { in: lockedCycleIds },
          locked_at: { not: null },
          ...(deptIds.length > 0 ? { employee: { department_id: { in: deptIds } } } : {}),
        },
        select: {
          cycle_id: true,
          final_rating: true,
          payout_multiplier: true,
          payout_amount: true,
          snapshotted_variable_pay: true,
          employee: {
            select: {
              full_name: true,
              department: { select: { name: true } },
            },
          },
        },
      })
    : []

  const payoutsByCycle: Record<string, Array<{
    employeeName: string
    department: string
    finalRating: string | null
    variablePay: number
    multiplier: number
    payoutAmount: number
  }>> = {}

  for (const a of appraisals) {
    if (!payoutsByCycle[a.cycle_id]) payoutsByCycle[a.cycle_id] = []
    payoutsByCycle[a.cycle_id].push({
      employeeName: a.employee?.full_name ?? 'Unknown',
      department: a.employee?.department?.name ?? '—',
      finalRating: a.final_rating,
      variablePay: Number(a.snapshotted_variable_pay ?? 0),
      multiplier: Number(a.payout_multiplier ?? 0),
      payoutAmount: Number(a.payout_amount ?? 0),
    })
  }

  const cycles = allCycles.map(c => {
    const rows = payoutsByCycle[c.id] ?? []
    const totalPayout = rows.reduce((s, r) => s + r.payoutAmount, 0)
    const avgMultiplier = rows.length > 0
      ? rows.reduce((s, r) => s + r.multiplier, 0) / rows.length
      : 0
    return {
      id: c.id,
      name: c.name,
      status: c.status,
      employeeCount: rows.length,
      totalPayout,
      avgMultiplier,
    }
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Payouts</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Cycle-wise payout summary for your departments
        </p>
      </div>
      <PayoutDashboard cycles={cycles} payoutsByCycle={payoutsByCycle} />
    </div>
  )
}
