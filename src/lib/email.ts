import { Resend } from 'resend'

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
