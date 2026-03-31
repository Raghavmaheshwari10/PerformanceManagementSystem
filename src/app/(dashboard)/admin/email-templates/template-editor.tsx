'use client'

import { useActionState, useRef, useState } from 'react'
import { saveEmailTemplate, deleteEmailTemplate } from './actions'
import type { ActionResult } from '@/lib/types'

/** Default hardcoded templates — used as fallback when no DB override exists */
const DEFAULT_TEMPLATES: Record<string, { subject: string; html_body: string }> = {
  cycle_kpi_setting_open: {
    subject: 'KPI Setting Phase is Open',
    html_body: '<p>The KPI setting phase has opened{{#cycle_name}} for <strong>{{cycle_name}}</strong>{{/cycle_name}}. Please log in to set KRAs and KPIs for your team.</p>',
  },
  cycle_self_review_open: {
    subject: 'Self Review Phase is Open',
    html_body: '<p>The self-review phase is open{{#cycle_name}} for <strong>{{cycle_name}}</strong>{{/cycle_name}}. Please submit your self-review{{#deadline}} by {{deadline}}{{/deadline}}.</p>',
  },
  cycle_manager_review_open: {
    subject: 'Manager Review Phase is Open',
    html_body: '<p>Manager reviews are open{{#cycle_name}} for <strong>{{cycle_name}}</strong>{{/cycle_name}}. Please review your direct reports{{#deadline}} by {{deadline}}{{/deadline}}.</p>',
  },
  cycle_published: {
    subject: 'Your Performance Results are Available',
    html_body: '<p>Your performance results{{#cycle_name}} for <strong>{{cycle_name}}</strong>{{/cycle_name}} are now available. Log in to view your rating and payout.</p>',
  },
  review_submitted: {
    subject: 'Employee Submitted Their Self-Review',
    html_body: '<p>{{employee_name}} has submitted their self-review and is awaiting your manager review.</p>',
  },
  manager_review_submitted: {
    subject: 'Your Manager Review Has Been Submitted',
    html_body: '<p>Your manager has submitted their performance review for you.</p>',
  },
  review_reminder: {
    subject: 'Reminder: Complete Your Pending Review',
    html_body: '<p>You have a pending {{kind}} review. Please complete it before the deadline.</p>',
  },
  admin_message: {
    subject: 'Message from Admin',
    html_body: '<p>{{message}}</p>{{#link}}<p><a href="{{link}}">View details</a></p>{{/link}}',
  },
  peer_review_requested: {
    subject: 'Peer Review Requested',
    html_body: '<p>{{requester_name}} has requested you to provide a peer review{{#reviewee_name}} for <strong>{{reviewee_name}}</strong>{{/reviewee_name}}. Please log in to accept or decline.</p>',
  },
  peer_review_submitted: {
    subject: 'A Peer Has Submitted Their Review',
    html_body: '<p>{{peer_name}} has submitted their peer review for you{{#cycle_name}} in <strong>{{cycle_name}}</strong>{{/cycle_name}}.</p>',
  },
}

/** Available placeholder variables per notification type */
const AVAILABLE_VARIABLES: Record<string, string[]> = {
  cycle_kpi_setting_open: ['cycle_name', 'employee_name'],
  cycle_self_review_open: ['cycle_name', 'deadline', 'employee_name'],
  cycle_manager_review_open: ['cycle_name', 'deadline', 'employee_name'],
  cycle_published: ['cycle_name', 'employee_name'],
  review_submitted: ['employee_name', 'cycle_name'],
  manager_review_submitted: ['employee_name', 'cycle_name'],
  review_reminder: ['kind', 'employee_name', 'cycle_name'],
  admin_message: ['message', 'link'],
  peer_review_requested: ['requester_name', 'reviewee_name', 'cycle_name'],
  peer_review_submitted: ['peer_name', 'cycle_name'],
}

const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  cycle_kpi_setting_open: 'Cycle: KPI Setting Open',
  cycle_self_review_open: 'Cycle: Self Review Open',
  cycle_manager_review_open: 'Cycle: Manager Review Open',
  cycle_published: 'Cycle: Results Published',
  review_submitted: 'Review: Self-Review Submitted',
  manager_review_submitted: 'Review: Manager Review Submitted',
  review_reminder: 'Review: Reminder',
  admin_message: 'Admin: Custom Message',
  peer_review_requested: 'Peer Review: Requested',
  peer_review_submitted: 'Peer Review: Submitted',
}

export interface TemplateEditorProps {
  templates: Record<string, { subject: string; html_body: string; isCustom: boolean }>
}

const initialState: ActionResult = { data: null, error: null }

export function TemplateEditor({ templates }: TemplateEditorProps) {
  const [selectedType, setSelectedType] = useState<string | null>(null)
  const [subject, setSubject] = useState('')
  const [htmlBody, setHtmlBody] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  const [state, formAction, isPending] = useActionState(saveEmailTemplate, initialState)

  const allTypes = Object.keys(DEFAULT_TEMPLATES)

  function handleSelect(type: string) {
    setSelectedType(type)
    const tpl = templates[type]
    if (tpl) {
      setSubject(tpl.subject)
      setHtmlBody(tpl.html_body)
    } else {
      const def = DEFAULT_TEMPLATES[type]
      setSubject(def?.subject ?? '')
      setHtmlBody(def?.html_body ?? '')
    }
    setShowPreview(false)
  }

  function handleCancel() {
    setSelectedType(null)
    setSubject('')
    setHtmlBody('')
    setShowPreview(false)
  }

  /** Replace {{var}} placeholders with sample values for preview */
  function renderPreview(html: string): string {
    const sampleValues: Record<string, string> = {
      cycle_name: 'Q1 2026',
      deadline: 'March 31, 2026',
      employee_name: 'Jane Smith',
      kind: 'self',
      message: 'This is a sample admin message.',
      link: 'https://pms.emb.global',
      requester_name: 'John Doe',
      reviewee_name: 'Alice Johnson',
      peer_name: 'Bob Williams',
    }
    return html.replace(/\{\{(\w+)\}\}/g, (_, key) => sampleValues[key] ?? `[${key}]`)
  }

  async function handleDelete(type: string) {
    await deleteEmailTemplate(type)
    setDeleteConfirm(null)
    if (selectedType === type) handleCancel()
  }

  return (
    <div className="space-y-6">
      {/* Template list */}
      <div className="rounded-lg border divide-y">
        {allTypes.map(type => {
          const tpl = templates[type]
          const isCustom = tpl?.isCustom ?? false
          return (
            <div key={type} className="flex items-center justify-between px-4 py-3 gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium truncate">
                    {NOTIFICATION_TYPE_LABELS[type] ?? type}
                  </p>
                  {isCustom && (
                    <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-600">
                      Customized
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  Subject: {tpl?.subject ?? DEFAULT_TEMPLATES[type]?.subject}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {isCustom && deleteConfirm !== type && (
                  <button
                    type="button"
                    onClick={() => setDeleteConfirm(type)}
                    className="text-xs text-red-500 hover:text-red-600 transition-colors"
                  >
                    Reset
                  </button>
                )}
                {deleteConfirm === type && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleDelete(type)}
                      className="text-xs text-red-600 font-medium"
                    >
                      Confirm reset
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirm(null)}
                      className="text-xs text-muted-foreground"
                    >
                      Cancel
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => handleSelect(type)}
                  className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
                >
                  {selectedType === type ? 'Editing...' : isCustom ? 'Edit' : 'Customize'}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Editor panel */}
      {selectedType && (
        <div className="rounded-lg border p-5 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">
              {NOTIFICATION_TYPE_LABELS[selectedType] ?? selectedType}
            </h3>
            <button
              type="button"
              onClick={handleCancel}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Close
            </button>
          </div>

          {/* Available placeholders */}
          <div className="rounded-md bg-muted/50 p-3">
            <p className="text-xs font-medium mb-1.5">Available placeholders:</p>
            <div className="flex flex-wrap gap-1.5">
              {(AVAILABLE_VARIABLES[selectedType] ?? []).map(v => (
                <code
                  key={v}
                  className="rounded bg-background border px-1.5 py-0.5 text-[11px] font-mono cursor-pointer hover:bg-muted transition-colors"
                  onClick={() => {
                    setHtmlBody(prev => prev + `{{${v}}}`)
                  }}
                  title={`Click to insert {{${v}}}`}
                >
                  {'{{' + v + '}}'}
                </code>
              ))}
            </div>
          </div>

          <form ref={formRef} action={formAction} className="space-y-4">
            <input type="hidden" name="notification_type" value={selectedType} />

            <div>
              <label className="block text-sm font-medium mb-1">Subject</label>
              <input
                type="text"
                name="subject"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                placeholder="Email subject line..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">HTML Body</label>
              <textarea
                name="html_body"
                value={htmlBody}
                onChange={e => setHtmlBody(e.target.value)}
                rows={10}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono"
                placeholder="<p>Your email content here...</p>"
              />
            </div>

            {/* Preview toggle */}
            <div>
              <button
                type="button"
                onClick={() => setShowPreview(v => !v)}
                className="text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                {showPreview ? 'Hide Preview' : 'Show Preview'}
              </button>
              {showPreview && (
                <div className="mt-3 rounded-md border bg-white p-4">
                  <p className="text-xs text-muted-foreground mb-2 font-medium">
                    Subject: {renderPreview(subject)}
                  </p>
                  <div
                    className="prose prose-sm max-w-none text-foreground"
                    dangerouslySetInnerHTML={{ __html: renderPreview(htmlBody) }}
                  />
                </div>
              )}
            </div>

            {state.error && (
              <p className="text-sm text-red-500">{state.error}</p>
            )}
            {state.data === null && state.error === null && isPending === false && formRef.current?.getAttribute('data-submitted') === 'true' && (
              <p className="text-sm text-green-600">Template saved successfully.</p>
            )}

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={isPending}
                onClick={() => formRef.current?.setAttribute('data-submitted', 'true')}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isPending ? 'Saving...' : 'Save Template'}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
