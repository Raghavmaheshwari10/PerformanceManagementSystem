import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { CycleStatusBadge } from '@/components/cycle-status-badge'
import { submitSelfReview, saveDraftReview } from './actions'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RATING_TIERS } from '@/lib/constants'
import type { Cycle, Kpi, Review, Appraisal } from '@/lib/types'

export default async function EmployeeReviewPage() {
  const user = await requireRole(['employee'])
  const supabase = await createClient()

  const { data: cycles } = await supabase
    .from('cycles').select('*')
    .neq('status', 'draft')
    .order('created_at', { ascending: false }).limit(1)
  const cycle = (cycles as Cycle[])?.[0]

  if (!cycle) return <p className="text-muted-foreground">No active review cycle.</p>

  const [kpiRes, reviewRes, appraisalRes] = await Promise.all([
    supabase.from('kpis').select('*').eq('cycle_id', cycle.id).eq('employee_id', user.id),
    supabase.from('reviews').select('*').eq('cycle_id', cycle.id).eq('employee_id', user.id).single(),
    supabase.from('appraisals').select('*').eq('cycle_id', cycle.id).eq('employee_id', user.id).single(),
  ])

  const kpis = kpiRes.data as Kpi[] ?? []
  const review = reviewRes.data as Review | null
  const appraisal = appraisalRes.data as Appraisal | null
  const isSelfReview = cycle.status === 'self_review'
  const isPublished = cycle.status === 'published'

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">My Review — {cycle.name}</h1>
        <CycleStatusBadge status={cycle.status} />
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">My KPIs</h2>
        {kpis.length === 0 && <p className="text-muted-foreground">No KPIs assigned yet.</p>}
        {kpis.map(kpi => (
          <div key={kpi.id} className="rounded border p-3">
            <p className="font-medium">{kpi.title}</p>
            {kpi.description && <p className="text-sm text-muted-foreground">{kpi.description}</p>}
            <p className="text-sm">Weight: {kpi.weight}%</p>
          </div>
        ))}
      </section>

      {isSelfReview && review?.status !== 'submitted' && (
        <section className="space-y-4 rounded border p-4">
          <h2 className="text-lg font-semibold">Self Assessment</h2>
          <form className="space-y-4">
            <input type="hidden" name="cycle_id" value={cycle.id} />
            <div className="space-y-2">
              <Label htmlFor="self_rating">Self Rating</Label>
              <select id="self_rating" name="self_rating" className="w-full rounded border p-2" defaultValue={review?.self_rating ?? ''}>
                <option value="">Select...</option>
                {RATING_TIERS.map(t => <option key={t.code} value={t.code}>{t.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="self_comments">Comments</Label>
              <Textarea id="self_comments" name="self_comments" rows={5} defaultValue={review?.self_comments ?? ''} required />
            </div>
            <div className="flex gap-2">
              <Button formAction={saveDraftReview} variant="outline">Save Draft</Button>
              <Button formAction={submitSelfReview}>Submit</Button>
            </div>
          </form>
        </section>
      )}

      {review?.status === 'submitted' && !isPublished && (
        <p className="text-green-600 font-medium">Self assessment submitted.</p>
      )}

      {isPublished && appraisal && (
        <section className="rounded border bg-muted/30 p-4 space-y-2">
          <h2 className="text-lg font-semibold">Final Result</h2>
          <p>Final Rating: <span className="font-bold">{appraisal.final_rating}</span></p>
          <p>Payout Multiplier: <span className="font-bold">{appraisal.payout_multiplier ? `${(appraisal.payout_multiplier * 100).toFixed(0)}%` : 'N/A'}</span></p>
        </section>
      )}
    </div>
  )
}
