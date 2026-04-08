import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'

export async function PipBanner() {
  const user = await getCurrentUser()

  let activePip
  try {
    activePip = await prisma.pip.findFirst({
      where: {
        employee_id: user.id,
        status: { in: ['active', 'extended'] },
      },
      include: {
        milestones: {
          select: { status: true },
        },
      },
      orderBy: { created_at: 'desc' },
    })
  } catch {
    return null // pip table may not exist yet
  }

  if (!activePip) return null

  const totalMilestones = activePip.milestones.length
  const completedMilestones = activePip.milestones.filter(m => m.status === 'completed').length
  const daysRemaining = Math.max(0, Math.ceil((activePip.end_date.getTime() - Date.now()) / 86400000))
  const isAcknowledged = activePip.employee_acknowledged_at != null

  return (
    <div className="glass rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 mb-6">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-amber-300">Performance Improvement Plan</h3>
            <span className="text-xs text-muted-foreground">
              {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} remaining
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            You are currently on a Performance Improvement Plan.
            {totalMilestones > 0 && (
              <span> Progress: {completedMilestones}/{totalMilestones} milestones completed.</span>
            )}
          </p>
          {totalMilestones > 0 && (
            <div className="w-full bg-muted/30 rounded-full h-1.5">
              <div
                className="bg-amber-400 h-1.5 rounded-full transition-all"
                style={{ width: `${totalMilestones > 0 ? (completedMilestones / totalMilestones) * 100 : 0}%` }}
              />
            </div>
          )}
          <div className="flex items-center gap-3 pt-1">
            {!isAcknowledged && (
              <span className="text-xs text-amber-400 font-medium">Acknowledgment required</span>
            )}
            {isAcknowledged && (
              <span className="flex items-center gap-1 text-xs text-emerald-400">
                <CheckCircle2 className="h-3 w-3" /> Acknowledged
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
