import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { PeerRequestForm } from './peer-request-form'
import { PeerReviewSubmitForm } from './peer-review-submit-form'

export default async function PeerReviewsPage() {
  const user = await requireRole(['employee', 'manager', 'hrbp'])

  const cycle = await prisma.cycle.findFirst({
    where: { status: { not: 'draft' } },
    orderBy: { created_at: 'desc' },
  })

  const [myRequests, pendingForMe, colleagues] = await Promise.all([
    cycle ? prisma.peerReviewRequest.findMany({
      where: { cycle_id: cycle.id, reviewee_id: user.id },
      include: { peer_user: { select: { full_name: true } } },
      orderBy: { created_at: 'desc' },
    }) : Promise.resolve([]),
    cycle ? prisma.peerReviewRequest.findMany({
      where: { cycle_id: cycle.id, peer_user_id: user.id, status: { not: 'submitted' } },
      include: { reviewee: { select: { full_name: true } } },
    }) : Promise.resolve([]),
    prisma.user.findMany({
      where: { is_active: true, id: { not: user.id } },
      select: { id: true, full_name: true },
      orderBy: { full_name: 'asc' },
    }),
  ])

  const STATUS_COLORS: Record<string, string> = {
    requested: 'bg-blue-100 text-blue-700',
    accepted: 'bg-green-100 text-green-700',
    declined: 'bg-red-100 text-red-700',
    submitted: 'bg-emerald-100 text-emerald-700',
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Peer Reviews</h1>

      {pendingForMe.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">
            Pending Reviews to Submit
            <span className="ml-2 text-sm font-normal text-muted-foreground">({pendingForMe.length})</span>
          </h2>
          {pendingForMe.map(req => (
            <PeerReviewSubmitForm key={req.id} request={req as unknown as import('@/lib/types').PeerReviewRequest & { reviewee: { full_name: string } }} />
          ))}
        </section>
      )}

      {cycle && (
        <section className="rounded border p-4 space-y-4">
          <h2 className="text-lg font-semibold">Request a Peer Reviewer</h2>
          <PeerRequestForm cycleId={cycle.id} colleagues={colleagues} />
        </section>
      )}

      {myRequests.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">My Peer Requests</h2>
          <div className="space-y-2">
            {myRequests.map(req => (
              <div key={req.id} className="rounded border p-3 flex justify-between items-center text-sm">
                <span>{req.peer_user?.full_name ?? 'Unknown'}</span>
                <span className={`text-xs rounded-full px-2 py-0.5 capitalize ${STATUS_COLORS[req.status] ?? 'bg-muted'}`}>
                  {req.status}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {!cycle && <p className="text-muted-foreground">No active review cycle.</p>}
    </div>
  )
}
