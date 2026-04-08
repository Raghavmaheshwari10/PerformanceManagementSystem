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
  const user = await requireRole(['admin'])
  const searchParams = await props.searchParams

  // Check founder flag
  if (!user.is_founder) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="bg-white/5 border border-white/10 rounded-xl p-10 text-center max-w-md">
          <div className="text-4xl mb-4">🔒</div>
          <h2 className="text-xl font-semibold text-white mb-2">Access Restricted</h2>
          <p className="text-white/50 text-sm">
            The Founder View is only accessible to users with the founder flag enabled.
            Contact your system administrator if you believe this is an error.
          </p>
        </div>
      </div>
    )
  }

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
