import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { HistoryRows } from './history-rows'
import type { Appraisal, Cycle } from '@/lib/types'

interface AppraisalWithCycle extends Appraisal {
  cycles: Cycle
}

const RATING_ORDER: Record<string, number> = { FEE: 5, EE: 4, ME: 3, SME: 2, BE: 1 }

export default async function EmployeeHistoryPage() {
  const user = await requireRole(["employee"])
  const supabase = await createClient()

  const [appraisalsRes, reviewsRes] = await Promise.all([
    supabase.from("appraisals").select("*, cycles(*)").eq("employee_id", user.id).order("created_at", { ascending: false }),
    supabase.from("reviews").select("cycle_id, self_rating, self_comments").eq("employee_id", user.id),
  ])

  const published = ((appraisalsRes.data ?? []) as unknown as AppraisalWithCycle[])
    .filter(a => a.cycles?.status === "published")
    .sort((a, b) => {
      const dateA = a.cycles.published_at ?? ""
      const dateB = b.cycles.published_at ?? ""
      return dateB.localeCompare(dateA)
    })

  const selfReviewMap = new Map(
    (reviewsRes.data ?? []).map(r => [r.cycle_id, { rating: r.self_rating, comments: r.self_comments }])
  )

  // Annotate each appraisal with trend vs previous cycle
  const enriched = published.map((a, i) => {
    const prevRating = published[i + 1]?.final_rating
    const currScore = a.final_rating ? RATING_ORDER[a.final_rating] ?? 0 : 0
    const prevScore = prevRating ? RATING_ORDER[prevRating] ?? 0 : 0
    const trend: "up" | "down" | "same" | null = prevRating
      ? currScore > prevScore ? "up" : currScore < prevScore ? "down" : "same"
      : null
    return {
      appraisal: a,
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
            ? "No published reviews yet."
            : `${published.length} published cycle${published.length !== 1 ? 's' : ''}`}
        </p>
      </div>

      {published.length === 0 ? (
        <p className="rounded border border-dashed p-8 text-center text-sm text-muted-foreground">
          Your results will appear here once a review cycle is published.
        </p>
      ) : (
        <HistoryRows rows={enriched} />
      )}
    </div>
  )
}
