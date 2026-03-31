import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NewUserForm } from './new-user-form'
import Link from 'next/link'

export default async function NewUserPage() {
  await requireRole(['admin'])

  const [departments, managers] = await Promise.all([
    prisma.department.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.user.findMany({
      where: { role: { in: ['manager', 'admin', 'hrbp'] }, is_active: true },
      orderBy: { full_name: 'asc' },
      select: { id: true, full_name: true },
    }),
  ])

  return (
    <div className="max-w-lg space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">New User</h1>
        <Link href="/admin/users" className="text-sm text-muted-foreground hover:underline">← Back</Link>
      </div>

      <NewUserForm
        departments={departments}
        managers={managers}
      />
    </div>
  )
}
