'use client'

import { useActionState, useRef, useState } from 'react'
import { saveEmailTemplate, deleteEmailTemplate } from './actions'
import type { ActionResult } from '@/lib/types'
import { Eye, EyeOff, RotateCcw, Pencil, ChevronDown, ChevronUp } from 'lucide-react'

/** Grouped notification types by category */
const TEMPLATE_GROUPS = [
  {
    label: 'Cycle Transitions',
    description: 'Sent automatically when a cycle advances to a new stage',
    types: [
      'cycle_kpi_setting_open',
      'cycle_self_review_open',
      'cycle_manager_review_open',
      'cycle_published',
    ],
  },
  {
    label: 'Review Activity',
    description: 'Triggered when employees or managers submit reviews',
    types: [
      'review_submitted',
      'manager_review_submitted',
    ],
  },
  {
    label: 'Reminders & Messages',
    description: 'Manual reminders and admin messages',
    types: [
      'review_reminder',
      'admin_message',
    ],
  },
]

/** Default hardcoded templates — used as fallback when no DB override exists */
const DEFAULT_TEMPLATES: Record<string, { subject: string; html_body: string }> = {
  cycle_kpi_setting_open: {
    subject: 'Action Required: Set KPIs for Your Team — {{cycle_name}}',
    html_body: `<h2 style="color:#1e293b;margin:0 0 16px">KPI Setting Phase is Now Open</h2>
<p style="color:#475569;line-height:1.6">Hi {{employee_name}},</p>
<p style="color:#475569;line-height:1.6">The <strong>KPI setting phase</strong> has started for <strong>{{cycle_name}}</strong>. As a manager, you need to define KRAs and KPIs for each of your direct reports.</p>
<table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0"><tr><td align="center">
  <a href="{{link}}" style="background:#4f46e5;color:#ffffff;padding:12px 32px;text-decoration:none;border-radius:8px;font-weight:600;display:inline-block">Set KPIs Now</a>
</td></tr></table>
<p style="color:#94a3b8;font-size:13px">Please complete this before the deadline. Your team is counting on you.</p>`,
  },
  cycle_self_review_open: {
    subject: 'Time to Submit Your Self-Review — {{cycle_name}}',
    html_body: `<h2 style="color:#1e293b;margin:0 0 16px">Self-Review Phase is Open</h2>
<p style="color:#475569;line-height:1.6">Hi {{employee_name}},</p>
<p style="color:#475569;line-height:1.6">The <strong>self-review phase</strong> is now open for <strong>{{cycle_name}}</strong>. Please take time to reflect on your performance and submit your self-assessment.</p>
<div style="background:#f1f5f9;border-radius:8px;padding:16px;margin:16px 0">
  <p style="color:#475569;margin:0;font-size:14px"><strong>Deadline:</strong> {{deadline}}</p>
</div>
<table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0"><tr><td align="center">
  <a href="{{link}}" style="background:#4f46e5;color:#ffffff;padding:12px 32px;text-decoration:none;border-radius:8px;font-weight:600;display:inline-block">Start Self-Review</a>
</td></tr></table>
<p style="color:#94a3b8;font-size:13px">Your self-review helps your manager understand your perspective on your contributions.</p>`,
  },
  cycle_manager_review_open: {
    subject: 'Review Your Team — {{cycle_name}}',
    html_body: `<h2 style="color:#1e293b;margin:0 0 16px">Manager Review Phase is Open</h2>
<p style="color:#475569;line-height:1.6">Hi {{employee_name}},</p>
<p style="color:#475569;line-height:1.6">It's time to review your direct reports for <strong>{{cycle_name}}</strong>. Please review each team member's self-assessment, rate their KPIs, and provide constructive feedback.</p>
<div style="background:#f1f5f9;border-radius:8px;padding:16px;margin:16px 0">
  <p style="color:#475569;margin:0;font-size:14px"><strong>Deadline:</strong> {{deadline}}</p>
</div>
<table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0"><tr><td align="center">
  <a href="{{link}}" style="background:#4f46e5;color:#ffffff;padding:12px 32px;text-decoration:none;border-radius:8px;font-weight:600;display:inline-block">Review My Team</a>
</td></tr></table>`,
  },
  cycle_published: {
    subject: 'Your Performance Results Are Ready — {{cycle_name}}',
    html_body: `<h2 style="color:#1e293b;margin:0 0 16px">Your Results Are In</h2>
<p style="color:#475569;line-height:1.6">Hi {{employee_name}},</p>
<p style="color:#475569;line-height:1.6">Your performance results for <strong>{{cycle_name}}</strong> have been published. You can now view your final rating, detailed feedback, and payout information.</p>
<table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0"><tr><td align="center">
  <a href="{{link}}" style="background:#059669;color:#ffffff;padding:12px 32px;text-decoration:none;border-radius:8px;font-weight:600;display:inline-block">View My Results</a>
</td></tr></table>
<p style="color:#94a3b8;font-size:13px">If you have questions about your review, please reach out to your manager or HR.</p>`,
  },
  review_submitted: {
    subject: '{{employee_name}} Submitted Their Self-Review',
    html_body: `<h2 style="color:#1e293b;margin:0 0 16px">Self-Review Submitted</h2>
<p style="color:#475569;line-height:1.6"><strong>{{employee_name}}</strong> has submitted their self-review for <strong>{{cycle_name}}</strong> and is waiting for your manager review.</p>
<table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0"><tr><td align="center">
  <a href="{{link}}" style="background:#4f46e5;color:#ffffff;padding:12px 32px;text-decoration:none;border-radius:8px;font-weight:600;display:inline-block">Review Now</a>
</td></tr></table>`,
  },
  manager_review_submitted: {
    subject: 'Your Manager Has Completed Your Review — {{cycle_name}}',
    html_body: `<h2 style="color:#1e293b;margin:0 0 16px">Manager Review Complete</h2>
<p style="color:#475569;line-height:1.6">Hi {{employee_name}},</p>
<p style="color:#475569;line-height:1.6">Your manager has submitted their performance review for you in <strong>{{cycle_name}}</strong>. Your results will be available once the calibration and publishing process is complete.</p>
<p style="color:#94a3b8;font-size:13px">No action is needed from you at this time.</p>`,
  },
  review_reminder: {
    subject: 'Reminder: You Have a Pending Review',
    html_body: `<h2 style="color:#1e293b;margin:0 0 16px">Don't Forget Your Review</h2>
<p style="color:#475569;line-height:1.6">Hi {{employee_name}},</p>
<p style="color:#475569;line-height:1.6">You have a pending <strong>{{kind}}</strong> review for <strong>{{cycle_name}}</strong> that hasn't been completed yet. Please submit it before the deadline.</p>
<table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0"><tr><td align="center">
  <a href="{{link}}" style="background:#d97706;color:#ffffff;padding:12px 32px;text-decoration:none;border-radius:8px;font-weight:600;display:inline-block">Complete Review</a>
</td></tr></table>
<p style="color:#94a3b8;font-size:13px">Timely reviews help keep the process fair for everyone.</p>`,
  },
  admin_message: {
    subject: '{{subject}}',
    html_body: `<h2 style="color:#1e293b;margin:0 0 16px">Message from HR</h2>
<p style="color:#475569;line-height:1.6">{{message}}</p>
{{#link}}<table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0"><tr><td align="center">
  <a href="{{link}}" style="background:#4f46e5;color:#ffffff;padding:12px 32px;text-decoration:none;border-radius:8px;font-weight:600;display:inline-block">View Details</a>
</td></tr></table>{{/link}}`,
  },
}

/** Available placeholder variables per notification type */
const AVAILABLE_VARIABLES: Record<string, { key: string; desc: string }[]> = {
  cycle_kpi_setting_open: [
    { key: 'cycle_name', desc: 'Cycle name (e.g., Q1 2026)' },
    { key: 'employee_name', desc: 'Recipient name' },
    { key: 'link', desc: 'Link to portal' },
  ],
  cycle_self_review_open: [
    { key: 'cycle_name', desc: 'Cycle name' },
    { key: 'deadline', desc: 'Submission deadline' },
    { key: 'employee_name', desc: 'Recipient name' },
    { key: 'link', desc: 'Link to portal' },
  ],
  cycle_manager_review_open: [
    { key: 'cycle_name', desc: 'Cycle name' },
    { key: 'deadline', desc: 'Review deadline' },
    { key: 'employee_name', desc: 'Recipient name' },
    { key: 'link', desc: 'Link to portal' },
  ],
  cycle_published: [
    { key: 'cycle_name', desc: 'Cycle name' },
    { key: 'employee_name', desc: 'Recipient name' },
    { key: 'link', desc: 'Link to results' },
  ],
  review_submitted: [
    { key: 'employee_name', desc: 'Employee who submitted' },
    { key: 'cycle_name', desc: 'Cycle name' },
    { key: 'link', desc: 'Link to review' },
  ],
  manager_review_submitted: [
    { key: 'employee_name', desc: 'Recipient name' },
    { key: 'cycle_name', desc: 'Cycle name' },
  ],
  review_reminder: [
    { key: 'kind', desc: 'Review type (self/manager)' },
    { key: 'employee_name', desc: 'Recipient name' },
    { key: 'cycle_name', desc: 'Cycle name' },
    { key: 'link', desc: 'Link to pending review' },
  ],
  admin_message: [
    { key: 'message', desc: 'Message content' },
    { key: 'link', desc: 'Optional link' },
    { key: 'subject', desc: 'Custom subject' },
  ],
}

const NOTIFICATION_TYPE_LABELS: Record<string, { label: string; desc: string }> = {
  cycle_kpi_setting_open:    { label: 'KPI Setting Open',           desc: 'Sent to managers when cycle enters KPI setting' },
  cycle_self_review_open:    { label: 'Self-Review Open',           desc: 'Sent to employees when self-review phase starts' },
  cycle_manager_review_open: { label: 'Manager Review Open',        desc: 'Sent to managers when manager review phase starts' },
  cycle_published:           { label: 'Results Published',          desc: 'Sent to employees when results are published' },
  review_submitted:          { label: 'Self-Review Submitted',      desc: 'Sent to manager when employee submits self-review' },
  manager_review_submitted:  { label: 'Manager Review Submitted',   desc: 'Sent to employee when manager completes review' },
  review_reminder:           { label: 'Review Reminder',            desc: 'Manual reminder for pending reviews' },
  admin_message:             { label: 'Admin Message',              desc: 'Custom message sent by admin' },
}

/** Email wrapper with header and footer */
function wrapEmailHtml(body: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
  <!-- Header -->
  <tr><td style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:24px 32px">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td><span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.3px">EMB Global</span>
        <span style="color:#c7d2fe;font-size:11px;margin-left:8px;text-transform:uppercase;letter-spacing:1px">Performance Management</span></td>
    </tr></table>
  </td></tr>
  <!-- Body -->
  <tr><td style="padding:32px">
    ${body}
  </td></tr>
  <!-- Footer -->
  <tr><td style="background:#f8fafc;padding:20px 32px;border-top:1px solid #e2e8f0">
    <p style="color:#94a3b8;font-size:12px;margin:0;line-height:1.5">This is an automated message from the Performance Management System.<br>EMB Global &middot; <a href="https://pms.emb.global" style="color:#6366f1;text-decoration:none">pms.emb.global</a></p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
}

export interface TemplateEditorProps {
  templates: Record<string, { subject: string; html_body: string; isCustom: boolean }>
}

const initialState: ActionResult = { data: null, error: null }

/** Replace {{var}} placeholders with sample values for preview */
const SAMPLE_VALUES: Record<string, string> = {
  cycle_name: 'Q1 2026 Review',
  deadline: 'April 15, 2026',
  employee_name: 'Jane Smith',
  kind: 'self-review',
  message: 'Please complete your pending reviews at the earliest. The deadline is approaching.',
  link: 'https://pms.emb.global',
  subject: 'Important Update from HR',
  requester_name: 'John Doe',
  reviewee_name: 'Alice Johnson',
  peer_name: 'Bob Williams',
}

function renderPreview(text: string): string {
  return text
    .replace(/\{\{#\w+\}\}([\s\S]*?)\{\{\/\w+\}\}/g, '$1')
    .replace(/\{\{(\w+)\}\}/g, (_, key) => SAMPLE_VALUES[key] ?? `[${key}]`)
}

export function TemplateEditor({ templates }: TemplateEditorProps) {
  const [selectedType, setSelectedType] = useState<string | null>(null)
  const [subject, setSubject] = useState('')
  const [htmlBody, setHtmlBody] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    Object.fromEntries(TEMPLATE_GROUPS.map(g => [g.label, true]))
  )
  const [successMsg, setSuccessMsg] = useState('')
  const formRef = useRef<HTMLFormElement>(null)

  const [state, formAction, isPending] = useActionState(async (prev: ActionResult, fd: FormData) => {
    const result = await saveEmailTemplate(prev, fd)
    if (!result.error) {
      setSuccessMsg('Template saved successfully')
      setTimeout(() => setSuccessMsg(''), 3000)
    }
    return result
  }, initialState)

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
    setSuccessMsg('')
  }

  function handleCancel() {
    setSelectedType(null)
    setSubject('')
    setHtmlBody('')
    setShowPreview(false)
    setSuccessMsg('')
  }

  function handleResetToDefault(type: string) {
    const def = DEFAULT_TEMPLATES[type]
    if (def) {
      setSubject(def.subject)
      setHtmlBody(def.html_body)
    }
  }

  async function handleDelete(type: string) {
    await deleteEmailTemplate(type)
    setDeleteConfirm(null)
    if (selectedType === type) handleCancel()
  }

  function toggleGroup(label: string) {
    setExpandedGroups(prev => ({ ...prev, [label]: !prev[label] }))
  }

  return (
    <div className="space-y-6">
      {/* Template groups */}
      {TEMPLATE_GROUPS.map(group => (
        <div key={group.label} className="rounded-xl border overflow-hidden">
          <button
            onClick={() => toggleGroup(group.label)}
            className="w-full flex items-center justify-between px-5 py-4 bg-muted/30 hover:bg-muted/50 transition-colors"
          >
            <div className="text-left">
              <p className="text-sm font-semibold">{group.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{group.description}</p>
            </div>
            {expandedGroups[group.label]
              ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
              : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
            }
          </button>

          {expandedGroups[group.label] && (
            <div className="divide-y">
              {group.types.map(type => {
                const info = NOTIFICATION_TYPE_LABELS[type]
                const tpl = templates[type]
                const isCustom = tpl?.isCustom ?? false
                const isEditing = selectedType === type

                return (
                  <div key={type} className={`px-5 py-4 transition-colors ${isEditing ? 'bg-primary/5' : 'hover:bg-muted/10'}`}>
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{info?.label ?? type}</p>
                          {isCustom && (
                            <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                              Customized
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{info?.desc}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {isCustom && deleteConfirm !== type && (
                          <button
                            type="button"
                            onClick={() => setDeleteConfirm(type)}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-red-500 transition-colors"
                            title="Reset to default"
                          >
                            <RotateCcw className="h-3 w-3" />
                            Reset
                          </button>
                        )}
                        {deleteConfirm === type && (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleDelete(type)}
                              className="text-xs text-red-600 font-semibold hover:text-red-700"
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirm(null)}
                              className="text-xs text-muted-foreground hover:text-foreground"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => isEditing ? handleCancel() : handleSelect(type)}
                          className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                            isEditing
                              ? 'border-primary/30 bg-primary/10 text-primary'
                              : 'hover:bg-muted'
                          }`}
                        >
                          <Pencil className="h-3 w-3" />
                          {isEditing ? 'Editing' : 'Edit'}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ))}

      {/* Editor panel */}
      {selectedType && (
        <div className="rounded-xl border overflow-hidden">
          <div className="bg-muted/30 px-5 py-4 flex items-center justify-between border-b">
            <div>
              <h3 className="text-base font-semibold">
                {NOTIFICATION_TYPE_LABELS[selectedType]?.label ?? selectedType}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {NOTIFICATION_TYPE_LABELS[selectedType]?.desc}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleResetToDefault(selectedType)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                title="Reset editor to default template"
              >
                <RotateCcw className="h-3 w-3" />
                Default
              </button>
              <button
                type="button"
                onClick={() => setShowPreview(v => !v)}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                  showPreview ? 'border-primary/30 bg-primary/10 text-primary' : 'hover:bg-muted'
                }`}
              >
                {showPreview ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                {showPreview ? 'Hide Preview' : 'Preview'}
              </button>
            </div>
          </div>

          <div className="p-5 space-y-5">
            {/* Placeholders */}
            <div className="rounded-lg bg-muted/30 border p-4">
              <p className="text-xs font-semibold text-muted-foreground mb-2">Available placeholders — click to insert</p>
              <div className="flex flex-wrap gap-2">
                {(AVAILABLE_VARIABLES[selectedType] ?? []).map(v => (
                  <button
                    key={v.key}
                    type="button"
                    className="group flex items-center gap-1.5 rounded-md bg-background border px-2 py-1 text-xs hover:border-primary/50 hover:bg-primary/5 transition-colors"
                    onClick={() => setHtmlBody(prev => prev + `{{${v.key}}}`)}
                    title={v.desc}
                  >
                    <code className="font-mono text-[11px] text-primary/80 group-hover:text-primary">{'{{' + v.key + '}}'}</code>
                    <span className="text-muted-foreground text-[10px] hidden sm:inline">{v.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Preview */}
            {showPreview && (
              <div className="rounded-lg border overflow-hidden">
                <div className="bg-muted/30 px-4 py-2 border-b">
                  <p className="text-xs font-semibold text-muted-foreground">Email Preview (with sample data)</p>
                </div>
                <div className="p-4 bg-slate-100 dark:bg-slate-900">
                  <p className="text-xs text-muted-foreground mb-3">
                    <strong>Subject:</strong> {renderPreview(subject)}
                  </p>
                  <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm overflow-hidden">
                    <div
                      className="text-sm"
                      dangerouslySetInnerHTML={{ __html: wrapEmailHtml(renderPreview(htmlBody)) }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Form */}
            <form ref={formRef} action={formAction} className="space-y-4">
              <input type="hidden" name="notification_type" value={selectedType} />

              <div>
                <label className="block text-sm font-medium mb-1.5">Subject Line</label>
                <input
                  type="text"
                  name="subject"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
                  placeholder="Email subject line..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">Email Body (HTML)</label>
                <textarea
                  name="html_body"
                  value={htmlBody}
                  onChange={e => setHtmlBody(e.target.value)}
                  rows={14}
                  className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm font-mono leading-relaxed focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
                  placeholder="<p>Your email content here...</p>"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Emails are automatically wrapped with a branded EMB Global header and footer. You only need to write the body content.
                </p>
              </div>

              {state.error && (
                <div className="rounded-lg bg-red-500/10 border border-red-200 dark:border-red-900 px-4 py-3">
                  <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
                </div>
              )}
              {successMsg && (
                <div className="rounded-lg bg-green-500/10 border border-green-200 dark:border-green-900 px-4 py-3">
                  <p className="text-sm text-green-600 dark:text-green-400">{successMsg}</p>
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {isPending ? 'Saving...' : 'Save Template'}
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="rounded-lg border px-5 py-2.5 text-sm font-medium hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
