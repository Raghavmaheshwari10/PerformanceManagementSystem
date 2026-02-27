import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const TEMPLATES: Record<string, { subject: string; bodyFn: (payload: any, recipientName: string) => string }> = {
  cycle_kpi_setting_open: {
    subject: 'KPI Setting is Open',
    bodyFn: (p, name) => `Hi ${name},\n\nThe KPI setting phase for ${p.cycle_name ?? 'the current cycle'} is now open. Please set KPIs for your direct reports.\n\nThank you.`,
  },
  cycle_self_review_open: {
    subject: 'Self Review is Open',
    bodyFn: (p, name) => `Hi ${name},\n\nSelf-review for ${p.cycle_name ?? 'the current cycle'} is now open. Please submit your self-assessment.\n\nThank you.`,
  },
  cycle_manager_review_open: {
    subject: 'Manager Review is Open',
    bodyFn: (p, name) => `Hi ${name},\n\nThe manager review phase for ${p.cycle_name ?? 'the current cycle'} is now open. Please submit ratings for your direct reports.\n\nThank you.`,
  },
  cycle_published: {
    subject: 'Review Cycle Results Published',
    bodyFn: (p, name) => `Hi ${name},\n\nThe results for ${p.cycle_name ?? 'the current cycle'} have been published. Please log in to view your final rating and payout details.\n\nThank you.`,
  },
  review_submitted: {
    subject: 'Employee Submitted Self-Review',
    bodyFn: (p, name) => `Hi ${name},\n\nAn employee has submitted their self-review for the current cycle. Please log in to review their submission.\n\nThank you.`,
  },
  manager_review_submitted: {
    subject: 'Manager Submitted Rating',
    bodyFn: (p, name) => `Hi ${name},\n\nA manager has submitted a rating for an employee in the current cycle. Please log in to review it during calibration.\n\nThank you.`,
  },
}

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  const { data: notifications } = await supabase
    .from('notifications')
    .select('*, users!notifications_recipient_id_fkey(email, full_name)')
    .eq('status', 'pending')
    .limit(50)

  let sent = 0, failed = 0

  for (const n of notifications ?? []) {
    const template = TEMPLATES[n.type]
    if (!template) {
      // Unknown type — mark failed to avoid re-processing
      await supabase.from('notifications').update({ status: 'failed', error_message: `Unknown notification type: ${n.type}` }).eq('id', n.id)
      failed++
      continue
    }

    const email = (n as any).users?.email
    const recipientName = (n as any).users?.full_name ?? 'there'
    if (!email) {
      await supabase.from('notifications').update({ status: 'failed', error_message: 'Recipient email not found' }).eq('id', n.id)
      failed++
      continue
    }

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'PMS <noreply@yourdomain.com>',
          to: [email],
          subject: template.subject,
          text: template.bodyFn(n.payload ?? {}, recipientName),
        }),
      })

      if (res.ok) {
        await supabase.from('notifications').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', n.id)
        sent++
      } else {
        const errText = await res.text()
        await supabase.from('notifications').update({ status: 'failed', error_message: errText }).eq('id', n.id)
        failed++
      }
    } catch (err) {
      await supabase.from('notifications').update({ status: 'failed', error_message: String(err) }).eq('id', n.id)
      failed++
    }
  }

  return new Response(JSON.stringify({ sent, failed }), { headers: { 'Content-Type': 'application/json' } })
})
