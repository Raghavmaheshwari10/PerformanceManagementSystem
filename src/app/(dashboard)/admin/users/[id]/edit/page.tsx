import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { EditUserForm } from './edit-user-form'

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(['admin'])
  const { id } = await params

  const [user, departments, managers, hrbpDepts] = await Promise.all([
    prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, full_name: true, role: true, department_id: true, designation: true, variable_pay: true, manager_id: true, is_also_employee: true, is_active: true },
    }),
    prisma.department.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.user.findMany({
      where: { role: { in: ['manager', 'admin', 'hrbp'] }, is_active: true },
      orderBy: { full_name: 'asc' },
      select: { id: true, full_name: true },
    }),
    prisma.hrbpDepartment.findMany({
      where: { hrbp_id: id },
      select: { department_id: true },
    }),
  ])

  if (!user) notFound()

  return (
    <div className="max-w-lg space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Edit User</h1>
        <Link href="/admin/users" className="text-sm text-muted-foreground hover:underline">Back</Link>
      </div>
      <EditUserForm
        user={user as unknown as Parameters<typeof EditUserForm>[0]['user']}
        departments={departments}
        managers={managers}
        assignedDeptIds={hrbpDepts.map(h => h.department_id)}
      />
    </div>
  )
}
