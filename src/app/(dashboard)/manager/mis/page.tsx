import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import Link from 'next/link'

function ragBadge(achievement: number, red: number, amber: number) {
  if (achievement >= amber) return <span className="inline-block rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-400">On Track</span>
  if (achievement >= red) return <span className="inline-block rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-400">At Risk</span>
  return <span className="inline-block rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-medium text-red-400">Off Track</span>
}

export default async function ManagerMisPage(props: {
  searchParams: Promise<{ month?: string }>
}) {
  const user = await requireRole(['manager'])
  const searchParams = await props.searchParams
  const currentMonth = searchParams.month ? Number(searchParams.month) : new Date().getMonth() + 1

  // Fetch direct reports
  const directReports = await prisma.user.findMany({
    where: { manager_id: user.id, is_active: true },
    select: { id: true, full_name: true, designation: true },
    orderBy: { full_name: 'asc' },
  })

  // Fetch AOP targets for all direct reports
  const employeeIds = directReports.map(r => r.id)
  const targets = await prisma.aopTarget.findMany({
    where: { employee_id: { in: employeeIds } },
    include: {
      actuals: {
        where: { month: { lte: currentMonth } },
        orderBy: { month: 'desc' },
      },
    },
  })

  // Group targets by employee
  const targetsByEmployee = new Map<string, typeof targets>()
  for (const t of targets) {
    if (!t.employee_id) continue
    if (!targetsByEmployee.has(t.employee_id)) targetsByEmployee.set(t.employee_id, [])
    targetsByEmployee.get(t.employee_id)!.push(t)
  }

  // Summary stats
  let totalAchievement = 0
  let totalMetrics = 0
  let atRiskCount = 0
  let onTrackCount = 0

  for (const empTargets of targetsByEmployee.values()) {
    for (const t of empTargets) {
      const annual = Number(t.annual_target)
      const ytd = Number(t.ytd_actual ?? 0)
      const ach = annual > 0 ? (ytd / annual) * 100 : 0
      totalAchievement += ach
      totalMetrics++
      if (ach >= Number(t.amber_threshold)) onTrackCount++
      else atRiskCount++
    }
  }

  const avgAchievement = totalMetrics > 0 ? totalAchievement / totalMetrics : 0

  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Team MIS Performance</h1>
        <p className="text-sm text-muted-foreground mt-1">
          AOP target achievement for your direct reports
        </p>
      </div>

      {/* Month Picker */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-muted-foreground">Month:</label>
        <div className="flex gap-1 flex-wrap">
          {months.map((m, idx) => (
            <Link
              key={idx}
              href={`/manager/mis?month=${idx + 1}`}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                currentMonth === idx + 1 ? 'bg-primary/20 text-primary' : 'glass-interactive'
              }`}
            >
              {m}
            </Link>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="glass rounded-xl p-4">
          <p className="text-xs font-medium text-muted-foreground">Team Avg Achievement</p>
          <p className="mt-1 text-lg font-semibold">{avgAchievement.toFixed(1)}%</p>
        </div>
        <div className="glass rounded-xl p-4">
          <p className="text-xs font-medium text-muted-foreground">On Track</p>
          <p className="mt-1 text-lg font-semibold text-emerald-400">{onTrackCount}</p>
        </div>
        <div className="glass rounded-xl p-4">
          <p className="text-xs font-medium text-muted-foreground">At Risk / Off Track</p>
          <p className={`mt-1 text-lg font-semibold ${atRiskCount > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
            {atRiskCount}
          </p>
        </div>
      </div>

      {/* Per-employee tables */}
      {directReports.length === 0 ? (
        <p className="text-muted-foreground">No direct reports found.</p>
      ) : (
        <div className="space-y-4">
          {directReports.map(emp => {
            const empTargets = targetsByEmployee.get(emp.id) ?? []
            return (
              <details key={emp.id} className="glass rounded-xl" open={empTargets.length > 0}>
                <summary className="cursor-pointer p-4 flex items-center justify-between">
                  <div>
                    <span className="font-semibold">{emp.full_name}</span>
                    {emp.designation && (
                      <span className="ml-2 text-xs text-muted-foreground">{emp.designation}</span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">{empTargets.length} metrics</span>
                </summary>
                {empTargets.length === 0 ? (
                  <p className="px-4 pb-4 text-sm text-muted-foreground italic">No AOP targets assigned</p>
                ) : (
                  <div className="overflow-hidden border-t border-border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/30">
                          <th className="p-3 text-left text-muted-foreground">Metric</th>
                          <th className="p-3 text-right text-muted-foreground">Annual Target</th>
                          <th className="p-3 text-right text-muted-foreground">YTD Actual</th>
                          <th className="p-3 text-right text-muted-foreground">Achievement</th>
                          <th className="p-3 text-center text-muted-foreground">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {empTargets.map(t => {
                          const annual = Number(t.annual_target)
                          const ytd = Number(t.ytd_actual ?? 0)
                          const ach = annual > 0 ? (ytd / annual) * 100 : 0
                          return (
                            <tr key={t.id} className="border-b border-border">
                              <td className="p-3 font-medium">{t.metric_name}</td>
                              <td className="p-3 text-right">{annual.toLocaleString('en-IN')} {t.unit}</td>
                              <td className="p-3 text-right">{ytd.toLocaleString('en-IN')}</td>
                              <td className="p-3 text-right">{ach.toFixed(1)}%</td>
                              <td className="p-3 text-center">
                                {ragBadge(ach, Number(t.red_threshold), Number(t.amber_threshold))}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </details>
            )
          })}
        </div>
      )}
    </div>
  )
}
