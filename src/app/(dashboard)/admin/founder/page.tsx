import { requireRole } from '@/lib/auth'
import { getFounderViewData } from '@/lib/db/aop'
import { prisma } from '@/lib/prisma'
import { FounderViewDashboard } from './founder-view-dashboard'

/** Compute current fiscal year label, e.g. "FY25" */
function currentFiscalYear(): string {
  const now = new Date()
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
  return `FY${String(year).slice(2)}`
}

export default async function FounderViewPage(props: {
  searchParams: Promise<{ fy?: string }>
}) {
  // Accessible by founder role, or admin/superadmin with is_founder flag (backwards compat)
  const user = await requireRole(['admin', 'founder'])
  const searchParams = await props.searchParams

  const selectedFy = searchParams.fy || currentFiscalYear()

  // Get all available fiscal years for the FY selector
  const allFys = await prisma.orgAop.findMany({
    select: { fiscal_year: true },
    distinct: ['fiscal_year'],
    orderBy: { fiscal_year: 'desc' },
  })
  const fiscalYears = allFys.map((r) => r.fiscal_year)
  if (!fiscalYears.includes(selectedFy)) fiscalYears.unshift(selectedFy)

  const data = await getFounderViewData(selectedFy)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Founder View</h1>
        <p className="text-sm text-white/50 mt-1">
          Org-wide AOP performance, team sizing, and CTC across all departments
        </p>
      </div>

      <FounderViewDashboard
        data={data}
        selectedFy={selectedFy}
        fiscalYears={fiscalYears}
      />
    </div>
  )
}
