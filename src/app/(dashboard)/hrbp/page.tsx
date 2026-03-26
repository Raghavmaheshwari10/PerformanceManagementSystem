import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { CycleStatusBadge } from '@/components/cycle-status-badge'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { Cycle } from '@/lib/types'

function daysUntil(dateStr: string | Date | null): number | null {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000)
}

interface CycleWithDepts extends Cycle {
  departments: { department_id: string; department: { id: string; name: string } }[]
}

function DepartmentScopeBadges({ departments }: { departments: CycleWithDepts['departments'] }) {
  if (departments.length === 0) {
    return <span className="bg-white/10 text-white/60 text-xs px-2 py-0.5 rounded-full">Org-wide</span>
  }
  return (
    <div className="flex flex-wrap gap-1">
      {departments.map(d => (
        <span key={d.department_id} className="bg-primary/15 text-primary text-xs px-2 py-0.5 rounded-full">
          {d.department.name}
        </span>
      ))}
    </div>
  )
}

function CycleCard({ cycle, overdueCount }: { cycle: CycleWithDepts; overdueCount?: number }) {
  const deadline = cycle.status === 'manager_review'
    ? cycle.manager_review_deadline
    : cycle.status === 'self_review'
    ? cycle.self_review_deadline
    : cycle.status === 'kpi_setting'
    ? cycle.kpi_setting_deadline
    : null

  const days = daysUntil(deadline as string | null)
  const isOverdue = days !== null && days < 0

  return (
    <div className={cn(
      'flex items-center justify-between glass p-4',
      isOverdue && 'glass-glow border-destructive/40 bg-destructive/5'
    )}>
      <div className="space-y-1">
        <p className="font-medium">{cycle.name}</p>
        <p className="text-sm text-muted-foreground">{cycle.quarter} {cycle.year}</p>
        <div className="flex flex-wrap items-center gap-2">
          <CycleStatusBadge status={cycle.status} />
          <DepartmentScopeBadges departments={cycle.departments} />
        </div>
        {isOverdue && deadline && (
          <p className="text-xs text-destructive font-medium">
            Deadline was {Math.abs(days!)} day{Math.abs(days!) !== 1 ? 's' : ''} ago
          </p>
        )}
        {!isOverdue && days !== null && days <= 3 && (
          <p className="text-xs text-amber-600 font-medium">
            {days === 0 ? 'Due today' : `Due in ${days} day${days !== 1 ? 's' : ''}`}
          </p>
        )}
      </div>
      <div className="flex flex-col items-end gap-2">
        {overdueCount != null && overdueCount > 0 && (
          <span className="rounded-full bg-destructive px-2 py-0.5 text-xs font-bold text-destructive-foreground">
            {overdueCount} overdue
          </span>
        )}
        {['calibrating', 'locked'].includes(cycle.status) && (
          <Link href={`/hrbp/calibration?cycle=${cycle.id}`} className="text-primary hover:text-primary/80 text-sm">
            Calibrate
          </Link>
        )}
      </div>
    </div>
  )
}

export default async function HrbpPage() {
  await requireRole(['hrbp'])

  const allCyclesRaw = await prisma.cycle.findMany({
    orderBy: { created_at: 'desc' },
    include: { departments: { include: { department: true } } },
  })
  const allCycles = allCyclesRaw as unknown as CycleWithDepts[]

  const active = allCycles.filter(c => c.status !== 'published')
  const published = allCycles.filter(c => c.status === 'published')

  // Count overdue reviews for active manager_review cycles
  const managerReviewCycles = active.filter(c => c.status === 'manager_review')
  const overdueMap = new Map<string, number>()
  if (managerReviewCycles.length > 0) {
    for (const cycle of managerReviewCycles) {
      const days = daysUntil(cycle.manager_review_deadline as string | null)
      if (days !== null && days < 0) {
        const count = await prisma.appraisal.count({
          where: { cycle_id: cycle.id, manager_submitted_at: null },
        })
        overdueMap.set(cycle.id, count)
      }
    }
  }

  const totalOverdue = Array.from(overdueMap.values()).reduce((s, n) => s + n, 0)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Review Cycles</h1>

      {/* Overdue alert bar */}
      {totalOverdue > 0 && (
        <div className="glass border-destructive/40 px-4 py-3">
          <p className="text-sm font-semibold text-destructive">
            {totalOverdue} manager review{totalOverdue !== 1 ? 's' : ''} overdue across active cycles
          </p>
        </div>
      )}

      {allCycles.length === 0 && (
        <p className="text-muted-foreground">No cycles yet.</p>
      )}

      {active.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Active</h2>
          <div className="grid gap-3">
            {active.map(cycle => (
              <CycleCard key={cycle.id} cycle={cycle} overdueCount={overdueMap.get(cycle.id)} />
            ))}
          </div>
        </section>
      )}

      {published.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Published</h2>
          <div className="grid gap-3">
            {published.map(cycle => <CycleCard key={cycle.id} cycle={cycle} />)}
          </div>
        </section>
      )}
    </div>
  )
}
