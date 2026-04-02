import { Resend } from 'resend'
import { prisma } from '@/lib/prisma'
import { sendSlackDM, buildSlackBlocks, isSlackConfigured } from '@/lib/slack'
import type { NotificationType } from '@prisma/client'

const resend = new Resend(process.env.RESEND_API_KEY)
const fromAddress = process.env.EMAIL_FROM ?? 'noreply@example.com'
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://pms.emb.global'

// ─── Email Senders ───────────────────────────────────────────────────

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  await resend.emails.send({
    from: fromAddress,
    to,
    subject: 'Reset your password — PMS',
    html: `
      <p>Hello,</p>
      <p>You requested a password reset. Click the link below to set a new password:</p>
      <p><a href="${resetUrl}" style="background:#000;color:#fff;padding:10px 20px;text-decoration:none;border-radius:4px;display:inline-block">Reset Password</a></p>
      <p>This link expires in 1 hour.</p>
      <p>If you did not request this, you can safely ignore this email.</p>
    `,
  })
}

export async function sendInviteEmail(to: string, inviteUrl: string, fullName: string): Promise<void> {
  await resend.emails.send({
    from: fromAddress,
    to,
    subject: 'You\'ve been invited to PMS — Set up your account',
    html: `
      <p>Hello ${fullName},</p>
      <p>You've been invited to the PMS Performance Management System. Click below to set your password and get started:</p>
      <p><a href="${inviteUrl}" style="background:#4f46e5;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;font-weight:600">Set Up Your Account</a></p>
      <p>This invitation link expires in 72 hours.</p>
      <p>If you have questions, contact your HR administrator.</p>
    `,
  })
}

interface EmailAttachment {
  filename: string
  content: string // base64 or Buffer
  contentType?: string
}

export async function sendNotificationEmail(
  to: string,
  subject: string,
  html: string,
  attachments?: EmailAttachment[]
): Promise<void> {
  await resend.emails.send({
    from: fromAddress,
    to,
    subject,
    html,
    ...(attachments?.length ? {
      attachments: attachments.map(a => ({
        filename: a.filename,
        content: Buffer.from(a.content, 'utf-8'),
        contentType: a.contentType,
      })),
    } : {}),
  })
}

/**
 * Generate an .ics (iCalendar) file for a meeting.
 * When attached to an email, this shows accept/decline in email clients
 * and adds the event to the recipient's calendar.
 */
export function generateIcsContent(params: {
  summary: string
  description: string
  startTime: Date
  durationMinutes: number
  organizerEmail: string
  organizerName: string
  attendeeEmails: { email: string; name: string }[]
  meetLink?: string
  location?: string
}): string {
  const { summary, description, startTime, durationMinutes, organizerEmail, organizerName, attendeeEmails, meetLink } = params
  const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000)

  function formatDate(d: Date): string {
    return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  }

  const uid = `pms-meeting-${startTime.getTime()}@emb.global`
  const now = formatDate(new Date())
  const dtStart = formatDate(startTime)
  const dtEnd = formatDate(endTime)

  const attendeeLines = attendeeEmails.map(
    a => `ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE;CN=${a.name}:mailto:${a.email}`
  ).join('\r\n')

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PMS EMB Global//Performance Management System//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description.replace(/\n/g, '\\n')}`,
    `ORGANIZER;CN=${organizerName}:mailto:${organizerEmail}`,
    attendeeLines,
    meetLink ? `URL:${meetLink}` : '',
    meetLink ? `LOCATION:${meetLink}` : '',
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'BEGIN:VALARM',
    'TRIGGER:-PT15M',
    'ACTION:DISPLAY',
    'DESCRIPTION:Meeting in 15 minutes',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n')
}

// ─── Notification Templates ──────────────────────────────────────────

const NOTIFICATION_SUBJECTS: Partial<Record<NotificationType, string>> = {
  cycle_kpi_setting_open: 'Action Required: Set KPIs for Your Team',
  cycle_self_review_open: 'Time to Submit Your Self-Review',
  cycle_manager_review_open: 'Review Your Team',
  cycle_published: 'Your Performance Results Are Ready',
  review_submitted: 'Self-Review Submitted',
  manager_review_submitted: 'Your Manager Has Completed Your Review',
  review_reminder: 'Reminder: You Have a Pending Review',
  admin_message: 'Message from HR',
  peer_review_requested: 'Peer Review Requested',
  peer_review_submitted: 'A Peer Has Submitted Their Review',
  feedback_received: 'You Received New Feedback',
  meeting_scheduled: 'Review Discussion Meeting Scheduled',
  meeting_reminder: 'Reminder: Review Discussion Meeting Tomorrow',
  meeting_mom_submitted: 'Review Discussion Meeting Completed — MOM Available',
}

/** Branded email wrapper with header and footer */
function wrapEmail(body: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
<tr><td style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:24px 32px"><span style="color:#ffffff;font-size:18px;font-weight:700">PMS</span><span style="color:#c7d2fe;font-size:11px;margin-left:8px;text-transform:uppercase;letter-spacing:1px">EMB Global</span></td></tr>
<tr><td style="padding:32px">${body}</td></tr>
<tr><td style="background:#f8fafc;padding:20px 32px;border-top:1px solid #e2e8f0"><p style="color:#94a3b8;font-size:12px;margin:0;line-height:1.5">This is an automated message from the Performance Management System.<br>EMB Global &middot; <a href="${appUrl}" style="color:#6366f1;text-decoration:none">pms.emb.global</a></p></td></tr>
</table></td></tr></table></body></html>`
}

/** CTA button helper */
function ctaButton(text: string, href: string, color = '#4f46e5'): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0"><tr><td align="center"><a href="${href}" style="background:${color};color:#ffffff;padding:12px 32px;text-decoration:none;border-radius:8px;font-weight:600;display:inline-block">${text}</a></td></tr></table>`
}

const NOTIFICATION_HTML: Partial<Record<NotificationType, (payload: Record<string, string>) => string>> = {
  cycle_kpi_setting_open: (p) => wrapEmail(
    `<h2 style="color:#1e293b;margin:0 0 16px">KPI Setting Phase is Now Open</h2>
<p style="color:#475569;line-height:1.6">Hi${p.employee_name ? ` ${p.employee_name}` : ''},</p>
<p style="color:#475569;line-height:1.6">The <strong>KPI setting phase</strong> has started${p.cycle_name ? ` for <strong>${p.cycle_name}</strong>` : ''}. Please define KRAs and KPIs for your direct reports.</p>
${ctaButton('Set KPIs Now', `${appUrl}/manager`)}
<p style="color:#94a3b8;font-size:13px">Please complete this before the deadline. Your team is counting on you.</p>`
  ),
  cycle_self_review_open: (p) => wrapEmail(
    `<h2 style="color:#1e293b;margin:0 0 16px">Self-Review Phase is Open</h2>
<p style="color:#475569;line-height:1.6">Hi${p.employee_name ? ` ${p.employee_name}` : ''},</p>
<p style="color:#475569;line-height:1.6">The <strong>self-review phase</strong> is now open${p.cycle_name ? ` for <strong>${p.cycle_name}</strong>` : ''}. Please reflect on your performance and submit your self-assessment.</p>
${p.deadline ? `<div style="background:#f1f5f9;border-radius:8px;padding:16px;margin:16px 0"><p style="color:#475569;margin:0;font-size:14px"><strong>Deadline:</strong> ${p.deadline}</p></div>` : ''}
${ctaButton('Start Self-Review', `${appUrl}/employee`)}
<p style="color:#94a3b8;font-size:13px">Your self-review helps your manager understand your perspective.</p>`
  ),
  cycle_manager_review_open: (p) => wrapEmail(
    `<h2 style="color:#1e293b;margin:0 0 16px">Manager Review Phase is Open</h2>
<p style="color:#475569;line-height:1.6">Hi${p.employee_name ? ` ${p.employee_name}` : ''},</p>
<p style="color:#475569;line-height:1.6">It's time to review your direct reports${p.cycle_name ? ` for <strong>${p.cycle_name}</strong>` : ''}. Please review each team member's self-assessment, rate their KPIs, and provide constructive feedback.</p>
${p.deadline ? `<div style="background:#f1f5f9;border-radius:8px;padding:16px;margin:16px 0"><p style="color:#475569;margin:0;font-size:14px"><strong>Deadline:</strong> ${p.deadline}</p></div>` : ''}
${ctaButton('Review My Team', `${appUrl}/manager`)}`
  ),
  cycle_published: (p) => wrapEmail(
    `<h2 style="color:#1e293b;margin:0 0 16px">Your Results Are In</h2>
<p style="color:#475569;line-height:1.6">Hi${p.employee_name ? ` ${p.employee_name}` : ''},</p>
<p style="color:#475569;line-height:1.6">Your performance results${p.cycle_name ? ` for <strong>${p.cycle_name}</strong>` : ''} have been published. You can now view your final rating, feedback, and payout information.</p>
${ctaButton('View My Results', `${appUrl}/employee`, '#059669')}
<p style="color:#94a3b8;font-size:13px">If you have questions about your review, please reach out to your manager or HR.</p>`
  ),
  review_submitted: (p) => wrapEmail(
    `<h2 style="color:#1e293b;margin:0 0 16px">Self-Review Submitted</h2>
<p style="color:#475569;line-height:1.6"><strong>${p.employee_name ?? 'An employee'}</strong> has submitted their self-review${p.cycle_name ? ` for <strong>${p.cycle_name}</strong>` : ''} and is waiting for your manager review.</p>
${ctaButton('Review Now', `${appUrl}/manager`)}`
  ),
  manager_review_submitted: (p) => wrapEmail(
    `<h2 style="color:#1e293b;margin:0 0 16px">Manager Review Complete</h2>
<p style="color:#475569;line-height:1.6">Hi${p.employee_name ? ` ${p.employee_name}` : ''},</p>
<p style="color:#475569;line-height:1.6">Your manager has submitted their performance review for you${p.cycle_name ? ` in <strong>${p.cycle_name}</strong>` : ''}. Your results will be available once the calibration and publishing process is complete.</p>
<p style="color:#94a3b8;font-size:13px">No action is needed from you at this time.</p>`
  ),
  review_reminder: (p) => wrapEmail(
    `<h2 style="color:#1e293b;margin:0 0 16px">Don't Forget Your Review</h2>
<p style="color:#475569;line-height:1.6">Hi${p.employee_name ? ` ${p.employee_name}` : ''},</p>
<p style="color:#475569;line-height:1.6">You have a pending <strong>${p.kind === 'manager_review' ? 'manager' : 'self'} review</strong>${p.cycle_name ? ` for <strong>${p.cycle_name}</strong>` : ''} that hasn't been completed yet.</p>
${ctaButton('Complete Review', `${appUrl}`, '#d97706')}
<p style="color:#94a3b8;font-size:13px">Timely reviews help keep the process fair for everyone.</p>`
  ),
  admin_message: (p) => wrapEmail(
    `<h2 style="color:#1e293b;margin:0 0 16px">Message from HR</h2>
<p style="color:#475569;line-height:1.6">${p.message ?? 'You have a message from the admin.'}</p>
${p.link ? ctaButton('View Details', p.link) : ''}`
  ),
  peer_review_requested: (p) => wrapEmail(
    `<h2 style="color:#1e293b;margin:0 0 16px">Peer Review Requested</h2>
<p style="color:#475569;line-height:1.6">${p.requester_name ?? 'A colleague'} has requested you to provide a peer review${p.reviewee_name ? ` for <strong>${p.reviewee_name}</strong>` : ''}.</p>
${ctaButton('View Request', `${appUrl}/employee/peer-reviews`)}`
  ),
  peer_review_submitted: (p) => wrapEmail(
    `<h2 style="color:#1e293b;margin:0 0 16px">Peer Review Submitted</h2>
<p style="color:#475569;line-height:1.6">${p.peer_name ?? 'A peer'} has submitted their peer review for you${p.cycle_name ? ` in <strong>${p.cycle_name}</strong>` : ''}.</p>`
  ),
  feedback_received: (p) => wrapEmail(
    `<h2 style="color:#1e293b;margin:0 0 16px">You Received New Feedback</h2>
<p style="color:#475569;line-height:1.6">A colleague has shared <strong>${p.category ?? ''}</strong> feedback with you.</p>
${ctaButton('View Feedback', `${appUrl}/employee/feedback`)}
<p style="color:#94a3b8;font-size:13px">Feedback helps you grow. Check it out when you have a moment.</p>`
  ),
  meeting_scheduled: (p) => wrapEmail(
    `<h2 style="color:#1e293b;margin:0 0 16px">Review Discussion Meeting Scheduled</h2>
<p style="color:#475569;line-height:1.6">A review discussion meeting has been scheduled${p.employee_name ? ` for <strong>${p.employee_name}</strong>` : ''}${p.cycle_name ? ` in <strong>${p.cycle_name}</strong>` : ''}.</p>
<div style="background:#f1f5f9;border-radius:8px;padding:16px;margin:16px 0">
<p style="color:#475569;margin:0 0 8px;font-size:14px"><strong>When:</strong> ${p.scheduled_at ? new Date(p.scheduled_at).toLocaleString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'TBD'}</p>
<p style="color:#475569;margin:0 0 8px;font-size:14px"><strong>Organized by:</strong> ${p.hrbp_name ?? 'HRBP'}</p>
<p style="color:#475569;margin:0;font-size:14px"><strong>Participants:</strong> Employee, Manager, and HRBP</p>
</div>
${p.meet_link ? ctaButton('Join Google Meet', p.meet_link, '#1a73e8') : ''}
<div style="background:#eff6ff;border-radius:8px;padding:12px 16px;margin:16px 0;border:1px solid #bfdbfe">
<p style="color:#1e40af;margin:0;font-size:13px">📅 A calendar invite (.ics) is attached to this email. Open it to add the meeting to your calendar with accept/decline.</p>
</div>
<p style="color:#94a3b8;font-size:13px">Please come prepared with your self-assessment and goals. This discussion is a mandatory step before the manager review.</p>`
  ),
  meeting_reminder: (p) => wrapEmail(
    `<h2 style="color:#1e293b;margin:0 0 16px">Reminder: Review Discussion Tomorrow</h2>
<p style="color:#475569;line-height:1.6">You have a review discussion meeting scheduled for tomorrow${p.employee_name ? ` regarding <strong>${p.employee_name}</strong>` : ''}.</p>
${p.meet_link ? ctaButton('Join Google Meet', p.meet_link, '#1a73e8') : ''}
<p style="color:#94a3b8;font-size:13px">Please be on time and come prepared.</p>`
  ),
  meeting_mom_submitted: (p) => wrapEmail(
    `<h2 style="color:#1e293b;margin:0 0 16px">Discussion Meeting Completed</h2>
<p style="color:#475569;line-height:1.6">The review discussion meeting${p.employee_name ? ` for <strong>${p.employee_name}</strong>` : ''}${p.cycle_name ? ` in <strong>${p.cycle_name}</strong>` : ''} has been completed and the Minutes of Meeting (MOM) have been submitted by ${p.hrbp_name ?? 'the HRBP'}.</p>
<div style="background:#ecfdf5;border-radius:8px;padding:16px;margin:16px 0;border:1px solid #a7f3d0">
<p style="color:#065f46;margin:0;font-size:14px;font-weight:600">✓ Manager review is now unlocked</p>
</div>
${ctaButton('View Details', `${appUrl}/employee`, '#059669')}
<p style="color:#94a3b8;font-size:13px">The MOM captures the key discussion points and action items from the meeting.</p>`
  ),
}

const NOTIFICATION_SLACK: Partial<Record<NotificationType, (payload: Record<string, string>) => { title: string; body: string; link?: string }>> = {
  cycle_kpi_setting_open: (p) => ({ title: 'KPI Setting Phase Open', body: `The KPI setting phase has started${p.cycle_name ? ` for *${p.cycle_name}*` : ''}. Set KRAs and KPIs for your team.`, link: `${appUrl}/manager` }),
  cycle_self_review_open: (p) => ({ title: 'Self Review Phase Open', body: `Time to submit your self-review${p.cycle_name ? ` for *${p.cycle_name}*` : ''}${p.deadline ? `. Deadline: ${p.deadline}` : ''}.`, link: `${appUrl}/employee` }),
  cycle_manager_review_open: (p) => ({ title: 'Manager Review Phase Open', body: `Manager reviews are open${p.cycle_name ? ` for *${p.cycle_name}*` : ''}. Review your direct reports.`, link: `${appUrl}/manager` }),
  cycle_published: (p) => ({ title: 'Results Published', body: `Your performance results${p.cycle_name ? ` for *${p.cycle_name}*` : ''} are now available!`, link: `${appUrl}/employee` }),
  review_submitted: (p) => ({ title: 'Self-Review Submitted', body: `${p.employee_name ?? 'An employee'} has submitted their self-review.`, link: `${appUrl}/manager` }),
  manager_review_submitted: () => ({ title: 'Manager Review Done', body: 'Your manager has submitted their review for you.', link: `${appUrl}/employee` }),
  review_reminder: (p) => ({ title: 'Review Reminder', body: `You have a pending ${p.kind === 'manager_review' ? 'manager' : 'self'} review. Please complete it soon.`, link: `${appUrl}` }),
  admin_message: (p) => ({ title: 'Admin Message', body: p.message ?? 'You have a new message.', link: p.link }),
  peer_review_requested: (p) => ({ title: 'Peer Review Requested', body: `${p.requester_name ?? 'A colleague'} requested a peer review${p.reviewee_name ? ` for *${p.reviewee_name}*` : ''}.`, link: `${appUrl}/employee/peer-reviews` }),
  peer_review_submitted: (p) => ({ title: 'Peer Review Submitted', body: `${p.peer_name ?? 'A peer'} has submitted their peer review for you.`, link: `${appUrl}/employee/peer-reviews` }),
  feedback_received: (p) => ({ title: 'New Feedback Received', body: `A colleague shared *${p.category ?? ''}* feedback with you.`, link: `${appUrl}/employee/feedback` }),
  meeting_scheduled: (p) => ({ title: 'Discussion Meeting Scheduled', body: `A review discussion meeting has been scheduled${p.employee_name ? ` for *${p.employee_name}*` : ''}${p.scheduled_at ? ` on ${new Date(p.scheduled_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}.`, link: p.meet_link }),
  meeting_reminder: (p) => ({ title: 'Meeting Tomorrow', body: `Reminder: You have a review discussion meeting tomorrow${p.employee_name ? ` regarding *${p.employee_name}*` : ''}.`, link: p.meet_link }),
  meeting_mom_submitted: (p) => ({ title: 'Meeting MOM Submitted', body: `The review discussion${p.employee_name ? ` for *${p.employee_name}*` : ''} is complete. Manager review is now unlocked.`, link: `${appUrl}/employee` }),
}

// ─── Unified Notification Dispatcher ─────────────────────────────────

/**
 * Dispatches pending notifications for a user via email + Slack.
 * Respects user notification preferences if set.
 * Fire-and-forget safe — catches and logs errors.
 */
export async function dispatchPendingNotifications(recipientId: string): Promise<void> {
  const pending = await prisma.notification.findMany({
    where: { recipient_id: recipientId, status: 'pending' },
    include: {
      recipient: {
        select: { email: true, full_name: true, slack_user_id: true },
      },
    },
    take: 10,
  })

  // Check user preferences (if configured)
  const prefs = await prisma.notificationPreference.findMany({
    where: { user_id: recipientId },
  })
  const prefMap = new Map(prefs.map(p => [p.notify_key, p]))

  for (const notif of pending) {
    try {
      const payload = (notif.payload as Record<string, string>) ?? {}
      const pref = prefMap.get(notif.type)
      const emailEnabled = pref?.email_enabled ?? true
      const inAppEnabled = pref?.in_app_enabled ?? true

      // Send email
      if (emailEnabled) {
        // Check for admin-customised template in DB first
        const customTemplate = await prisma.emailTemplate.findUnique({
          where: { notification_type: notif.type },
        })

        let subject: string
        let html: string

        if (customTemplate) {
          subject = customTemplate.subject.replace(
            /\{\{(\w+)\}\}/g,
            (_, key) => payload[key] ?? ''
          )
          html = customTemplate.html_body.replace(
            /\{\{(\w+)\}\}/g,
            (_, key) => payload[key] ?? ''
          )
        } else {
          subject = NOTIFICATION_SUBJECTS[notif.type] ?? 'PMS Notification'
          html = NOTIFICATION_HTML[notif.type]?.(payload)
            ?? '<p>You have a new notification in PMS.</p>'
        }

        // Attach .ics calendar invite for meeting notifications
        let attachments: EmailAttachment[] | undefined
        if (notif.type === 'meeting_scheduled' && payload.scheduled_at) {
          const startTime = new Date(payload.scheduled_at)
          const durationMinutes = Number(payload.duration_minutes || 60)
          const icsContent = generateIcsContent({
            summary: `Performance Discussion: ${payload.employee_name ?? 'Review Meeting'}`,
            description: `Review discussion meeting for ${payload.employee_name ?? 'employee'} — ${payload.cycle_name ?? 'Review Cycle'}.\n\nParticipants: Employee, Manager, and HRBP.\nPlease come prepared with your self-assessment and goals.`,
            startTime,
            durationMinutes,
            organizerEmail: payload.organizer_email ?? fromAddress,
            organizerName: payload.hrbp_name ?? 'HRBP',
            attendeeEmails: [{ email: notif.recipient.email, name: notif.recipient.full_name }],
            meetLink: payload.meet_link || undefined,
          })
          attachments = [{
            filename: 'meeting-invite.ics',
            content: icsContent,
            contentType: 'text/calendar; method=REQUEST',
          }]
        }

        await sendNotificationEmail(notif.recipient.email, subject, html, attachments)
      }

      // Send Slack DM
      if (isSlackConfigured()) {
        let slackId = notif.recipient.slack_user_id
        // Auto-resolve slack_user_id if not set
        if (!slackId) {
          const { lookupSlackUser } = await import('@/lib/slack')
          slackId = await lookupSlackUser(notif.recipient.email)
          if (slackId) {
            await prisma.user.update({
              where: { id: notif.recipient_id },
              data: { slack_user_id: slackId },
            }).catch(() => {})
          }
        }
        if (slackId) {
          const slackData = NOTIFICATION_SLACK[notif.type]?.(payload)
          if (slackData) {
            const blocks = buildSlackBlocks(slackData.title, slackData.body, slackData.link)
            await sendSlackDM(slackId, slackData.body, blocks)
          }
        }
      }

      await prisma.notification.update({
        where: { id: notif.id },
        data: { status: inAppEnabled ? 'sent' : 'sent', sent_at: new Date() },
      })
    } catch (err) {
      await prisma.notification.update({
        where: { id: notif.id },
        data: { status: 'failed', error_message: String(err) },
      }).catch(() => {})
    }
  }
}

// ─── Helper: Create + Dispatch ───────────────────────────────────────

/**
 * Create notification records and immediately dispatch them.
 * Use this instead of separate create + dispatch calls.
 */
export async function notifyUsers(
  recipientIds: string[],
  type: NotificationType,
  payload?: Record<string, string>
): Promise<void> {
  if (recipientIds.length === 0) return

  await prisma.notification.createMany({
    data: recipientIds.map(id => ({
      recipient_id: id,
      type,
      payload: payload ?? {},
    })),
  })

  // Dispatch in background (fire-and-forget)
  for (const id of recipientIds) {
    dispatchPendingNotifications(id).catch(console.error)
  }
}
