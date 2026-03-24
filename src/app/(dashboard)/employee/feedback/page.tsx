import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { FeedbackForm } from './feedback-form'

const CATEGORY_LABELS: Record<string, string> = {
  teamwork: 'Teamwork', leadership: 'Leadership', ownership: 'Ownership',
  communication: 'Communication', innovation: 'Innovation',
}

export default async function FeedbackPage() {
  const user = await requireRole(['employee', 'manager', 'hrbp'])

  const [received, colleagues] = await Promise.all([
    prisma.feedback.findMany({
      where: {
        to_user_id: user.id,
        visibility: { in: ['recipient_and_manager', 'public_team'] },
      },
      include: { from_user: { select: { full_name: true } } },
      orderBy: { created_at: 'desc' },
      take: 20,
    }),
    prisma.user.findMany({
      where: { is_active: true, id: { not: user.id } },
      select: { id: true, full_name: true },
      orderBy: { full_name: 'asc' },
    }),
  ])

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Feedback</h1>

      <section className="rounded border p-4 space-y-4">
        <h2 className="text-lg font-semibold">Give Feedback</h2>
        <FeedbackForm colleagues={colleagues} />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Received</h2>
        {received.length === 0 ? (
          <p className="text-sm text-muted-foreground">No feedback received yet.</p>
        ) : (
          <div className="space-y-3">
            {received.map(fb => (
              <div key={fb.id} className="rounded border p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium bg-muted rounded-full px-2 py-0.5">
                    {CATEGORY_LABELS[fb.category] ?? fb.category}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(fb.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm">{fb.message}</p>
                <p className="text-xs text-muted-foreground">— {fb.from_user?.full_name ?? 'Anonymous'}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
