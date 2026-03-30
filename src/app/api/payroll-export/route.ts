import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { getCycleDepartmentStatuses } from '@/lib/cycle-helpers'
import { generatePayrollCsv } from '@/lib/payroll-csv'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  await requireRole(['hrbp', 'admin'])
  const { searchParams } = new URL(request.url)
  const cycleId = searchParams.get('cycle')
  if (!cycleId) return NextResponse.json({ error: 'cycle required' }, { status: 400 })

  const cycle = await prisma.cycle.findUnique({
    where: { id: cycleId },
    select: { status: true, name: true },
  })
  if (!cycle) {
    return NextResponse.json({ error: 'Cycle not found' }, { status: 400 })
  }

  // For dept-scoped cycles, ALL departments must be locked or published
  const deptStatuses = await getCycleDepartmentStatuses(cycleId)
  if (deptStatuses.length > 0) {
    const allReady = deptStatuses.every(ds => ['locked', 'published'].includes(ds.status))
    if (!allReady) {
      return NextResponse.json({ error: 'All departments must be locked or published for payroll export' }, { status: 400 })
    }
  } else if (!['locked', 'published'].includes(cycle.status)) {
    return NextResponse.json({ error: 'Cycle must be locked or published' }, { status: 400 })
  }

  const appraisals = await prisma.appraisal.findMany({
    where: { cycle_id: cycleId },
    select: {
      final_rating: true,
      payout_multiplier: true,
      payout_amount: true,
      employee: {
        select: {
          zimyo_id: true,
          full_name: true,
          department: { select: { name: true } },
        },
      },
    },
  })

  const csvData = appraisals.map(r => ({
    zimyo_id: r.employee.zimyo_id,
    full_name: r.employee.full_name,
    department: r.employee.department?.name ?? '',
    final_rating: r.final_rating ?? '',
    payout_multiplier: Number(r.payout_multiplier ?? 0),
    payout_amount: Number(r.payout_amount ?? 0),
  }))

  const csv = generatePayrollCsv(csvData)
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="payroll-${cycle.name}.csv"`,
    },
  })
}
