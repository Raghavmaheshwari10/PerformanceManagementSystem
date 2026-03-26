import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

const TIER_LABELS: Record<string, string> = {
  FEE: 'Outstanding',
  EE: 'Exceeds Expectations',
  ME: 'Meets Expectations',
  SME: 'Below Expectations',
  BE: 'Unsatisfactory',
}

const TIER_COLORS: Record<string, string> = {
  FEE: 'bg-emerald-500',
  EE: 'bg-green-400',
  ME: 'bg-blue-400',
  SME: 'bg-amber-400',
  BE: 'bg-red-400',
}

const TIER_DELAYS: Record<string, string> = {
  FEE: '0s',
  EE: '0.1s',
  ME: '0.2s',
  SME: '0.3s',
  BE: '0.4s',
}

export default async function HrReportsPage() {
  await requireRole(['hrbp', 'admin'])

  const [cycles, departments, totalActive] = await Promise.all([
    prisma.cycle.findMany({ orderBy: { created_at: 'desc' }, take: 5 }),
    prisma.department.findMany({
      include: { users: { where: { is_active: true, role: 'employee' }, select: { id: true } } },
      orderBy: { name: 'asc' },
    }),
    prisma.user.count({ where: { is_active: true, role: 'employee' } }),
  ])

  // Build stats per cycle
  const cycleStats = await Promise.all(
    cycles.map(async cycle => {
      const [submittedReviews, completedAppraisals, ratingGroups] = await Promise.all([
        prisma.review.count({ where: { cycle_id: cycle.id, status: 'submitted' } }),
        prisma.appraisal.count({ where: { cycle_id: cycle.id, manager_submitted_at: { not: null } } }),
        prisma.appraisal.groupBy({
          by: ['final_rating'],
          where: { cycle_id: cycle.id, final_rating: { not: null } },
          _count: { final_rating: true },
        }),
      ])

      const selfReviewRate = totalActive > 0 ? Math.round((submittedReviews / totalActive) * 100) : 0
      const managerReviewRate = totalActive > 0 ? Math.round((completedAppraisals / totalActive) * 100) : 0
      const totalRated = ratingGroups.reduce((s, r) => s + r._count.final_rating, 0)

      return {
        cycle,
        submittedReviews,
        completedAppraisals,
        selfReviewRate,
        managerReviewRate,
        ratingGroups,
        totalRated,
      }
    })
  )

  const maxDeptSize = Math.max(...departments.map(d => d.users.length), 1)

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">HR Reports</h1>
        <p className="text-sm text-muted-foreground">{totalActive} active employees</p>
      </div>

      {cycles.length === 0 && <p className="text-muted-foreground">No cycles yet.</p>}

      {cycleStats.map(({ cycle, selfReviewRate, managerReviewRate, ratingGroups, totalRated }) => (
        <section key={cycle.id} className="glass p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">{cycle.name}</h2>
              <p className="text-xs text-muted-foreground capitalize">{cycle.quarter} {cycle.year} · {cycle.status}</p>
            </div>
          </div>

          <div className="gradient-divider" />

          {/* Completion stats */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="glass p-4 text-center">
              <p
                className="text-3xl font-extrabold tabular-nums"
                style={{ animation: 'countUp 0.5s ease-out both' }}
              >
                {selfReviewRate}%
              </p>
              <p className="text-xs text-muted-foreground mt-1">Self Reviews</p>
            </div>
            <div className="glass p-4 text-center">
              <p
                className="text-3xl font-extrabold tabular-nums"
                style={{ animation: 'countUp 0.5s ease-out both', animationDelay: '0.1s' }}
              >
                {managerReviewRate}%
              </p>
              <p className="text-xs text-muted-foreground mt-1">Manager Reviews</p>
            </div>
            <div className="glass p-4 text-center">
              <p
                className="text-3xl font-extrabold tabular-nums"
                style={{ animation: 'countUp 0.5s ease-out both', animationDelay: '0.2s' }}
              >
                {totalRated}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Ratings Complete</p>
            </div>
            <div className="glass p-4 text-center">
              <p
                className="text-3xl font-extrabold tabular-nums"
                style={{ animation: 'countUp 0.5s ease-out both', animationDelay: '0.3s' }}
              >
                {totalActive}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Active Employees</p>
            </div>
          </div>

          {/* Rating distribution bar chart */}
          {ratingGroups.length > 0 ? (
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Rating Distribution</h3>
              <div className="space-y-2">
                {(['FEE', 'EE', 'ME', 'SME', 'BE'] as const).map(tier => {
                  const count = ratingGroups.find(r => r.final_rating === tier)?._count.final_rating ?? 0
                  const pct = totalRated > 0 ? Math.round((count / totalRated) * 100) : 0
                  return (
                    <div key={tier} className="flex items-center gap-3 text-xs">
                      <span className="w-36 text-right shrink-0 text-muted-foreground">{TIER_LABELS[tier]}</span>
                      <div className="flex-1 h-5 rounded bg-white/5 overflow-hidden">
                        <div
                          className={`h-full rounded ${TIER_COLORS[tier]}`}
                          style={{
                            width: `${pct}%`,
                            animation: 'barGrow 1s cubic-bezier(0.16, 1, 0.3, 1) both',
                            animationDelay: TIER_DELAYS[tier],
                          }}
                        />
                      </div>
                      <span className="w-12 shrink-0 font-medium">{count} ({pct}%)</span>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No final ratings yet for this cycle.</p>
          )}
        </section>
      ))}

      {/* Department breakdown */}
      <section className="glass p-6 space-y-3">
        <h2 className="text-lg font-semibold">Department Overview</h2>
        <div className="gradient-divider" />
        {departments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No departments.</p>
        ) : (
          <div className="space-y-2">
            {departments.map((dept, i) => {
              const barWidth = Math.round((dept.users.length / maxDeptSize) * 100)
              return (
                <div key={dept.id} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{dept.name}</span>
                    <span className="text-muted-foreground">{dept.users.length} employee{dept.users.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="h-2 rounded bg-white/5 overflow-hidden">
                    <div
                      className="h-full rounded bg-primary/40"
                      style={{
                        width: `${barWidth}%`,
                        animation: 'barGrow 1s cubic-bezier(0.16, 1, 0.3, 1) both',
                        animationDelay: `${i * 0.08}s`,
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
