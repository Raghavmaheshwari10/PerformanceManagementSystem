import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

export default async function EmployeeDirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; dept?: string }>
}) {
  await requireRole(['hrbp', 'admin'])
  const { q, dept } = await searchParams

  const [users, departments] = await Promise.all([
    prisma.user.findMany({
      where: {
        is_active: true,
        ...(dept ? { department_id: dept } : {}),
        ...(q ? {
          OR: [
            { full_name: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
          ],
        } : {}),
      },
      include: {
        department: { select: { name: true } },
        manager: { select: { full_name: true } },
      },
      orderBy: { full_name: 'asc' },
      take: 100,
    }),
    prisma.department.findMany({ orderBy: { name: 'asc' } }),
  ])

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

      <p className="text-sm text-muted-foreground">{users.length} employee{users.length !== 1 ? 's' : ''}</p>

      <div className="space-y-1">
        {users.map(u => (
          <div key={u.id} className="flex items-center justify-between rounded border p-3 text-sm hover:bg-muted/30">
            <div>
              <p className="font-medium">{u.full_name}</p>
              <p className="text-xs text-muted-foreground">{u.email}</p>
            </div>
            <div className="text-right text-xs text-muted-foreground space-y-0.5">
              <p>{u.department?.name ?? '—'}</p>
              <p className="capitalize">{u.role}</p>
              {u.manager && <p className="text-muted-foreground/70">↑ {u.manager.full_name}</p>}
            </div>
          </div>
        ))}
        {users.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">No employees found.</p>
        )}
      </div>
    </div>
  )
}
