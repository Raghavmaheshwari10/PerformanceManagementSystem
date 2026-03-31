import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { HistoryRows } from './history-rows'

const RATING_ORDER: Record<string, number> = { FEE: 5, EE: 4, ME: 3, SME: 2, BE: 1 }

export default async function EmployeeHistoryPage() {
  const user = await requireRole(['employee'])

  const [appraisals, reviews] = await Promise.all([
    prisma.appraisal.findMany({
      where: { employee_id: user.id },
      orderBy: { created_at: 'desc' },
      include: { cycle: true },
    }),
    prisma.review.findMany({
      where: { employee_id: user.id },
      select: { cycle_id: true, self_rating: true, self_comments: true },
    }),
  ])

  const published = appraisals
    .filter(a => a.cycle?.status === 'published')
    .sort((a, b) => {
      const dateA = a.cycle?.published_at?.toISOString() ?? ''
      const dateB = b.cycle?.published_at?.toISOString() ?? ''
      return dateB.localeCompare(dateA)
    })

  const selfReviewMap = new Map(
    reviews.map(r => [r.cycle_id, { rating: r.self_rating, comments: r.self_comments }])
  )

  // Annotate each appraisal with trend vs previous cycle
  // Map `cycle` → `cycles` to match HistoryRows' AppraisalWithCycle shape (legacy naming)
  const enriched = published.map((a, i) => {
    const prevRating = published[i + 1]?.final_rating
    const currScore = a.final_rating ? RATING_ORDER[a.final_rating] ?? 0 : 0
    const prevScore = prevRating ? RATING_ORDER[prevRating] ?? 0 : 0
    const trend: 'up' | 'down' | 'same' | null = prevRating
      ? currScore > prevScore ? 'up' : currScore < prevScore ? 'down' : 'same'
      : null
    return {
      appraisal: { ...a, cycles: a.cycle },
      selfReview: selfReviewMap.get(a.cycle_id) ?? null,
      trend,
    }
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Review History</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {published.length === 0
            ? 'No published reviews yet.'
            : `${published.length} published cycle${published.length !== 1 ? 's' : ''}`}
        </p>
      </div>

      {published.length === 0 ? (
        <p className="glass border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Your results will appear here once a review cycle is published.
        </p>
      ) : (
        <HistoryRows rows={enriched as unknown as Parameters<typeof HistoryRows>[0]['rows']} />
      )}
    </div>
  )
}
