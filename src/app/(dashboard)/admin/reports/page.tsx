import { requireRole } from '@/lib/auth'
import { fetchCycleReports, fetchDeptBreakdown, fetchEmployeeRows } from '@/lib/db/reports'
import { ReportDashboard } from '@/components/report-dashboard'

export default async function AdminReportsPage() {
  await requireRole(['admin'])

  // Admin sees everything — no department scoping
  const cycleReports = await fetchCycleReports({ limit: 10 })

  const deptBreakdown: Record<string, any[]> = {}
  const employeeRows: Record<string, any[]> = {}

  for (const report of cycleReports) {
    const [depts, employees] = await Promise.all([
      fetchDeptBreakdown(report.cycleId),
      fetchEmployeeRows(report.cycleId),
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
      title="Organisation Reports"
      subtitle="All departments, all cycles"
    />
  )
}
