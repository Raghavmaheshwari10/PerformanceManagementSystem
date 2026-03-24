import { Resend } from 'resend'
import { prisma } from '@/lib/prisma'
import type { NotificationType } from '@prisma/client'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  await resend.emails.send({
    from: process.env.EMAIL_FROM ?? 'noreply@example.com',
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

export async function sendNotificationEmail(to: string, subject: string, html: string): Promise<void> {
  await resend.emails.send({
    from: process.env.EMAIL_FROM ?? 'noreply@example.com',
    to,
    subject,
    html,
  })
}

const NOTIFICATION_SUBJECTS: Partial<Record<NotificationType, string>> = {
  cycle_kpi_setting_open: 'KPI Setting Phase is Open',
  cycle_self_review_open: 'Self Review Phase is Open',
  cycle_manager_review_open: 'Manager Review Phase is Open',
  cycle_published: 'Your Performance Results are Available',
  review_submitted: 'Employee Submitted Their Self-Review',
  manager_review_submitted: 'Your Manager Review Has Been Submitted',
  review_reminder: 'Reminder: Complete Your Pending Review',
  admin_message: 'Message from Admin',
}

const NOTIFICATION_HTML: Partial<Record<NotificationType, (payload: Record<string, string>) => string>> = {
  cycle_kpi_setting_open: () => '<p>The KPI setting phase has opened. Please log in to set your goals.</p>',
  cycle_self_review_open: () => '<p>The self-review phase has opened. Please log in to submit your self-review.</p>',
  cycle_manager_review_open: () => '<p>The manager review phase has opened. Please log in to review your team.</p>',
  cycle_published: () => '<p>Your performance results for this cycle are now available. Log in to view them.</p>',
  review_submitted: () => '<p>An employee has submitted their self-review and is awaiting your manager review.</p>',
  manager_review_submitted: () => '<p>Your manager has submitted their performance review.</p>',
  review_reminder: () => '<p>You have a pending review. Please complete it before the deadline.</p>',
  admin_message: (p) => `<p>${p.message ?? 'You have a message from the admin.'}</p>`,
}

/**
 * Dispatches pending in-app notifications as emails for a given recipient.
 * Fire-and-forget safe — catches and logs errors per notification.
 */
export async function dispatchPendingNotifications(recipientId: string): Promise<void> {
  const pending = await prisma.notification.findMany({
    where: { recipient_id: recipientId, status: 'pending' },
    include: { recipient: { select: { email: true } } },
    take: 10,
  })

  for (const notif of pending) {
    try {
      const subject = NOTIFICATION_SUBJECTS[notif.type] ?? 'hRMS Notification'
      const html = NOTIFICATION_HTML[notif.type]?.(notif.payload as Record<string, string> ?? {})
        ?? '<p>You have a new notification in hRMS.</p>'

      await sendNotificationEmail(notif.recipient.email, subject, html)

      await prisma.notification.update({
        where: { id: notif.id },
        data: { status: 'sent', sent_at: new Date() },
      })
    } catch (err) {
      await prisma.notification.update({
        where: { id: notif.id },
        data: { status: 'failed', error_message: String(err) },
      })
    }
  }
}
