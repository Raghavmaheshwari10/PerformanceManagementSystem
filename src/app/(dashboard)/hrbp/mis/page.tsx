import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { UNIT_LABELS } from '@/lib/constants'
import Link from 'next/link'

function ragBadge(achievement: number, red: number, amber: number) {
  if (achievement >= amber) return <span className="inline-block rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-400">Green</span>
  if (achievement >= red) return <span className="inline-block rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-400">Amber</span>
  return <span className="inline-block rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-medium text-red-400">Red</span>
}

export default async function HrbpMisPage(props: {
  searchParams: Promise<{ month?: string }>
}) {
  const user = await requireRole(['hrbp'])
  const searchParams = await props.searchParams
  const currentMonth = searchParams.month ? Number(searchParams.month) : new Date().getMonth() + 1

  // Get HRBP's departments
  const hrbpDepts = await prisma.hrbpDepartment.findMany({
    where: { hrbp_id: user.id },
    include: { department: true },
  })
  const departmentIds = hrbpDepts.map(d => d.department_id)

  if (departmentIds.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Department MIS Performance</h1>
        <p className="text-muted-foreground">No departments assigned to you.</p>
      </div>
    )
  }

  // Fetch department-level + individual targets for those departments
  const targets = await prisma.aopTarget.findMany({
    where: {
      OR: [
        { department_id: { in: departmentIds }, level: 'department' },
        { employee: { department_id: { in: departmentIds } }, level: 'individual' },
      ],
    },
    include: {
      department: { select: { id: true, name: true } },
      employee: { select: { id: true, full_name: true, department_id: true } },
    },
    orderBy: { metric_name: 'asc' },
  })

  // Group by department
  const deptMap = new Map<string, { name: string; deptTargets: typeof targets; empTargets: Map<string, { name: string; targets: typeof targets }> }>()

  for (const dept of hrbpDepts) {
    deptMap.set(dept.department_id, {
      name: dept.department.name,
      deptTargets: [],
      empTargets: new Map(),
    })
  }

  for (const t of targets) {
    const deptId = t.level === 'department' ? t.department_id : t.employee?.department_id
    if (!deptId || !deptMap.has(deptId)) continue
    const bucket = deptMap.get(deptId)!

    if (t.level === 'department') {
      bucket.deptTargets.push(t)
    } else if (t.employee) {
      if (!bucket.empTargets.has(t.employee.id)) {
        bucket.empTargets.set(t.employee.id, { name: t.employee.full_name, targets: [] })
      }
      bucket.empTargets.get(t.employee.id)!.targets.push(t)
    }
  }

  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Department MIS Performance</h1>
        <p className="text-sm text-muted-foreground mt-1">
          AOP target achievement across your assigned departments
        </p>
      </div>

      {/* Month Picker */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-muted-foreground">Month:</label>
        <div className="flex gap-1 flex-wrap">
          {months.map((m, idx) => (
            <Link
              key={idx}
              href={`/hrbp/mis?month=${idx + 1}`}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                currentMonth === idx + 1 ? 'bg-primary/20 text-primary' : 'glass-interactive'
              }`}
            >
              {m}
            </Link>
          ))}
        </div>
      </div>

      {/* Per-department sections */}
      {Array.from(deptMap.entries()).map(([deptId, { name, deptTargets, empTargets }]) => {
        // Department-level summary
        let deptTotalAch = 0
        let deptMetricCount = 0
        for (const t of deptTargets) {
          const annual = Number(t.annual_target)
          const ytd = Number(t.ytd_actual ?? 0)
          if (annual > 0) { deptTotalAch += (ytd / annual) * 100; deptMetricCount++ }
        }
        const deptAvg = deptMetricCount > 0 ? deptTotalAch / deptMetricCount : 0

        return (
          <div key={deptId} className="space-y-4">
            <h2 className="text-lg font-semibold">{name}</h2>

            {/* Department-level metrics cards */}
            {deptTargets.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {deptTargets.map(t => {
                  const annual = Number(t.annual_target)
                  const ytd = Number(t.ytd_actual ?? 0)
                  const ach = annual > 0 ? (ytd / annual) * 100 : 0
                  return (
                    <div key={t.id} className="glass rounded-xl p-4 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-medium text-muted-foreground">{t.metric_name}</p>
                        {ragBadge(ach, Number(t.red_threshold), Number(t.amber_threshold))}
                      </div>
                      <p className="text-lg font-semibold">{ytd.toLocaleString('en-IN')} <span className="text-sm text-muted-foreground">/ {annual.toLocaleString('en-IN')} {UNIT_LABELS[t.unit] ?? t.unit}</span></p>
                      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            ach >= Number(t.amber_threshold) ? 'bg-emerald-500' : ach >= Number(t.red_threshold) ? 'bg-amber-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${Math.min(ach, 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground text-right">{ach.toFixed(1)}%</p>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Employee breakdown */}
            {empTargets.size > 0 && (
              <div className="glass overflow-hidden rounded-xl">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/8 bg-white/[0.03]">
                      <th className="p-3 text-left text-white/50">Employee</th>
                      <th className="p-3 text-left text-white/50">Metric</th>
                      <th className="p-3 text-right text-white/50">Annual Target</th>
                      <th className="p-3 text-right text-white/50">YTD Actual</th>
                      <th className="p-3 text-right text-white/50">Achievement</th>
                      <th className="p-3 text-center text-white/50">RAG</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from(empTargets.entries()).flatMap(([empId, { name: empName, targets: empTs }]) =>
                      empTs.map((t, idx) => {
                        const annual = Number(t.annual_target)
                        const ytd = Number(t.ytd_actual ?? 0)
                        const ach = annual > 0 ? (ytd / annual) * 100 : 0
                        return (
                          <tr key={t.id} className="border-b border-white/5">
                            <td className="p-3 font-medium">{idx === 0 ? empName : ''}</td>
                            <td className="p-3 text-white/70">{t.metric_name}</td>
                            <td className="p-3 text-right">{annual.toLocaleString('en-IN')} {UNIT_LABELS[t.unit] ?? t.unit}</td>
                            <td className="p-3 text-right">{ytd.toLocaleString('en-IN')}</td>
                            <td className="p-3 text-right">{ach.toFixed(1)}%</td>
                            <td className="p-3 text-center">
                              {ragBadge(ach, Number(t.red_threshold), Number(t.amber_threshold))}
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {deptTargets.length === 0 && empTargets.size === 0 && (
              <p className="text-sm text-muted-foreground italic">No AOP targets for this department</p>
            )}
          </div>
        )
      })}
    </div>
  )
}
