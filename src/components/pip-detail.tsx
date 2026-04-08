'use client'

import { useState, useTransition, useActionState } from 'react'
import type { PipDetail } from '@/lib/db/pip'
import type { ActionResult } from '@/lib/types'
import {
  activatePip, acknowledgePip, addMilestone, updateMilestoneStatus,
  signOffMilestone, addCheckIn, respondToCheckIn, extendPip,
  completePip, closePip, uploadDocument,
} from '@/app/(dashboard)/admin/pip/actions'

/* ── Types ── */

interface PipDetailViewProps {
  pip: PipDetail
  role: 'admin' | 'hrbp' | 'manager' | 'employee'
  currentUserId: string
}

/* ── Helpers ── */

function fmtDate(d: Date | string): string {
  const dt = new Date(d)
  const day = dt.getDate().toString().padStart(2, '0')
  const mon = dt.toLocaleString('en-GB', { month: 'short' })
  const yr = dt.getFullYear()
  return `${day} ${mon} ${yr}`
}

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-slate-500/20 text-slate-400',
  active: 'bg-blue-500/20 text-blue-400',
  extended: 'bg-amber-500/20 text-amber-400',
  completed: 'bg-emerald-500/20 text-emerald-400',
  closed: 'bg-gray-500/20 text-gray-400',
}

const OUTCOME_BADGE: Record<string, string> = {
  improved: 'bg-emerald-500/20 text-emerald-400',
  partially_improved: 'bg-amber-500/20 text-amber-400',
  not_improved: 'bg-red-500/20 text-red-400',
}

const OUTCOME_LABEL: Record<string, string> = {
  improved: 'Improved',
  partially_improved: 'Partially Improved',
  not_improved: 'Not Improved',
}

const MILESTONE_DOT: Record<string, string> = {
  completed: 'bg-emerald-500',
  in_progress: 'bg-amber-500',
  missed: 'bg-red-500',
  pending: 'bg-gray-500',
}

const MILESTONE_STATUS_BADGE: Record<string, string> = {
  pending: 'bg-gray-500/20 text-gray-400',
  in_progress: 'bg-amber-500/20 text-amber-400',
  completed: 'bg-emerald-500/20 text-emerald-400',
  missed: 'bg-red-500/20 text-red-400',
}

const initialState: ActionResult = { data: null, error: null }

/* ── Component ── */

export function PipDetailView({ pip, role, currentUserId }: PipDetailViewProps) {
  const [showAddMilestone, setShowAddMilestone] = useState(false)
  const [showAddCheckIn, setShowAddCheckIn] = useState(false)
  const [showUploadDoc, setShowUploadDoc] = useState(false)
  const [showExtend, setShowExtend] = useState(false)
  const [showComplete, setShowComplete] = useState(false)
  const [respondingTo, setRespondingTo] = useState<string | null>(null)
  const [responseText, setResponseText] = useState('')

  const [isPending, startTransition] = useTransition()

  const [milestoneState, milestoneAction, milestonePending] = useActionState(addMilestone, initialState)
  const [checkInState, checkInAction, checkInPending] = useActionState(addCheckIn, initialState)
  const [docState, docAction, docPending] = useActionState(uploadDocument, initialState)

  const canManage = role === 'manager' || role === 'hrbp'
  const isHrbp = role === 'hrbp'
  const isEmployee = role === 'employee' && currentUserId === pip.employee.id

  // Progress ring calculations
  const now = Date.now()
  const start = new Date(pip.startDate).getTime()
  const end = new Date(pip.endDate).getTime()
  const totalDays = Math.max(1, Math.ceil((end - start) / 86400000))
  const elapsed = Math.min(totalDays, Math.max(0, Math.ceil((now - start) / 86400000)))
  const pct = Math.round((elapsed / totalDays) * 100)
  const radius = 28
  const circumference = 2 * Math.PI * radius
  const strokeDash = (pct / 100) * circumference

  function handleActivate() {
    startTransition(() => { activatePip(pip.id) })
  }

  function handleAcknowledge() {
    startTransition(() => { acknowledgePip(pip.id) })
  }

  function handleSignOff(milestoneId: string) {
    startTransition(() => { signOffMilestone(milestoneId) })
  }

  function handleMilestoneStatus(milestoneId: string, status: string) {
    startTransition(() => { updateMilestoneStatus(milestoneId, status) })
  }

  function handleRespond(checkInId: string) {
    if (!responseText.trim()) return
    startTransition(() => { respondToCheckIn(checkInId, responseText) })
    setRespondingTo(null)
    setResponseText('')
  }

  function handleExtend(formData: FormData) {
    const newDate = formData.get('new_end_date') as string
    if (!newDate) return
    startTransition(() => { extendPip(pip.id, newDate) })
    setShowExtend(false)
  }

  function handleComplete(formData: FormData) {
    const outcome = formData.get('outcome') as string
    const note = formData.get('escalation_note') as string
    if (!outcome) return
    startTransition(() => { completePip(pip.id, outcome, note || undefined) })
    setShowComplete(false)
  }

  function handleClose() {
    startTransition(() => { closePip(pip.id) })
  }

  return (
    <div className="space-y-6 pb-24">
      {/* ── 1. Header ── */}
      <div className="glass p-6 space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold">{pip.employee.fullName}</h1>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>{pip.employee.department}</span>
              {pip.employee.designation && (
                <>
                  <span className="text-muted-foreground/40">|</span>
                  <span>{pip.employee.designation}</span>
                </>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {fmtDate(pip.startDate)} — {fmtDate(pip.endDate)}
            </p>
          </div>

          <div className="flex items-center gap-4">
            {/* Progress Ring */}
            <div className="relative flex items-center justify-center">
              <svg width="72" height="72" className="-rotate-90">
                <circle cx="36" cy="36" r={radius} fill="none" stroke="currentColor" strokeWidth="4" className="text-muted-foreground/20" />
                <circle
                  cx="36" cy="36" r={radius} fill="none"
                  stroke="currentColor" strokeWidth="4" strokeLinecap="round"
                  className={pct >= 80 ? 'text-red-400' : pct >= 50 ? 'text-amber-400' : 'text-blue-400'}
                  strokeDasharray={`${strokeDash} ${circumference}`}
                />
              </svg>
              <span className="absolute text-xs font-bold tabular-nums">{elapsed}/{totalDays}d</span>
            </div>

            <div className="flex flex-col items-end gap-2">
              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE[pip.status] ?? STATUS_BADGE.draft}`}>
                {pip.status.charAt(0).toUpperCase() + pip.status.slice(1)}
              </span>
              {pip.outcome && (
                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${OUTCOME_BADGE[pip.outcome] ?? ''}`}>
                  {OUTCOME_LABEL[pip.outcome] ?? pip.outcome}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Metadata chips */}
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1 rounded-md bg-muted/30 px-2 py-1 text-xs text-muted-foreground">
            Initiated by <strong className="text-foreground">{pip.initiator.fullName}</strong>
          </span>
          <span className="inline-flex items-center gap-1 rounded-md bg-muted/30 px-2 py-1 text-xs text-muted-foreground">
            HRBP <strong className="text-foreground">{pip.hrbp.fullName}</strong>
          </span>
          <span className="inline-flex items-center gap-1 rounded-md bg-muted/30 px-2 py-1 text-xs text-muted-foreground">
            Manager <strong className="text-foreground">{pip.manager.fullName}</strong>
          </span>
          {pip.employeeAcknowledgedAt ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-1 text-xs text-emerald-400">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              Acknowledged
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-1 text-xs text-amber-400">
              Pending acknowledgment
            </span>
          )}
        </div>

        {/* Reason */}
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-1">Reason</p>
          <p className="text-sm">{pip.reason}</p>
        </div>
      </div>

      {/* ── 2. Milestones Timeline ── */}
      <div className="glass p-6 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Milestones</h2>

        {pip.milestones.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No milestones yet.</p>
        ) : (
          <div className="relative ml-4">
            {/* Timeline line */}
            <div className="absolute left-0 top-2 bottom-2 w-px bg-border" />

            <div className="space-y-6">
              {pip.milestones.map((m) => (
                <div key={m.id} className="relative pl-6">
                  {/* Dot */}
                  <div className={`absolute left-0 top-1.5 -translate-x-1/2 h-3 w-3 rounded-full border-2 border-background ${MILESTONE_DOT[m.status] ?? MILESTONE_DOT.pending}`} />

                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-sm">{m.title}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${MILESTONE_STATUS_BADGE[m.status] ?? MILESTONE_STATUS_BADGE.pending}`}>
                        {m.status.replace('_', ' ')}
                      </span>
                    </div>

                    <p className="text-xs text-muted-foreground">Target: {m.targetMetric}</p>
                    <p className="text-xs text-muted-foreground">Due: {fmtDate(m.dueDate)}</p>

                    {/* HRBP Sign-off */}
                    {m.hrbpSignedOffAt ? (
                      <p className="text-xs text-emerald-400">
                        <svg className="inline h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                        Signed off {fmtDate(m.hrbpSignedOffAt)}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-400">Awaiting sign-off</p>
                    )}

                    {/* Actions */}
                    {canManage && (
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <select
                          className="appearance-none rounded-md border border-border bg-muted/30 px-2 py-1 text-xs backdrop-blur focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
                          value={m.status}
                          onChange={(e) => handleMilestoneStatus(m.id, e.target.value)}
                          disabled={isPending}
                        >
                          <option value="pending">Pending</option>
                          <option value="in_progress">In Progress</option>
                          <option value="completed">Completed</option>
                          <option value="missed">Missed</option>
                        </select>

                        {isHrbp && !m.hrbpSignedOffAt && (
                          <button
                            onClick={() => handleSignOff(m.id)}
                            disabled={isPending}
                            className="rounded-md bg-emerald-500/20 px-2.5 py-1 text-xs font-medium text-emerald-400 hover:bg-emerald-500/30 transition-colors disabled:opacity-50"
                          >
                            Sign Off
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add Milestone */}
        {canManage && (
          <>
            {!showAddMilestone ? (
              <button
                onClick={() => setShowAddMilestone(true)}
                className="rounded-lg border border-dashed border-border px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors w-full"
              >
                + Add Milestone
              </button>
            ) : (
              <form action={milestoneAction} className="space-y-3 rounded-lg border border-border bg-muted/10 p-4">
                <input type="hidden" name="pip_id" value={pip.id} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <input name="title" placeholder="Title" required className="rounded-md border border-border bg-muted/30 px-3 py-1.5 text-sm backdrop-blur focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30" />
                  <input name="target_metric" placeholder="Target metric" required className="rounded-md border border-border bg-muted/30 px-3 py-1.5 text-sm backdrop-blur focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30" />
                </div>
                <input name="due_date" type="date" required className="rounded-md border border-border bg-muted/30 px-3 py-1.5 text-sm backdrop-blur focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30" />
                {milestoneState.error && <p className="text-xs text-red-400">{milestoneState.error}</p>}
                <div className="flex gap-2">
                  <button type="submit" disabled={milestonePending} className="rounded-md bg-primary/20 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/30 transition-colors disabled:opacity-50">
                    {milestonePending ? 'Adding...' : 'Add'}
                  </button>
                  <button type="button" onClick={() => setShowAddMilestone(false)} className="rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </div>

      {/* ── 3. Check-Ins ── */}
      <div className="glass p-6 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Check-Ins</h2>

        {pip.checkIns.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No check-ins yet.</p>
        ) : (
          <div className="space-y-4">
            {pip.checkIns.map((ci) => (
              <div key={ci.id} className="rounded-lg border border-border bg-muted/10 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{fmtDate(ci.checkInDate)}</span>
                  <span className="text-xs text-muted-foreground">{ci.createdBy.fullName}</span>
                </div>

                {/* Progress rating dots */}
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground mr-1">Rating:</span>
                  {[1, 2, 3, 4, 5].map((v) => (
                    <svg key={v} className="h-3.5 w-3.5" viewBox="0 0 16 16">
                      <circle cx="8" cy="8" r="6" fill={v <= ci.progressRating ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5"
                        className={v <= ci.progressRating ? 'text-blue-400' : 'text-muted-foreground/40'}
                      />
                    </svg>
                  ))}
                </div>

                <p className="text-sm">{ci.notes}</p>
                {ci.nextSteps && <p className="text-sm italic text-muted-foreground">{ci.nextSteps}</p>}

                {/* Employee response */}
                {ci.employeeResponse && (
                  <div className="ml-2 border-l-2 border-primary/30 bg-primary/5 rounded-r-md pl-3 py-2">
                    <p className="text-xs text-muted-foreground mb-1">Employee Response</p>
                    <p className="text-sm">{ci.employeeResponse}</p>
                  </div>
                )}

                {/* Respond button */}
                {isEmployee && !ci.employeeResponse && (
                  <>
                    {respondingTo === ci.id ? (
                      <div className="space-y-2 pt-1">
                        <textarea
                          value={responseText}
                          onChange={(e) => setResponseText(e.target.value)}
                          placeholder="Your response..."
                          rows={3}
                          className="w-full rounded-md border border-border bg-muted/30 px-3 py-2 text-sm backdrop-blur focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleRespond(ci.id)}
                            disabled={isPending || !responseText.trim()}
                            className="rounded-md bg-primary/20 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/30 transition-colors disabled:opacity-50"
                          >
                            Submit
                          </button>
                          <button onClick={() => { setRespondingTo(null); setResponseText('') }} className="rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setRespondingTo(ci.id)}
                        className="rounded-md bg-muted/30 px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                      >
                        Respond
                      </button>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add Check-In */}
        {canManage && (
          <>
            {!showAddCheckIn ? (
              <button
                onClick={() => setShowAddCheckIn(true)}
                className="rounded-lg border border-dashed border-border px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors w-full"
              >
                + Add Check-In
              </button>
            ) : (
              <form action={checkInAction} className="space-y-3 rounded-lg border border-border bg-muted/10 p-4">
                <input type="hidden" name="pip_id" value={pip.id} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <input name="check_in_date" type="date" required className="rounded-md border border-border bg-muted/30 px-3 py-1.5 text-sm backdrop-blur focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30" />
                  <select name="progress_rating" required className="appearance-none rounded-md border border-border bg-muted/30 px-3 py-1.5 text-sm backdrop-blur focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30">
                    <option value="">Rating</option>
                    <option value="1">1 - Poor</option>
                    <option value="2">2 - Below Average</option>
                    <option value="3">3 - Average</option>
                    <option value="4">4 - Good</option>
                    <option value="5">5 - Excellent</option>
                  </select>
                </div>
                <textarea name="notes" placeholder="Notes" required rows={3} className="w-full rounded-md border border-border bg-muted/30 px-3 py-2 text-sm backdrop-blur focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30" />
                <input name="next_steps" placeholder="Next steps (optional)" className="w-full rounded-md border border-border bg-muted/30 px-3 py-1.5 text-sm backdrop-blur focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30" />
                {checkInState.error && <p className="text-xs text-red-400">{checkInState.error}</p>}
                <div className="flex gap-2">
                  <button type="submit" disabled={checkInPending} className="rounded-md bg-primary/20 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/30 transition-colors disabled:opacity-50">
                    {checkInPending ? 'Adding...' : 'Add Check-In'}
                  </button>
                  <button type="button" onClick={() => setShowAddCheckIn(false)} className="rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </div>

      {/* ── 4. Documents ── */}
      <div className="glass p-6 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Documents</h2>

        {pip.documents.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No documents uploaded.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {pip.documents.map((doc) => (
              <a
                key={doc.id}
                href={doc.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-lg border border-border bg-muted/10 p-3 hover:bg-muted/20 transition-colors group"
              >
                {/* File icon */}
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted/30">
                  <svg className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{doc.fileName}</p>
                  <p className="text-xs text-muted-foreground">{doc.uploadedBy.fullName} &middot; {fmtDate(doc.createdAt)}</p>
                </div>
              </a>
            ))}
          </div>
        )}

        {/* Upload Document */}
        {canManage && (
          <>
            {!showUploadDoc ? (
              <button
                onClick={() => setShowUploadDoc(true)}
                className="rounded-lg border border-dashed border-border px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors w-full"
              >
                + Upload Document
              </button>
            ) : (
              <form action={docAction} className="space-y-3 rounded-lg border border-border bg-muted/10 p-4">
                <input type="hidden" name="pip_id" value={pip.id} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <input name="file_name" placeholder="File name" required className="rounded-md border border-border bg-muted/30 px-3 py-1.5 text-sm backdrop-blur focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30" />
                  <input name="file_type" placeholder="File type (e.g. pdf)" required className="rounded-md border border-border bg-muted/30 px-3 py-1.5 text-sm backdrop-blur focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30" />
                </div>
                <input name="file_url" placeholder="File URL" required className="w-full rounded-md border border-border bg-muted/30 px-3 py-1.5 text-sm backdrop-blur focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30" />
                <input name="description" placeholder="Description (optional)" className="w-full rounded-md border border-border bg-muted/30 px-3 py-1.5 text-sm backdrop-blur focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30" />
                {docState.error && <p className="text-xs text-red-400">{docState.error}</p>}
                <div className="flex gap-2">
                  <button type="submit" disabled={docPending} className="rounded-md bg-primary/20 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/30 transition-colors disabled:opacity-50">
                    {docPending ? 'Uploading...' : 'Upload'}
                  </button>
                  <button type="button" onClick={() => setShowUploadDoc(false)} className="rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </div>

      {/* ── 5. Actions Bar (bottom sticky) ── */}
      <div className="fixed bottom-0 left-0 right-0 z-50 glass border-t border-border backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-6 py-3">
          <div className="flex flex-wrap gap-2">
            {/* HRBP: Activate */}
            {isHrbp && pip.status === 'draft' && (
              <button onClick={handleActivate} disabled={isPending} className="rounded-lg bg-blue-500/20 px-4 py-2 text-xs font-semibold text-blue-400 hover:bg-blue-500/30 transition-colors disabled:opacity-50">
                Activate
              </button>
            )}

            {/* Manager/HRBP: Extend */}
            {canManage && pip.status === 'active' && (
              <>
                {!showExtend ? (
                  <button onClick={() => setShowExtend(true)} disabled={isPending} className="rounded-lg bg-amber-500/20 px-4 py-2 text-xs font-semibold text-amber-400 hover:bg-amber-500/30 transition-colors disabled:opacity-50">
                    Extend
                  </button>
                ) : (
                  <form action={handleExtend} className="flex items-center gap-2">
                    <input name="new_end_date" type="date" required className="rounded-md border border-border bg-muted/30 px-2 py-1.5 text-xs backdrop-blur focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30" />
                    <button type="submit" disabled={isPending} className="rounded-md bg-amber-500/20 px-3 py-1.5 text-xs font-medium text-amber-400 hover:bg-amber-500/30 transition-colors disabled:opacity-50">
                      Confirm
                    </button>
                    <button type="button" onClick={() => setShowExtend(false)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                      Cancel
                    </button>
                  </form>
                )}
              </>
            )}

            {/* HRBP: Complete PIP */}
            {isHrbp && (pip.status === 'active' || pip.status === 'extended') && (
              <>
                {!showComplete ? (
                  <button onClick={() => setShowComplete(true)} disabled={isPending} className="rounded-lg bg-emerald-500/20 px-4 py-2 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/30 transition-colors disabled:opacity-50">
                    Complete PIP
                  </button>
                ) : (
                  <form action={handleComplete} className="flex items-center gap-2">
                    <select name="outcome" required className="appearance-none rounded-md border border-border bg-muted/30 px-2 py-1.5 text-xs backdrop-blur focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30">
                      <option value="">Outcome</option>
                      <option value="improved">Improved</option>
                      <option value="partially_improved">Partially Improved</option>
                      <option value="not_improved">Not Improved</option>
                    </select>
                    <input name="escalation_note" placeholder="Escalation note" className="rounded-md border border-border bg-muted/30 px-2 py-1.5 text-xs backdrop-blur focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30" />
                    <button type="submit" disabled={isPending} className="rounded-md bg-emerald-500/20 px-3 py-1.5 text-xs font-medium text-emerald-400 hover:bg-emerald-500/30 transition-colors disabled:opacity-50">
                      Confirm
                    </button>
                    <button type="button" onClick={() => setShowComplete(false)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                      Cancel
                    </button>
                  </form>
                )}
              </>
            )}

            {/* HRBP: Close PIP */}
            {isHrbp && pip.status === 'completed' && (
              <button onClick={handleClose} disabled={isPending} className="rounded-lg bg-gray-500/20 px-4 py-2 text-xs font-semibold text-gray-400 hover:bg-gray-500/30 transition-colors disabled:opacity-50">
                Close PIP
              </button>
            )}

            {/* Employee: Acknowledge */}
            {isEmployee && !pip.employeeAcknowledgedAt && (
              <button onClick={handleAcknowledge} disabled={isPending} className="rounded-lg bg-primary/20 px-4 py-2 text-xs font-semibold text-primary hover:bg-primary/30 transition-colors disabled:opacity-50">
                Acknowledge PIP
              </button>
            )}
          </div>

          {isPending && (
            <span className="text-xs text-muted-foreground animate-pulse">Processing...</span>
          )}
        </div>
      </div>
    </div>
  )
}
