import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { fetchCycleReports, fetchDeptBreakdown, fetchEmployeeRows } from '@/lib/db/reports'
import { ReportDashboard } from '@/components/report-dashboard'

export default async function ManagerReportsPage() {
  const user = await requireRole(['manager'])

  // Manager sees only direct reports
  const directReports = await prisma.user.findMany({
    where: { manager_id: user.id, is_active: true },
    select: { id: true, department_id: true },
  })

  const reportIds = directReports.map(r => r.id)
  const reportDeptIds = [...new Set(directReports.map(r => r.department_id).filter(Boolean))] as string[]

  if (reportIds.length === 0) {
    return (
      <div className="glass flex flex-col items-center justify-center py-16 text-center">
        <h3 className="text-lg font-semibold mb-1">No Direct Reports</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          You don&apos;t have any active direct reports. Reports will appear here once team members are assigned.
        </p>
      </div>
    )
  }

  const cycleReports = await fetchCycleReports({
    employeeIds: reportIds,
    limit: 10,
  })

  const deptBreakdown: Record<string, any[]> = {}
  const employeeRows: Record<string, any[]> = {}

  for (const report of cycleReports) {
    const [depts, employees] = await Promise.all([
      fetchDeptBreakdown(report.cycleId, reportDeptIds),
      fetchEmployeeRows(report.cycleId, { employeeIds: reportIds }),
    ])
    deptBreakdown[report.cycleId] = depts.map(d => ({
      departmentName: d.departmentName,
      employeeCount: d.employeeCount,
      ratingDist: d.ratingDist,
      totalPayout: d.totalPayout,
    }))
    employeeRows[report.cycleId] = employees
  }

  const cycles = cycleReports.map(r => ({
    cycleId: r.cycleId,
    cycleName: r.cycleName,
    quarter: r.quarter,
    year: r.year,
    status: r.status,
    scopedEmployeeCount: r.scopedEmployeeCount,
    selfReviewRate: r.selfReviewRate,
    managerReviewRate: r.managerReviewRate,
    totalRated: r.totalRated,
    totalPayout: r.totalPayout,
    avgMultiplier: r.avgMultiplier,
    exitedCount: r.exitedCount,
    ratingDist: r.ratingDist as Record<string, number>,
  }))

  return (
    <ReportDashboard
      cycles={cycles}
      deptBreakdown={deptBreakdown}
      employeeRows={employeeRows}
      title="Team Reports"
      subtitle={`${reportIds.length} direct report(s)`}
    />
  )
}
