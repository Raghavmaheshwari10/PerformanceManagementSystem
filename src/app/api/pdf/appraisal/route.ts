import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AppraisalDocument } from '@/components/pdf/appraisal-document'
import type { AppraisalPdfData } from '@/components/pdf/appraisal-document'
import type { RatingTier } from '@prisma/client'
import type { DocumentProps } from '@react-pdf/renderer'
import React from 'react'

/**
 * Map RatingTier enum to a numeric score (1–5 scale).
 * FEE=1, BE=2, ME=3, EE=4, SME=5
 */
function ratingTierToNumber(tier: RatingTier | null | undefined): number | null {
  if (tier == null) return null
  const map: Record<RatingTier, number> = {
    FEE: 1,
    BE: 2,
    ME: 3,
    EE: 4,
    SME: 5,
  }
  return map[tier] ?? null
}

export async function GET(req: NextRequest) {
  // 1. Auth
  let user: Awaited<ReturnType<typeof getCurrentUser>>
  try {
    user = await getCurrentUser()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Parse params
  const { searchParams } = req.nextUrl
  const cycleId    = searchParams.get('cycleId')
  const employeeId = searchParams.get('employeeId')
  if (!cycleId || !employeeId) {
    return NextResponse.json({ error: 'cycleId and employeeId are required' }, { status: 400 })
  }

  // 3. Role-based access control
  if (user.role === 'employee') {
    if (user.id !== employeeId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  } else if (user.role === 'hrbp') {
    const hrbpDepts = await prisma.hrbpDepartment.findMany({
      where: { hrbp_id: user.id },
      select: { department_id: true },
    })
    const deptIds = hrbpDepts.map(d => d.department_id)
    const emp = await prisma.user.findUnique({
      where: { id: employeeId },
      select: { department_id: true },
    })
    if (!emp || emp.department_id == null || !deptIds.includes(emp.department_id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  } else if (user.role === 'manager') {
    const emp = await prisma.user.findUnique({
      where: { id: employeeId },
      select: { manager_id: true },
    })
    if (!emp || emp.manager_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  } else if (user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 4. Fetch cycle (must be published for employees)
  const cycle = await prisma.cycle.findUnique({
    where: { id: cycleId },
    select: { name: true, status: true },
  })
  if (!cycle) return NextResponse.json({ error: 'Cycle not found' }, { status: 404 })
  if (user.role === 'employee' && cycle.status !== 'published') {
    return NextResponse.json({ error: 'Results not yet published' }, { status: 403 })
  }

  // 5. Fetch employee (with manager relation and department)
  const employee = await prisma.user.findUnique({
    where: { id: employeeId },
    select: {
      full_name:    true,
      designation:  true,
      emp_code:     true,
      department:   { select: { name: true } },
      manager:      { select: { full_name: true } },
    },
  })
  if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 })

  // 6. Fetch appraisal — note: no composite_score field; use mis_score as proxy
  const appraisal = await prisma.appraisal.findFirst({
    where: { cycle_id: cycleId, employee_id: employeeId },
    select: {
      final_rating:              true,
      payout_multiplier:         true,
      payout_amount:             true,
      snapshotted_variable_pay:  true,
      mis_score:                 true,
      competency_score:          true,
    },
  })

  // 7. Fetch KRAs with their nested KPIs
  const kras = await prisma.kra.findMany({
    where: { cycle_id: cycleId, employee_id: employeeId },
    select: {
      title:  true,
      weight: true,
      kpis: {
        select: {
          title:          true,
          unit:           true,
          target:         true,
          weight:         true,
          self_rating:    true,
          manager_rating: true,
        },
        orderBy: { created_at: 'asc' },
      },
    },
    orderBy: { sort_order: 'asc' },
  })

  // Fallback: if no KRAs, group all KPIs under a single "KPI Performance" heading
  let krasData: AppraisalPdfData['kras']
  if (kras.length > 0) {
    krasData = kras.map(kra => ({
      title:  kra.title,
      weight: kra.weight != null ? Number(kra.weight) : null,
      kpis:   kra.kpis.map(p => ({
        title:         p.title,
        unit:          p.unit ?? null,
        target:        p.target != null ? Number(p.target) : null,
        weight:        p.weight != null ? Number(p.weight) : null,
        selfRating:    ratingTierToNumber(p.self_rating),
        managerRating: ratingTierToNumber(p.manager_rating),
        score:         null, // Kpi model has no computed score field
      })),
    }))
  } else {
    // Fetch KPIs directly (no KRA grouping)
    const kpis = await prisma.kpi.findMany({
      where: { cycle_id: cycleId, employee_id: employeeId },
      select: {
        title:          true,
        unit:           true,
        target:         true,
        weight:         true,
        self_rating:    true,
        manager_rating: true,
      },
      orderBy: { created_at: 'asc' },
    })
    krasData = kpis.length > 0 ? [{
      title:  'KPI Performance',
      weight: null,
      kpis:   kpis.map(p => ({
        title:         p.title,
        unit:          p.unit ?? null,
        target:        p.target != null ? Number(p.target) : null,
        weight:        p.weight != null ? Number(p.weight) : null,
        selfRating:    ratingTierToNumber(p.self_rating),
        managerRating: ratingTierToNumber(p.manager_rating),
        score:         null,
      })),
    }] : []
  }

  // 8. Build PDF data
  const pdfData: AppraisalPdfData = {
    cycleName:      cycle.name,
    generatedAt:    new Date().toLocaleDateString('en-IN', {
      day: 'numeric', month: 'long', year: 'numeric',
    }),
    employee: {
      fullName:    employee.full_name,
      designation: employee.designation ?? null,
      department:  employee.department?.name ?? null,
      managerName: employee.manager?.full_name ?? null,
      empCode:     employee.emp_code ?? null,
    },
    kras:         krasData,
    competencies: [],
    // final_rating is a RatingTier enum (string), compatible with string | null
    finalRating:    appraisal?.final_rating ?? null,
    // Use mis_score as composite score proxy (no composite_score field in schema)
    compositeScore: appraisal?.mis_score != null ? Number(appraisal.mis_score) : null,
    variablePay:    appraisal?.snapshotted_variable_pay != null
      ? Number(appraisal.snapshotted_variable_pay)
      : 0,
    multiplier:     appraisal?.payout_multiplier != null
      ? Number(appraisal.payout_multiplier)
      : 0,
    payoutAmount:   appraisal?.payout_amount != null
      ? Number(appraisal.payout_amount)
      : 0,
  }

  // 9. Render PDF to buffer
  const buffer = await renderToBuffer(
    React.createElement(AppraisalDocument, { data: pdfData }) as React.ReactElement<DocumentProps>
  )

  const safeName  = employee.full_name.replace(/[^a-z0-9]/gi, '_').toLowerCase()
  const safeCycle = cycle.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="appraisal_${safeName}_${safeCycle}.pdf"`,
      'Cache-Control':       'private, no-store',
    },
  })
}
