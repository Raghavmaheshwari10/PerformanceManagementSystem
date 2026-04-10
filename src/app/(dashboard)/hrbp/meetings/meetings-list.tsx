'use client'

import { useState, useActionState } from 'react'
import { cn } from '@/lib/utils'
import { scheduleMeeting, submitMeetingMinutes, cancelMeeting, rescheduleMeeting } from './actions'
import {
  CalendarPlus, Video, CheckCircle2, XCircle, Clock, FileText,
  ChevronDown, ChevronRight, AlertCircle, Users, ExternalLink, RefreshCw,
} from 'lucide-react'

interface ActionItem {
  description: string
  owner: string
  deadline: string
}

interface MeetingMinutesData {
  id: string
  key_discussion_points: string
  strengths_highlighted: string
  areas_for_improvement: string
  action_items: ActionItem[]
  employee_agreement: boolean
  concerns_raised: string | null
  created_at: string
}

interface MeetingData {
  id: string
  status: string
  scheduled_at: string
  meet_link: string | null
  completed_at: string | null
  cancelled_at: string | null
  cancel_reason: string | null
  hrbp_name: string
  minutes: MeetingMinutesData | null
}

interface EmployeeData {
  id: string
  full_name: string
  email: string
  designation: string | null
  department: string
  manager_id: string | null
  manager_name: string
  self_review_submitted_at: string | null
  meeting: MeetingData | null
}

interface CycleData {
  cycle: {
    id: string
    name: string
    status: string
    manager_review_deadline: string | null
  }
  employees: EmployeeData[]
}

const INITIAL = { data: null as null, error: null as string | null }

const STATUS_BADGES: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: 'Needs Scheduling', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: Clock },
  scheduled: { label: 'Scheduled', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: CalendarPlus },
  completed: { label: 'Completed', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  cancelled: { label: 'Cancelled', color: 'bg-red-50 text-red-700 border-red-200', icon: XCircle },
}

export function MeetingsList({ data, hrbpId }: { data: CycleData[]; hrbpId: string }) {
  const [expandedCycle, setExpandedCycle] = useState<string | null>(data[0]?.cycle.id ?? null)
  const [scheduleFor, setScheduleFor] = useState<{ cycleId: string; employeeId: string; employeeName: string } | null>(null)
  const [rescheduleFor, setRescheduleFor] = useState<{ meetingId: string; employeeName: string; currentTime: string } | null>(null)
  const [momFor, setMomFor] = useState<{ meetingId: string; employeeName: string } | null>(null)
  const [viewMom, setViewMom] = useState<{ minutes: MeetingMinutesData; employeeName: string } | null>(null)

  // Full-page views — replace the meetings list when active
  if (viewMom) {
    return (
      <ViewMomPage
        minutes={viewMom.minutes}
        employeeName={viewMom.employeeName}
        onClose={() => setViewMom(null)}
      />
    )
  }

  if (scheduleFor) {
    return (
      <SchedulePage
        cycleId={scheduleFor.cycleId}
        employeeId={scheduleFor.employeeId}
        employeeName={scheduleFor.employeeName}
        onClose={() => setScheduleFor(null)}
      />
    )
  }

  if (rescheduleFor) {
    return (
      <ReschedulePage
        meetingId={rescheduleFor.meetingId}
        employeeName={rescheduleFor.employeeName}
        currentTime={rescheduleFor.currentTime}
        onClose={() => setRescheduleFor(null)}
      />
    )
  }

  if (momFor) {
    return (
      <MomFormPage
        meetingId={momFor.meetingId}
        employeeName={momFor.employeeName}
        onClose={() => setMomFor(null)}
      />
    )
  }

  return (
    <div className="space-y-4">
      {data.map(({ cycle, employees }) => {
        const isExpanded = expandedCycle === cycle.id
        const needsScheduling = employees.filter(e => !e.meeting || e.meeting.status === 'cancelled').length
        const scheduled = employees.filter(e => e.meeting?.status === 'scheduled').length
        const completed = employees.filter(e => e.meeting?.status === 'completed').length

        return (
          <div key={cycle.id} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <button
              onClick={() => setExpandedCycle(isExpanded ? null : cycle.id)}
              className="flex w-full items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                {isExpanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                <div className="text-left">
                  <h2 className="text-sm font-semibold text-slate-900">{cycle.name}</h2>
                  {cycle.manager_review_deadline && (
                    <p className="text-xs text-slate-400">
                      Manager review deadline: {new Date(cycle.manager_review_deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                {needsScheduling > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                    <Clock className="h-3 w-3" /> {needsScheduling} pending
                  </span>
                )}
                {scheduled > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                    <Video className="h-3 w-3" /> {scheduled} scheduled
                  </span>
                )}
                {completed > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                    <CheckCircle2 className="h-3 w-3" /> {completed} done
                  </span>
                )}
              </div>
            </button>

            {isExpanded && (
              <div className="border-t border-slate-100">
                {employees.length === 0 ? (
                  <p className="px-6 py-8 text-center text-sm text-slate-500">No employees with submitted self-reviews in your departments.</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {employees.map(emp => {
                      const meetingStatus = emp.meeting ? emp.meeting.status : 'pending'
                      const badge = STATUS_BADGES[meetingStatus] ?? STATUS_BADGES.pending
                      const BadgeIcon = badge.icon

                      return (
                        <div key={emp.id} className="flex items-center justify-between px-6 py-3.5 hover:bg-slate-50/50">
                          <div className="flex items-center gap-4 min-w-0">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600 shrink-0">
                              {emp.full_name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-slate-900 truncate">{emp.full_name}</p>
                              <p className="text-xs text-slate-400 truncate">
                                {emp.designation ?? emp.department} &middot; Manager: {emp.manager_name}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            {/* Status badge */}
                            <span className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium', badge.color)}>
                              <BadgeIcon className="h-3 w-3" />
                              {badge.label}
                            </span>

                            {/* Meeting time */}
                            {emp.meeting?.scheduled_at && emp.meeting.status === 'scheduled' && (
                              <span className="text-xs text-slate-500">
                                {new Date(emp.meeting.scheduled_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}{' '}
                                {new Date(emp.meeting.scheduled_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}

                            {/* Meet link */}
                            {emp.meeting?.meet_link && emp.meeting.status === 'scheduled' && (
                              <a
                                href={emp.meeting.meet_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition-colors"
                              >
                                <Video className="h-3 w-3" /> Join
                              </a>
                            )}

                            {/* Actions */}
                            {meetingStatus === 'pending' || meetingStatus === 'cancelled' ? (
                              <button
                                onClick={() => setScheduleFor({ cycleId: cycle.id, employeeId: emp.id, employeeName: emp.full_name })}
                                className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 transition-colors"
                              >
                                <CalendarPlus className="h-3 w-3" /> Schedule
                              </button>
                            ) : meetingStatus === 'scheduled' ? (
                              <>
                                <button
                                  onClick={() => setRescheduleFor({ meetingId: emp.meeting!.id, employeeName: emp.full_name, currentTime: emp.meeting!.scheduled_at })}
                                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                                >
                                  <RefreshCw className="h-3 w-3" /> Reschedule
                                </button>
                                <button
                                  onClick={() => setMomFor({ meetingId: emp.meeting!.id, employeeName: emp.full_name })}
                                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 transition-colors"
                                >
                                  <FileText className="h-3 w-3" /> Add MOM
                                </button>
                              </>
                            ) : meetingStatus === 'completed' && emp.meeting?.minutes ? (
                              <button
                                onClick={() => setViewMom({ minutes: emp.meeting!.minutes!, employeeName: emp.full_name })}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                              >
                                <FileText className="h-3 w-3" /> View MOM
                              </button>
                            ) : null}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}

    </div>
  )
}

function SchedulePage({ cycleId, employeeId, employeeName, onClose }: {
  cycleId: string; employeeId: string; employeeName: string; onClose: () => void
}) {
  const [state, action, pending] = useActionState(scheduleMeeting, INITIAL)

  if (state.error === null && state.data === null && !pending && state !== INITIAL) {
    setTimeout(onClose, 100)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={onClose} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
          <ChevronRight className="h-4 w-4 rotate-180" /> Back to Meetings
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white max-w-lg">
        <div className="border-b border-slate-100 px-6 py-5">
          <h2 className="text-lg font-semibold text-slate-900">Schedule Discussion Meeting</h2>
          <p className="text-sm text-slate-500 mt-1">For {employeeName}</p>
        </div>

        <form action={action}>
          <input type="hidden" name="cycle_id" value={cycleId} />
          <input type="hidden" name="employee_id" value={employeeId} />

          <div className="px-6 py-6 space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Date & Time</label>
              <input
                type="datetime-local"
                name="scheduled_at"
                required
                min={new Date().toISOString().slice(0, 16)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Duration (minutes)</label>
              <select
                name="duration_minutes"
                defaultValue="60"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              >
                <option value="30">30 minutes</option>
                <option value="45">45 minutes</option>
                <option value="60">60 minutes</option>
                <option value="90">90 minutes</option>
              </select>
            </div>

            <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
              <div className="flex items-start gap-2">
                <Video className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                <div className="text-sm text-blue-700">
                  <p className="font-medium">Google Meet link will be auto-generated</p>
                  <p className="mt-1 text-xs">A Google Calendar invite with accept/decline will be sent to the employee, manager, and you.</p>
                </div>
              </div>
            </div>

            {state.error && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                <p className="text-sm text-red-700">{state.error}</p>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {pending ? 'Scheduling...' : 'Schedule Meeting'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function MomFormPage({ meetingId, employeeName, onClose }: {
  meetingId: string; employeeName: string; onClose: () => void
}) {
  const [state, action, pending] = useActionState(submitMeetingMinutes, INITIAL)
  const [actionItems, setActionItems] = useState<ActionItem[]>([{ description: '', owner: '', deadline: '' }])

  if (state.error === null && state.data === null && !pending && state !== INITIAL) {
    setTimeout(onClose, 100)
  }

  function addActionItem() {
    setActionItems(prev => [...prev, { description: '', owner: '', deadline: '' }])
  }

  function updateActionItem(idx: number, field: keyof ActionItem, value: string) {
    setActionItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item))
  }

  function removeActionItem(idx: number) {
    setActionItems(prev => prev.filter((_, i) => i !== idx))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={onClose} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
          <ChevronRight className="h-4 w-4 rotate-180" /> Back to Meetings
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-6 py-5">
          <h2 className="text-lg font-semibold text-slate-900">Minutes of Meeting (MOM)</h2>
          <p className="text-sm text-slate-500 mt-1">Discussion with {employeeName}</p>
        </div>

        <form action={(formData) => {
          formData.set('action_items', JSON.stringify(actionItems.filter(a => a.description.trim())))
          action(formData)
        }}>
          <input type="hidden" name="meeting_id" value={meetingId} />

          <div className="px-6 py-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Key Discussion Points <span className="text-red-500">*</span></label>
              <textarea
                name="key_discussion_points"
                required
                rows={4}
                placeholder="Summarize the main topics discussed..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Employee&apos;s Strengths Highlighted <span className="text-red-500">*</span></label>
              <textarea
                name="strengths_highlighted"
                required
                rows={3}
                placeholder="Key strengths observed during the review period..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Areas for Improvement Discussed <span className="text-red-500">*</span></label>
              <textarea
                name="areas_for_improvement"
                required
                rows={3}
                placeholder="Improvement areas and development goals discussed..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Action Items */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Action Items</label>
              <div className="space-y-3">
                {actionItems.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-2 rounded-lg border border-slate-200 p-3">
                    <div className="flex-1 space-y-2">
                      <input
                        type="text"
                        value={item.description}
                        onChange={e => updateActionItem(idx, 'description', e.target.value)}
                        placeholder="Action item description"
                        className="w-full rounded border border-slate-200 px-2.5 py-2 text-sm"
                      />
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={item.owner}
                          onChange={e => updateActionItem(idx, 'owner', e.target.value)}
                          placeholder="Owner"
                          className="flex-1 rounded border border-slate-200 px-2.5 py-2 text-sm"
                        />
                        <input
                          type="date"
                          value={item.deadline}
                          onChange={e => updateActionItem(idx, 'deadline', e.target.value)}
                          className="rounded border border-slate-200 px-2.5 py-2 text-sm"
                        />
                      </div>
                    </div>
                    {actionItems.length > 1 && (
                      <button type="button" onClick={() => removeActionItem(idx)} className="text-slate-400 hover:text-red-500 mt-2">
                        <XCircle className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addActionItem}
                  className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  + Add action item
                </button>
              </div>
            </div>

            {/* Employee Agreement */}
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" name="employee_agreement" value="true" className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                <span className="text-sm text-slate-700">Employee agrees with the discussion points</span>
              </label>
            </div>

            {/* Concerns (HRBP + Manager only) */}
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
              <div className="flex items-start gap-2 mb-2">
                <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-800">Confidential — HRBP & Manager Only</p>
                  <p className="text-xs text-amber-600 mt-0.5">This section is NOT visible to the employee.</p>
                </div>
              </div>
              <textarea
                name="concerns_raised"
                rows={3}
                placeholder="Any concerns raised during the meeting (optional)..."
                className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2.5 text-sm focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
              />
            </div>

            {state.error && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                <p className="text-sm text-red-700">{state.error}</p>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {pending ? 'Submitting...' : 'Submit MOM & Complete Meeting'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ViewMomPage({ minutes, employeeName, onClose }: {
  minutes: MeetingMinutesData; employeeName: string; onClose: () => void
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={onClose} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
          <ChevronRight className="h-4 w-4 rotate-180" /> Back to Meetings
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-6 py-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Minutes of Meeting</h2>
            <p className="text-sm text-slate-500 mt-1">{employeeName} &middot; {new Date(minutes.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
          </div>
        </div>

        <div className="px-6 py-6 space-y-5">
          <MomSection title="Key Discussion Points" content={minutes.key_discussion_points} />
          <MomSection title="Employee's Strengths" content={minutes.strengths_highlighted} />
          <MomSection title="Areas for Improvement" content={minutes.areas_for_improvement} />

          {minutes.action_items.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-slate-700 mb-2">Action Items</h4>
              <div className="space-y-1.5">
                {minutes.action_items.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-2 rounded-lg bg-slate-50 border border-slate-100 p-2.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-indigo-500 mt-0.5 shrink-0" />
                    <div className="text-sm">
                      <p className="text-slate-700">{item.description}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Owner: {item.owner}{item.deadline ? ` · Due: ${new Date(item.deadline).toLocaleDateString('en-IN')}` : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            {minutes.employee_agreement ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-medium text-emerald-700">
                <CheckCircle2 className="h-3 w-3" /> Employee agrees
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-xs font-medium text-amber-700">
                <AlertCircle className="h-3 w-3" /> Employee disagreed
              </span>
            )}
          </div>

          {minutes.concerns_raised && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
              <div className="flex items-start gap-2 mb-1">
                <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-xs font-medium text-amber-800">Confidential Concerns (HRBP & Manager only)</p>
              </div>
              <p className="text-sm text-amber-900 whitespace-pre-wrap ml-6">{minutes.concerns_raised}</p>
            </div>
          )}
        </div>

        <div className="flex justify-end px-6 py-4 border-t border-slate-100">
          <button onClick={onClose} className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm text-slate-600 hover:bg-slate-50">
            Back to Meetings
          </button>
        </div>
      </div>
    </div>
  )
}

function ReschedulePage({ meetingId, employeeName, currentTime, onClose }: {
  meetingId: string; employeeName: string; currentTime: string; onClose: () => void
}) {
  const [state, action, pending] = useActionState(rescheduleMeeting, INITIAL)

  if (state.error === null && state.data === null && !pending && state !== INITIAL) {
    setTimeout(onClose, 100)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={onClose} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
          <ChevronRight className="h-4 w-4 rotate-180" /> Back to Meetings
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white max-w-lg">
        <div className="border-b border-slate-100 px-6 py-5">
          <h2 className="text-lg font-semibold text-slate-900">Reschedule Meeting</h2>
          <p className="text-sm text-slate-500 mt-1">For {employeeName}</p>
        </div>

        <form action={action}>
          <input type="hidden" name="meeting_id" value={meetingId} />

          <div className="px-6 py-6 space-y-5">
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-4">
              <p className="text-xs text-slate-500">Currently scheduled</p>
              <p className="text-sm font-medium text-slate-700 mt-1">
                {new Date(currentTime).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}{' '}
                at {new Date(currentTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">New Date & Time</label>
              <input
                type="datetime-local"
                name="scheduled_at"
                required
                min={new Date().toISOString().slice(0, 16)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Duration (minutes)</label>
              <select
                name="duration_minutes"
                defaultValue="60"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              >
                <option value="30">30 minutes</option>
                <option value="45">45 minutes</option>
                <option value="60">60 minutes</option>
                <option value="90">90 minutes</option>
              </select>
            </div>

            <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
              <div className="flex items-start gap-2">
                <RefreshCw className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                <div className="text-sm text-blue-700">
                  <p className="font-medium">Old calendar event will be cancelled</p>
                  <p className="mt-1 text-xs">A new Google Calendar invite with Google Meet link will be sent to all participants.</p>
                </div>
              </div>
            </div>

            {state.error && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                <p className="text-sm text-red-700">{state.error}</p>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {pending ? 'Rescheduling...' : 'Reschedule Meeting'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function MomSection({ title, content }: { title: string; content: string }) {
  return (
    <div>
      <h4 className="text-sm font-medium text-slate-700 mb-1">{title}</h4>
      <p className="text-sm text-slate-600 whitespace-pre-wrap rounded-lg bg-slate-50 border border-slate-100 p-3">{content}</p>
    </div>
  )
}
