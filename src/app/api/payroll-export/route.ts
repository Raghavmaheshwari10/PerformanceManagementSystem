import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { generatePayrollCsv } from '@/lib/payroll-csv'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  await requireRole(['hrbp', 'admin'])
  const { searchParams } = new URL(request.url)
  const cycleId = searchParams.get('cycle')
  if (!cycleId) return NextResponse.json({ error: 'cycle required' }, { status: 400 })

  const supabase = await createClient()

  const { data: cycle } = await supabase.from('cycles').select('status, name').eq('id', cycleId).single()
  if (!cycle || !['locked', 'published'].includes(cycle.status)) {
    return NextResponse.json({ error: 'Cycle must be locked or published' }, { status: 400 })
  }

  const { data: rows } = await supabase
    .from('appraisals')
    .select('final_rating, payout_multiplier, payout_amount, users!appraisals_employee_id_fkey(zimyo_id, full_name, department)')
    .eq('cycle_id', cycleId)

  const csvData = (rows ?? []).map((r: any) => ({
    zimyo_id: r.users.zimyo_id,
    full_name: r.users.full_name,
    department: r.users.department ?? '',
    final_rating: r.final_rating ?? '',
    payout_multiplier: r.payout_multiplier ?? 0,
    payout_amount: r.payout_amount ?? 0,
  }))

  const csv = generatePayrollCsv(csvData)
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="payroll-${cycle.name}.csv"`,
    },
  })
}
