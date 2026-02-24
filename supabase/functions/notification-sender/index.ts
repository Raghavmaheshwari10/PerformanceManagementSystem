import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const TEMPLATES: Record<string, { subject: string; bodyFn: (payload: any) => string }> = {
  cycle_kpi_setting_open: {
    subject: 'KPI Setting is Open',
    bodyFn: (p) => `Hi, the KPI setting phase for ${p.cycle_name ?? 'the current cycle'} is now open. Please set KPIs for your direct reports.`,
  },
  cycle_self_review_open: {
    subject: 'Self Review is Open',
    bodyFn: (p) => `Hi, self-review for ${p.cycle_name ?? 'the current cycle'} is now open. Please submit your self-assessment.`,
  },
  cycle_manager_review_open: {
    subject: 'Manager Review is Open',
    bodyFn: (p) => `Hi, the manager review phase for ${p.cycle_name ?? 'the current cycle'} is now open. Please submit ratings for your direct reports.`,
  },
  cycle_published: {
    subject: 'Review Cycle Results Published',
    bodyFn: (p) => `Hi, the results for ${p.cycle_name ?? 'the current cycle'} have been published. Log in to view your final rating.`,
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
    if (!template) continue

    const email = (n as any).users?.email
    if (!email) continue

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'PMS <noreply@yourdomain.com>',
          to: [email],
          subject: template.subject,
          text: template.bodyFn(n.payload ?? {}),
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
