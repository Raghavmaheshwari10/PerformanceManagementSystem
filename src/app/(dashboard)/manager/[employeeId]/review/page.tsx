import { prisma } from '@/lib/prisma'
import { requireRole, requireManagerOwnership } from '@/lib/auth'
import { toTitleCase } from '@/lib/constants'
import { calculateEmployeeScore } from '@/lib/mis-scoring'
import { ReviewForm } from './review-form'
import type { User, Kpi, Kra, Review, Appraisal, ReviewQuestionWithCompetency } from '@/lib/types'

export default async function ManagerReviewPage({
  params, searchParams,
}: {
  params: Promise<{ employeeId: string }>
  searchParams: Promise<{ cycle?: string }>
}) {
  const user = await requireRole(['manager'])
  const { employeeId } = await params
  const { cycle: cycleId } = await searchParams

  await requireManagerOwnership(employeeId, user.id)

  if (cycleId) {
    const cycle = await prisma.cycle.findUnique({ where: { id: cycleId }, select: { id: true } })
    if (!cycle) return <p className="text-muted-foreground">Cycle not found.</p>
  }

  // Check meeting status for gating
  const meetingRecord = cycleId
    ? await prisma.reviewMeeting.findUnique({
        where: { cycle_id_employee_id: { cycle_id: cycleId, employee_id: employeeId } },
        select: {
          status: true,
          scheduled_at: true,
          meet_link: true,
          completed_at: true,
          hrbp: { select: { full_name: true } },
          minutes: {
            select: {
              key_discussion_points: true,
              strengths_highlighted: true,
              areas_for_improvement: true,
              action_items: true,
              employee_agreement: true,
              concerns_raised: true,
              created_at: true,
            },
          },
        },
      })
    : null

  const meetingCompleted = meetingRecord?.status === 'completed'

  const [employee, kpisRaw, krasRaw, review, appraisal, misScore, peerReviews, cycleData] = await Promise.all([
    prisma.user.findUnique({ where: { id: employeeId } }),
    cycleId
      ? prisma.kpi.findMany({
          where: { cycle_id: cycleId, employee_id: employeeId },
          include: { kra: true },
        })
      : Promise.resolve([]),
    cycleId
      ? prisma.kra.findMany({
          where: { cycle_id: cycleId, employee_id: employeeId },
          orderBy: { sort_order: 'asc' },
        })
      : Promise.resolve([]),
    cycleId
      ? prisma.review.findFirst({ where: { cycle_id: cycleId, employee_id: employeeId } })
      : Promise.resolve(null),
    cycleId
      ? prisma.appraisal.findFirst({ where: { cycle_id: cycleId, employee_id: employeeId } })
      : Promise.resolve(null),
    cycleId
      ? calculateEmployeeScore(employeeId, cycleId)
      : Promise.resolve(null),
    cycleId
      ? prisma.peerReviewRequest.findMany({
          where: { cycle_id: cycleId, reviewee_id: employeeId, status: 'submitted' },
          include: { peer_user: { select: { full_name: true } } },
          orderBy: { updated_at: 'desc' },
        })
      : Promise.resolve([]),
    cycleId
      ? prisma.cycle.findUnique({
          where: { id: cycleId },
          select: {
            competency_weight: true,
            review_template_id: true,
            review_template: {
              include: {
                questions: {
                  orderBy: { order_index: 'asc' },
                  include: { competency: true },
                },
              },
            },
          },
        })
      : Promise.resolve(null),
  ])

  // Serialize Prisma Decimals to plain numbers
  const kpis = kpisRaw.map((k) => ({
    ...k,
    weight: k.weight !== null ? Number(k.weight) : null,
    target: k.target != null ? Number(k.target) : null,
    achievement: k.achievement != null ? Number(k.achievement) : null,
    kra: k.kra ? { ...k.kra, weight: k.kra.weight !== null ? Number(k.kra.weight) : null } : null,
  })) as unknown as (Kpi & { kra: Kra | null })[]

  const kras = krasRaw.map((k) => ({
    ...k,
    weight: k.weight !== null ? Number(k.weight) : null,
  })) as unknown as Kra[]

  // Group KPIs by KRA
  const hasKras = kras.length > 0
  const kpisByKra = new Map<string | null, typeof kpis>()
  for (const kpi of kpis) {
    const key = kpi.kra_id ?? null
    if (!kpisByKra.has(key)) kpisByKra.set(key, [])
    kpisByKra.get(key)!.push(kpi)
  }
  const ungroupedKpis = kpisByKra.get(null) ?? []

  // Serialize competency questions for the form
  const competencyWeight = cycleData ? Number(cycleData.competency_weight) : 0
  const competencyQuestions: ReviewQuestionWithCompetency[] = cycleData?.review_template?.questions
    ? cycleData.review_template.questions.map(q => ({
        id: q.id,
        template_id: q.template_id,
        competency_id: q.competency_id,
        question_text: q.question_text,
        answer_type: q.answer_type as ReviewQuestionWithCompetency['answer_type'],
        is_required: q.is_required,
        order_index: q.order_index,
        competency: q.competency ? {
          id: q.competency.id,
          name: q.competency.name,
          description: q.competency.description,
          created_at: q.competency.created_at.toISOString(),
        } : null,
      }))
    : []

  // Fetch existing manager competency responses
  const existingCompetencyResponses: Record<string, { rating_value: number | null; text_value: string | null }> = {}
  if (review && competencyQuestions.length > 0) {
    const responses = await prisma.reviewResponse.findMany({
      where: { review_id: review.id, respondent_id: user.id },
      select: { question_id: true, rating_value: true, text_value: true },
    })
    for (const r of responses) {
      existingCompetencyResponses[r.question_id] = { rating_value: r.rating_value, text_value: r.text_value }
    }
  }

  const submitted = !!(appraisal as Appraisal | null)?.manager_submitted_at
  const isExitFrozen = !!(appraisal as any)?.is_exit_frozen
  const exitedAt = (appraisal as any)?.exited_at
  const prorationFactor = (appraisal as any)?.proration_factor != null ? Number((appraisal as any).proration_factor) : null

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Review: {(employee as unknown as User)?.full_name}</h1>
          {isExitFrozen && (
            <span className="rounded-full bg-red-500/20 px-3 py-1 text-xs font-semibold text-red-400">
              Exited
            </span>
          )}
        </div>
        {submitted && (
          <p className="mt-1 text-sm text-green-600 font-medium">
            ✓ Rating submitted: {(appraisal as Appraisal | null)?.manager_rating}
          </p>
        )}
        {isExitFrozen && (
          <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
            <p className="text-sm text-amber-300">
              <strong>Exit frozen:</strong> This employee exited the cycle
              {exitedAt ? ` on ${new Date(exitedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}.
              {prorationFactor != null && ` Proration factor: ${(prorationFactor * 100).toFixed(1)}%.`}
              {' '}Manager rating is optional for exited employees.
            </p>
          </div>
        )}
      </div>

      {/* MIS Auto-Score Sidebar */}
      {misScore && (
        <div className="glass rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              MIS Auto-Score
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold">{misScore.mis_score}%</span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                misScore.suggested_rating === 'FEE' ? 'bg-emerald-500/20 text-emerald-400'
                : misScore.suggested_rating === 'EE' ? 'bg-blue-500/20 text-blue-400'
                : misScore.suggested_rating === 'ME' ? 'bg-amber-500/20 text-amber-400'
                : 'bg-red-500/20 text-red-400'
              }`}>
                Suggests: {misScore.suggested_rating}
              </span>
            </div>
          </div>
          <div className="space-y-1.5">
            {misScore.kpi_scores.map(k => (
              <div key={k.kpi_id} className="flex items-center justify-between text-sm rounded border border-border bg-muted/20 px-3 py-1.5">
                <span className="text-muted-foreground truncate mr-2">{k.kpi_title}</span>
                <span className={`shrink-0 font-medium ${
                  k.achievement_pct >= 95 ? 'text-emerald-400' : k.achievement_pct >= 80 ? 'text-amber-400' : 'text-red-400'
                }`}>
                  {k.achievement_pct}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Meeting gate banner */}
      {cycleId && !submitted && (
        !meetingRecord ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 shrink-0">
                <svg className="h-4 w-4 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" /></svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-amber-800">Review Discussion Meeting Required</p>
                <p className="text-xs text-amber-600 mt-0.5">A review discussion meeting must be scheduled and completed before you can submit your review. Contact your HRBP to schedule the meeting.</p>
              </div>
            </div>
          </div>
        ) : meetingRecord.status === 'scheduled' ? (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 shrink-0">
                <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" /></svg>
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-blue-800">Discussion Meeting Scheduled</p>
                <p className="text-xs text-blue-600 mt-0.5">
                  Scheduled for {new Date(meetingRecord.scheduled_at).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} at{' '}
                  {new Date(meetingRecord.scheduled_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  {' '}with HRBP {meetingRecord.hrbp.full_name}
                </p>
                {meetingRecord.meet_link && (
                  <a
                    href={meetingRecord.meet_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 mt-2 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition-colors"
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" /></svg>
                    Join Google Meet
                  </a>
                )}
                <p className="text-xs text-blue-500 mt-1.5">Review form will be unlocked after the meeting is completed and MOM is submitted.</p>
              </div>
            </div>
          </div>
        ) : meetingCompleted && meetingRecord.minutes ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 shrink-0">
                <svg className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-emerald-800">Discussion Meeting Completed — Review Unlocked</p>
                <p className="text-xs text-emerald-600 mt-0.5">
                  Meeting completed on {meetingRecord.completed_at ? new Date(meetingRecord.completed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'}.
                  You can now submit your review.
                </p>
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs font-medium text-emerald-700 hover:text-emerald-800">View Meeting Minutes</summary>
                  <div className="mt-2 space-y-2 rounded-lg border border-emerald-200 bg-white p-3 text-sm">
                    <div>
                      <p className="text-xs font-medium text-slate-500">Key Discussion Points</p>
                      <p className="text-slate-700 whitespace-pre-wrap">{meetingRecord.minutes.key_discussion_points}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-500">Strengths</p>
                      <p className="text-slate-700 whitespace-pre-wrap">{meetingRecord.minutes.strengths_highlighted}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-500">Areas for Improvement</p>
                      <p className="text-slate-700 whitespace-pre-wrap">{meetingRecord.minutes.areas_for_improvement}</p>
                    </div>
                    {meetingRecord.minutes.concerns_raised && (
                      <div className="rounded-lg bg-amber-50 border border-amber-100 p-2">
                        <p className="text-xs font-medium text-amber-700">Confidential Concerns</p>
                        <p className="text-sm text-amber-800 whitespace-pre-wrap">{meetingRecord.minutes.concerns_raised}</p>
                      </div>
                    )}
                    {(meetingRecord.minutes.action_items as Array<{ description: string; owner: string; deadline: string }>).length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-slate-500">Action Items</p>
                        {(meetingRecord.minutes.action_items as Array<{ description: string; owner: string; deadline: string }>).map((item, idx) => (
                          <p key={idx} className="text-xs text-slate-600">• {item.description} (Owner: {item.owner}{item.deadline ? `, Due: ${item.deadline}` : ''})</p>
                        ))}
                      </div>
                    )}
                    <p className="text-xs">
                      {meetingRecord.minutes.employee_agreement
                        ? <span className="text-emerald-600 font-medium">✓ Employee agreed</span>
                        : <span className="text-amber-600 font-medium">⚠ Employee disagreed</span>
                      }
                    </p>
                  </div>
                </details>
              </div>
            </div>
          </div>
        ) : null
      )}

      {/* Side-by-side layout */}
      <div className="grid gap-6 xl:grid-cols-2">
        {/* LEFT — Employee's self-assessment (read-only, scrollable) */}
        <div className="rounded-lg border bg-muted/20 p-4 space-y-4 xl:max-h-[calc(100vh-12rem)] xl:overflow-y-auto">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground sticky top-0 bg-muted/20 py-1">
            Employee Self-Assessment
          </h2>

          {/* KPIs */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">KPIs ({kpis.length})</p>
            {kpis.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No KPIs set for this cycle.</p>
            ) : !hasKras ? (
              /* Flat list when no KRAs exist (backwards compatible) */
              kpis.map(kpi => (
                <div key={kpi.id} className="rounded border bg-background p-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium">{kpi.title}</p>
                    {kpi.target != null && (
                      <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-semibold text-blue-400">
                        Target: {kpi.unit === 'percent' ? `${kpi.target}%` : String(kpi.target)}
                      </span>
                    )}
                    {kpi.achievement != null && (
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                        Achievement: {kpi.unit === 'percent' ? `${kpi.achievement}%` : String(kpi.achievement)}
                      </span>
                    )}
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs">{kpi.weight}%</span>
                  </div>
                  {kpi.description && (
                    <p className="mt-1 text-xs text-muted-foreground">{kpi.description}</p>
                  )}
                  {kpi.self_rating && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Self-rated: <span className="font-semibold text-foreground">{kpi.self_rating}</span>
                      {kpi.self_comments && <> — {kpi.self_comments}</>}
                    </p>
                  )}
                </div>
              ))
            ) : (
              /* Grouped by KRA */
              <div className="space-y-3">
                {kras.map(kra => {
                  const kraKpis = kpisByKra.get(kra.id) ?? []
                  if (kraKpis.length === 0) return null
                  const catColor =
                    kra.category === 'behaviour' ? 'bg-amber-500/15 text-amber-400'
                    : kra.category === 'learning' ? 'bg-emerald-500/15 text-emerald-400'
                    : 'bg-primary/15 text-primary'
                  return (
                    <div key={kra.id} className="rounded-lg border border-border bg-muted/30 backdrop-blur-sm p-3 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-primary tracking-wide">KRA</span>
                        <p className="text-sm font-semibold">{kra.title}</p>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${catColor}`}>
                          {toTitleCase(kra.category)}
                        </span>
                        {kra.weight != null && (
                          <span className="ml-auto shrink-0 text-xs text-muted-foreground">{kra.weight}%</span>
                        )}
                      </div>
                      {kraKpis.map(kpi => (
                        <div key={kpi.id} className="rounded border bg-background p-2.5 ml-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium">{kpi.title}</p>
                            {kpi.target != null && (
                              <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-semibold text-blue-400">
                                Target: {kpi.unit === 'percent' ? `${kpi.target}%` : String(kpi.target)}
                              </span>
                            )}
                            {kpi.achievement != null && (
                              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                                Achievement: {kpi.unit === 'percent' ? `${kpi.achievement}%` : String(kpi.achievement)}
                              </span>
                            )}
                            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs">{kpi.weight}%</span>
                          </div>
                          {kpi.description && (
                            <p className="mt-1 text-xs text-muted-foreground">{kpi.description}</p>
                          )}
                          {kpi.self_rating && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              Self-rated: <span className="font-semibold text-foreground">{kpi.self_rating}</span>
                              {kpi.self_comments && <> — {kpi.self_comments}</>}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )
                })}
                {ungroupedKpis.length > 0 && (
                  <div className="rounded-lg border border-border bg-muted/30 backdrop-blur-sm p-3 space-y-2">
                    <p className="text-sm font-semibold text-muted-foreground">General</p>
                    {ungroupedKpis.map(kpi => (
                      <div key={kpi.id} className="rounded border bg-background p-2.5 ml-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium">{kpi.title}</p>
                          {kpi.target != null && (
                            <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-semibold text-blue-400">
                              Target: {kpi.unit === 'percent' ? `${kpi.target}%` : String(kpi.target)}
                            </span>
                          )}
                          {kpi.achievement != null && (
                            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                              Achievement: {kpi.unit === 'percent' ? `${kpi.achievement}%` : String(kpi.achievement)}
                            </span>
                          )}
                          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs">{kpi.weight}%</span>
                        </div>
                        {kpi.description && (
                          <p className="mt-1 text-xs text-muted-foreground">{kpi.description}</p>
                        )}
                        {kpi.self_rating && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Self-rated: <span className="font-semibold text-foreground">{kpi.self_rating}</span>
                            {kpi.self_comments && <> — {kpi.self_comments}</>}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Self-review */}
          {review ? (
            <div className="space-y-3">
              <div className="rounded border bg-background p-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">Self Rating</p>
                <span className="font-semibold">{(review as unknown as Review).self_rating ?? '—'}</span>
              </div>
              <div className="rounded border bg-background p-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">Self Comments</p>
                <p className="text-sm whitespace-pre-wrap">{(review as unknown as Review).self_comments || <span className="italic text-muted-foreground">No comments</span>}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm italic text-muted-foreground">
              Employee has not submitted their self-review yet.
            </p>
          )}
        </div>

        {/* RIGHT — Manager's assessment form */}
        <div className="rounded-lg border p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">
            Your Assessment
          </h2>
          {submitted ? (
            <div className="space-y-3">
              <div className="rounded border p-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">Your Rating</p>
                <span className="font-semibold text-green-700">{(appraisal as Appraisal | null)?.manager_rating}</span>
              </div>
              {(appraisal as Appraisal | null)?.manager_comments && (
                <div className="rounded border p-3">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Your Comments</p>
                  <p className="text-sm whitespace-pre-wrap">{(appraisal as Appraisal | null)?.manager_comments}</p>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Submitted. Contact your HRBP to request changes.
              </p>
            </div>
          ) : !meetingCompleted && cycleId ? (
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
                <svg className="h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" /></svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Review Form Locked</p>
                <p className="text-xs text-slate-500 mt-1 max-w-xs">
                  The review discussion meeting must be completed before you can submit your assessment.
                  {!meetingRecord ? ' Contact your HRBP to schedule the meeting.' : ' Please attend the scheduled meeting.'}
                </p>
              </div>
            </div>
          ) : cycleId ? (
            <ReviewForm
              cycleId={cycleId}
              employeeId={employeeId}
              kpis={kpis}
              kras={kras}
              defaultRating={(appraisal as Appraisal | null)?.manager_rating ?? misScore?.suggested_rating ?? undefined}
              defaultComments={(appraisal as Appraisal | null)?.manager_comments ?? undefined}
              competencyQuestions={competencyQuestions}
              existingCompetencyResponses={existingCompetencyResponses}
              competencyWeight={competencyWeight}
            />
          ) : (
            <p className="text-sm text-muted-foreground">No active cycle selected.</p>
          )}
        </div>
      </div>
    </div>
  )
}
