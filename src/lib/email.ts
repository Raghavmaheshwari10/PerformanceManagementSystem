import { Resend } from 'resend'
import { prisma } from '@/lib/prisma'
import { sendSlackDM, buildSlackBlocks, isSlackConfigured } from '@/lib/slack'
import type { NotificationType } from '@prisma/client'

const resend = new Resend(process.env.RESEND_API_KEY)
const fromAddress = process.env.EMAIL_FROM ?? 'noreply@example.com'
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://hrms.emb.global'

// ─── Email Senders ───────────────────────────────────────────────────

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  await resend.emails.send({
    from: fromAddress,
    to,
    subject: 'Reset your password — hRMS',
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
    subject: 'You\'ve been invited to hRMS — Set up your account',
    html: `
      <p>Hello ${fullName},</p>
      <p>You've been invited to the hRMS Performance Management System. Click below to set your password and get started:</p>
      <p><a href="${inviteUrl}" style="background:#4f46e5;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;font-weight:600">Set Up Your Account</a></p>
      <p>This invitation link expires in 72 hours.</p>
      <p>If you have questions, contact your HR administrator.</p>
    `,
  })
}

export async function sendNotificationEmail(to: string, subject: string, html: string): Promise<void> {
  await resend.emails.send({
    from: fromAddress,
    to,
    subject,
    html,
  })
}

// ─── Notification Templates ──────────────────────────────────────────

const NOTIFICATION_SUBJECTS: Partial<Record<NotificationType, string>> = {
  cycle_kpi_setting_open: 'KPI Setting Phase is Open',
  cycle_self_review_open: 'Self Review Phase is Open',
  cycle_manager_review_open: 'Manager Review Phase is Open',
  cycle_published: 'Your Performance Results are Available',
  review_submitted: 'Employee Submitted Their Self-Review',
  manager_review_submitted: 'Your Manager Review Has Been Submitted',
  review_reminder: 'Reminder: Complete Your Pending Review',
  admin_message: 'Message from Admin',
  peer_review_requested: 'Peer Review Requested',
  peer_review_submitted: 'A Peer Has Submitted Their Review',
}

const NOTIFICATION_HTML: Partial<Record<NotificationType, (payload: Record<string, string>) => string>> = {
  cycle_kpi_setting_open: (p) => `<p>The KPI setting phase has opened${p.cycle_name ? ` for <strong>${p.cycle_name}</strong>` : ''}. Please log in to set KRAs and KPIs for your team.</p>`,
  cycle_self_review_open: (p) => `<p>The self-review phase is open${p.cycle_name ? ` for <strong>${p.cycle_name}</strong>` : ''}. Please submit your self-review${p.deadline ? ` by ${p.deadline}` : ''}.</p>`,
  cycle_manager_review_open: (p) => `<p>Manager reviews are open${p.cycle_name ? ` for <strong>${p.cycle_name}</strong>` : ''}. Please review your direct reports${p.deadline ? ` by ${p.deadline}` : ''}.</p>`,
  cycle_published: (p) => `<p>Your performance results${p.cycle_name ? ` for <strong>${p.cycle_name}</strong>` : ''} are now available. Log in to view your rating and payout.</p>`,
  review_submitted: (p) => `<p>${p.employee_name ?? 'An employee'} has submitted their self-review and is awaiting your manager review.</p>`,
  manager_review_submitted: () => '<p>Your manager has submitted their performance review for you.</p>',
  review_reminder: (p) => `<p>You have a pending ${p.kind === 'manager_review' ? 'manager' : 'self'} review. Please complete it before the deadline.</p>`,
  admin_message: (p) => `<p>${p.message ?? 'You have a message from the admin.'}</p>${p.link ? `<p><a href="${p.link}">View details</a></p>` : ''}`,
  peer_review_requested: (p) => `<p>${p.requester_name ?? 'A colleague'} has requested you to provide a peer review${p.reviewee_name ? ` for <strong>${p.reviewee_name}</strong>` : ''}. Please log in to accept or decline.</p>`,
  peer_review_submitted: (p) => `<p>${p.peer_name ?? 'A peer'} has submitted their peer review for you${p.cycle_name ? ` in <strong>${p.cycle_name}</strong>` : ''}.</p>`,
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
  peer_review_requested: (p) => ({ title: 'Peer Review Requested', body: `${p.requester_name ?? 'A colleague'} has requested you to provide a peer review${p.reviewee_name ? ` for *${p.reviewee_name}*` : ''}. Accept or decline in hRMS.`, link: `${appUrl}/employee/peer-reviews` }),
  peer_review_submitted: (p) => ({ title: 'Peer Review Submitted', body: `${p.peer_name ?? 'A peer'} has submitted their peer review for you.`, link: `${appUrl}/employee/peer-reviews` }),
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
        const subject = NOTIFICATION_SUBJECTS[notif.type] ?? 'hRMS Notification'
        const html = NOTIFICATION_HTML[notif.type]?.(payload)
          ?? '<p>You have a new notification in hRMS.</p>'
        await sendNotificationEmail(notif.recipient.email, subject, html)
      }

      // Send Slack DM
      if (isSlackConfigured() && notif.recipient.slack_user_id) {
        const slackData = NOTIFICATION_SLACK[notif.type]?.(payload)
        if (slackData) {
          const blocks = buildSlackBlocks(slackData.title, slackData.body, slackData.link)
          await sendSlackDM(notif.recipient.slack_user_id, slackData.body, blocks)
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
