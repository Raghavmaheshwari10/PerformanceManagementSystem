import { Suspense } from 'react'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { TableSkeleton } from '@/components/skeletons'
import { Users } from 'lucide-react'
import { EmptyState } from '@/components/empty-state'

export default async function EmployeeDirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; dept?: string }>
}) {
  await requireRole(['hrbp', 'admin'])
  const { q, dept } = await searchParams

  // Fetch departments immediately — needed for the filter <select>
  const departments = await prisma.department.findMany({ orderBy: { name: 'asc' } })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Employee Directory</h1>

      {/* Search + filter bar — GET form, no JS needed */}
      <form method="get" className="flex flex-wrap gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search by name or email…"
          className="flex-1 min-w-48 rounded border bg-background px-3 py-1.5 text-sm"
        />
        <select name="dept" defaultValue={dept} className="rounded border bg-background px-3 py-1.5 text-sm">
          <option value="">All departments</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <button type="submit" className="rounded border px-3 py-1.5 text-sm hover:bg-accent">Search</button>
        {(q || dept) && (
          <a href="/hrbp/employees" className="rounded border px-3 py-1.5 text-sm hover:bg-accent text-muted-foreground">Clear</a>
        )}
      </form>

      <Suspense fallback={<TableSkeleton rows={6} />}>
        <EmployeesContent q={q} dept={dept} />
      </Suspense>
    </div>
  )
}

async function EmployeesContent({ q, dept }: { q?: string; dept?: string }) {
  const users = await prisma.user.findMany({
    where: {
      is_active: true,
      ...(dept ? { department_id: dept } : {}),
      ...(q
        ? {
            OR: [
              { full_name: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    include: {
      department: { select: { name: true } },
      manager: { select: { full_name: true } },
    },
    orderBy: { full_name: 'asc' },
    take: 100,
  })

  return (
    <div className="space-y-1">
      <p className="text-sm text-muted-foreground mb-2">
        {users.length} employee{users.length !== 1 ? 's' : ''}
      </p>
      {users.map(u => (
        <div key={u.id} className="flex items-center justify-between rounded border p-3 text-sm hover:bg-muted/30">
          <div>
            <p className="font-medium">{u.full_name}</p>
            <p className="text-xs text-muted-foreground">{u.email}</p>
          </div>
          <div className="text-right text-xs text-muted-foreground space-y-0.5">
            <p>{u.department?.name ?? '—'}</p>
            <p>{u.role === 'hrbp' ? 'HRBP' : u.role.charAt(0).toUpperCase() + u.role.slice(1)}</p>
            {u.manager && <p className="text-muted-foreground/70">↑ {u.manager.full_name}</p>}
          </div>
        </div>
      ))}
      {users.length === 0 && (
        <EmptyState
          icon={<Users className="h-7 w-7" />}
          title="No employees found"
          description="Try adjusting your search or filter criteria."
        />
      )}
    </div>
  )
}
