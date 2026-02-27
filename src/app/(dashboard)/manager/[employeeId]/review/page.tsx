import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { submitManagerRating } from '../../actions'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RATING_TIERS } from '@/lib/constants'
import type { User, Kpi, Review, Appraisal } from '@/lib/types'

export default async function ManagerReviewPage({
  params, searchParams,
}: {
  params: Promise<{ employeeId: string }>
  searchParams: Promise<{ cycle?: string }>
}) {
  await requireRole(['manager'])
  const { employeeId } = await params
  const { cycle: cycleId } = await searchParams
  const supabase = await createClient()

  const [empRes, kpiRes, reviewRes, appraisalRes] = await Promise.all([
    supabase.from('users').select('*').eq('id', employeeId).single(),
    supabase.from('kpis').select('*').eq('cycle_id', cycleId).eq('employee_id', employeeId),
    supabase.from('reviews').select('*').eq('cycle_id', cycleId).eq('employee_id', employeeId).single(),
    supabase.from('appraisals').select('*').eq('cycle_id', cycleId).eq('employee_id', employeeId).single(),
  ])

  const employee = empRes.data as User
  const kpis = kpiRes.data as Kpi[] ?? []
  const review = reviewRes.data as Review | null
  const appraisal = appraisalRes.data as Appraisal | null

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Review: {employee?.full_name}</h1>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">KPIs</h2>
        {kpis.map(kpi => (
          <div key={kpi.id} className="rounded border p-3">
            <p className="font-medium">{kpi.title} ({kpi.weight}%)</p>
            {kpi.description && <p className="text-sm text-muted-foreground">{kpi.description}</p>}
          </div>
        ))}
      </section>

      {review && (
        <section className="rounded border bg-muted/30 p-4 space-y-2">
          <h2 className="text-lg font-semibold">Employee Self Assessment</h2>
          <p>Rating: <span className="font-bold">{review.self_rating}</span></p>
          <p className="whitespace-pre-wrap">{review.self_comments}</p>
        </section>
      )}

      {!appraisal?.manager_submitted_at && (
        <form action={async (fd: FormData) => { await submitManagerRating({ data: null, error: null }, fd) }} className="space-y-4 rounded border p-4">
          <h2 className="text-lg font-semibold">Your Rating</h2>
          <input type="hidden" name="cycle_id" value={cycleId} />
          <input type="hidden" name="employee_id" value={employeeId} />
          <div className="space-y-2">
            <Label htmlFor="manager_rating">Rating</Label>
            <select id="manager_rating" name="manager_rating" className="w-full rounded border p-2" required>
              <option value="">Select...</option>
              {RATING_TIERS.map(t => <option key={t.code} value={t.code}>{t.name}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="manager_comments">Comments</Label>
            <Textarea id="manager_comments" name="manager_comments" rows={5} required />
          </div>
          <Button type="submit">Submit Rating</Button>
        </form>
      )}

      {appraisal?.manager_submitted_at && (
        <p className="text-green-600 font-medium">Rating submitted: {appraisal.manager_rating}</p>
      )}
    </div>
  )
}
