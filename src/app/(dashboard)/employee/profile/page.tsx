import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

async function getManagerChain(
  userId: string,
  maxDepth = 5
): Promise<Array<{ id: string; full_name: string; designation: string | null }>> {
  const chain: Array<{ id: string; full_name: string; designation: string | null }> = []
  let currentId: string | null = userId

  for (let i = 0; i < maxDepth; i++) {
    if (!currentId) break
    const row: {
      manager_id: string | null
      manager: { id: string; full_name: string; designation: string | null } | null
    } | null = await prisma.user.findUnique({
      where: { id: currentId },
      select: {
        manager_id: true,
        manager: { select: { id: true, full_name: true, designation: true } },
      },
    })
    if (!row?.manager) break
    chain.push(row.manager)
    currentId = row.manager.id
  }

  return chain
}

export default async function ProfilePage() {
  const user = await requireRole(['employee', 'manager', 'hrbp'])

  const [fullUser, directReports, managerChain] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      include: {
        department: { select: { name: true } },
        manager: { select: { full_name: true, designation: true } },
      },
    }),
    prisma.user.findMany({
      where: { manager_id: user.id, is_active: true },
      select: { id: true, full_name: true, designation: true },
      orderBy: { full_name: 'asc' },
    }),
    getManagerChain(user.id),
  ])

  if (!fullUser) return null

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">My Profile</h1>

      <section className="rounded border p-5 space-y-4">
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Full Name</p>
            <p className="font-medium">{fullUser.full_name}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Email</p>
            <p className="font-medium">{fullUser.email}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Role</p>
            <p className="font-medium capitalize">{fullUser.role}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Designation</p>
            <p className="font-medium">{fullUser.designation ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Department</p>
            <p className="font-medium">{fullUser.department?.name ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Manager</p>
            <p className="font-medium">{fullUser.manager?.full_name ?? '—'}</p>
          </div>
        </div>
      </section>

      {managerChain.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Reporting Chain</h2>
          <div className="rounded border divide-y">
            {managerChain.map((m, i) => (
              <div key={m.id} className="flex items-center gap-3 px-4 py-2 text-sm" style={{ paddingLeft: `${16 + i * 16}px` }}>
                <span className="text-muted-foreground">↑</span>
                <span className="font-medium">{m.full_name}</span>
                {m.designation && <span className="text-xs text-muted-foreground">{m.designation}</span>}
              </div>
            ))}
          </div>
        </section>
      )}

      {directReports.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Direct Reports ({directReports.length})
          </h2>
          <div className="rounded border divide-y">
            {directReports.map(r => (
              <div key={r.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                <span className="text-muted-foreground">↓</span>
                <span className="font-medium">{r.full_name}</span>
                {r.designation && <span className="text-xs text-muted-foreground">{r.designation}</span>}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
