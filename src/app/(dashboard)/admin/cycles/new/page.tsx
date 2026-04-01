import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { CycleForm } from './cycle-form'

export default async function NewCyclePage() {
  await requireRole(['admin', 'hrbp'])

  const [departments, employees, reviewTemplates] = await Promise.all([
    prisma.department.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.user.findMany({
      where: { is_active: true, role: { notIn: ['admin', 'hrbp'] } },
      orderBy: { full_name: 'asc' },
      select: { id: true, full_name: true, department_id: true },
    }),
    prisma.reviewTemplate.findMany({
      orderBy: { created_at: 'desc' },
      select: { id: true, name: true, description: true, _count: { select: { questions: true } } },
    }),
  ])

  // Group employees by department
  const employeesByDept: Record<string, { id: string; full_name: string }[]> = {}
  const unassignedEmployees: { id: string; full_name: string }[] = []
  for (const emp of employees) {
    if (emp.department_id) {
      const list = employeesByDept[emp.department_id] || []
      list.push({ id: emp.id, full_name: emp.full_name })
      employeesByDept[emp.department_id] = list
    } else {
      unassignedEmployees.push({ id: emp.id, full_name: emp.full_name })
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Create New Cycle</h1>
        <p className="text-sm text-muted-foreground mt-1">Set up a review cycle with department scoping and deadlines.</p>
      </div>
      <CycleForm
        departments={departments}
        employeesByDept={employeesByDept}
        unassignedEmployees={unassignedEmployees}
        reviewTemplates={reviewTemplates.map(t => ({
          id: t.id,
          name: t.name,
          description: t.description,
          questionCount: t._count.questions,
        }))}
      />
    </div>
  )
}
