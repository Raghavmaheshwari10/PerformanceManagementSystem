import { Suspense } from 'react'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { UsersTable } from './users-table'
import { TableSkeleton } from '@/components/skeletons'
import Link from 'next/link'
import type { User } from '@/lib/types'

export default async function AdminUsersPage() {
  await requireRole(['admin'])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">User Management</h1>
        <div className="flex gap-2">
          <Link href="/admin/users/new">
            <Button size="sm">+ New User</Button>
          </Link>
          <Link href="/admin/users/upload">
            <Button variant="outline">Upload CSV</Button>
          </Link>
        </div>
      </div>

      <Suspense fallback={<TableSkeleton rows={8} />}>
        <UsersContent />
      </Suspense>
    </div>
  )
}

async function UsersContent() {
  const [users, departments] = await Promise.all([
    prisma.user.findMany({
      orderBy: { full_name: 'asc' },
      include: { department: true },
    }),
    prisma.department.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
  ])

  if (users.length === 0) {
    return (
      <p className="text-muted-foreground">No users yet — add a user or upload a CSV.</p>
    )
  }

  return <UsersTable users={users as unknown as User[]} departments={departments} />
}
