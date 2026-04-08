import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AopForm } from './aop-form'

/** Compute current fiscal year: if month >= April, FY starts this year; else last year */
function currentFiscalYear(): string {
  const now = new Date()
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
  return `FY${String(year).slice(2)}` // e.g. "FY25"
}

export default async function AdminAopPage(props: {
  searchParams: Promise<{ fy?: string; metric?: string }>
}) {
  await requireRole(['admin'])
  const searchParams = await props.searchParams

  const selectedFy = searchParams.fy || currentFiscalYear()
  const selectedMetric = searchParams.metric || 'delivered_revenue'

  const [departments, orgAops] = await Promise.all([
    prisma.department.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.orgAop.findMany({
      where: { fiscal_year: selectedFy },
      include: {
        department_aops: {
          include: { department: { select: { id: true, name: true } } },
          orderBy: { department: { name: 'asc' } },
        },
      },
      orderBy: { metric: 'asc' },
    }),
  ])

  // Serialize Decimal fields to numbers for client component
  const serializedOrgAops = orgAops.map((oa) => ({
    id: oa.id,
    fiscal_year: oa.fiscal_year,
    metric: oa.metric,
    annual_target: Number(oa.annual_target),
    apr: Number(oa.apr),
    may: Number(oa.may),
    jun: Number(oa.jun),
    jul: Number(oa.jul),
    aug: Number(oa.aug),
    sep: Number(oa.sep),
    oct: Number(oa.oct),
    nov: Number(oa.nov),
    dec: Number(oa.dec),
    jan: Number(oa.jan),
    feb: Number(oa.feb),
    mar: Number(oa.mar),
    department_aops: oa.department_aops.map((da) => ({
      id: da.id,
      org_aop_id: da.org_aop_id,
      department_id: da.department_id,
      department_name: da.department.name,
      annual_target: Number(da.annual_target),
      apr: Number(da.apr),
      may: Number(da.may),
      jun: Number(da.jun),
      jul: Number(da.jul),
      aug: Number(da.aug),
      sep: Number(da.sep),
      oct: Number(da.oct),
      nov: Number(da.nov),
      dec: Number(da.dec),
      jan: Number(da.jan),
      feb: Number(da.feb),
      mar: Number(da.mar),
    })),
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">AOP Targets</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Set org-level annual operating plan targets and cascade to departments
        </p>
      </div>

      <AopForm
        departments={departments}
        orgAops={serializedOrgAops}
        selectedFy={selectedFy}
        selectedMetric={selectedMetric}
      />
    </div>
  )
}
