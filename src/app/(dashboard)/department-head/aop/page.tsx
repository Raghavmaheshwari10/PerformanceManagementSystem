import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { CascadeForm } from './cascade-form'
import { AopCascadeTree } from '@/components/aop-cascade-tree'

/** Compute current fiscal year: if month >= April, FY starts this year; else last year */
function currentFiscalYear(): string {
  const now = new Date()
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
  return `FY${String(year).slice(2)}`
}

export default async function DepartmentHeadAopPage() {
  const user = await requireRole(['department_head'])

  if (!user.department_id) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">AOP Cascade</h1>
        <div className="glass rounded-xl border border-white/10 p-6">
          <p className="text-sm text-white/50 text-center">
            Your account is not assigned to a department. Contact admin.
          </p>
        </div>
      </div>
    )
  }

  const selectedFy = currentFiscalYear()

  // Fetch department info
  const department = await prisma.department.findUnique({
    where: { id: user.department_id },
    select: { id: true, name: true },
  })

  if (!department) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">AOP Cascade</h1>
        <div className="glass rounded-xl border border-white/10 p-6">
          <p className="text-sm text-white/50 text-center">Department not found.</p>
        </div>
      </div>
    )
  }

  // Fetch department AOP records for this department (all metrics for current FY)
  const departmentAops = await prisma.departmentAop.findMany({
    where: {
      department_id: department.id,
      org_aop: { fiscal_year: selectedFy },
    },
    include: {
      org_aop: true,
      employee_aops: {
        include: { employee: { select: { id: true, full_name: true } } },
        orderBy: { employee: { full_name: 'asc' } },
      },
    },
  })

  // Fetch active employees in this department (excluding admins)
  const employees = await prisma.user.findMany({
    where: {
      department_id: department.id,
      is_active: true,
      role: { not: 'admin' },
      // Exclude the department head themselves from cascade targets
      id: { not: user.id },
    },
    select: { id: true, full_name: true },
    orderBy: { full_name: 'asc' },
  })

  // Serialize Decimal fields to numbers
  const serializedDeptAops = departmentAops.map((da) => ({
    id: da.id,
    org_aop_id: da.org_aop_id,
    department_id: da.department_id,
    status: da.status as string,
    metric: da.org_aop.metric as string,
    fiscal_year: da.org_aop.fiscal_year,
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
    employee_aops: da.employee_aops.map((ea) => ({
      id: ea.id,
      department_aop_id: ea.department_aop_id,
      employee_id: ea.employee_id,
      employee_name: ea.employee.full_name,
      annual_target: Number(ea.annual_target),
      apr: Number(ea.apr),
      may: Number(ea.may),
      jun: Number(ea.jun),
      jul: Number(ea.jul),
      aug: Number(ea.aug),
      sep: Number(ea.sep),
      oct: Number(ea.oct),
      nov: Number(ea.nov),
      dec: Number(ea.dec),
      jan: Number(ea.jan),
      feb: Number(ea.feb),
      mar: Number(ea.mar),
      exited_at: ea.exited_at ? ea.exited_at.toISOString() : null,
      replacement_for: ea.replacement_for ?? null,
    })),
  }))

  // Build cascade tree data for the summary view (first metric with data)
  const firstDeptAop = serializedDeptAops[0]
  const cascadeTreeData = firstDeptAop
    ? {
        id: firstDeptAop.org_aop_id,
        fiscal_year: firstDeptAop.fiscal_year,
        metric: firstDeptAop.metric,
        annual_target: firstDeptAop.annual_target, // dept target shown as "org" in single-dept view
        department_aops: serializedDeptAops.map((da) => ({
          id: da.id,
          department: { id: da.department_id, name: department.name },
          status: da.status,
          annual_target: da.annual_target,
          employee_aops: da.employee_aops.map((ea) => ({
            id: ea.id,
            employee: { id: ea.employee_id, full_name: ea.employee_name },
            annual_target: ea.annual_target,
          })),
        })),
      }
    : null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">AOP Cascade</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Cascade department targets to individual team members
        </p>
      </div>

      {/* Cascade tree summary */}
      {cascadeTreeData && (
        <div className="glass rounded-xl border border-white/10 p-5 space-y-3">
          <h2 className="text-sm font-semibold text-white/70">Cascade Overview</h2>
          <AopCascadeTree
            orgAop={cascadeTreeData}
            departments={[{ id: department.id, name: department.name }]}
            singleDepartmentId={department.id}
          />
        </div>
      )}

      <CascadeForm
        departmentName={department.name}
        fiscalYear={selectedFy}
        departmentAops={serializedDeptAops}
        employees={employees}
      />
    </div>
  )
}
