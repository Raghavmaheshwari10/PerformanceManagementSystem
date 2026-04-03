import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createDepartment, deleteDepartment, renameDepartment, assignHrbp, removeHrbp } from './actions'
import { SubmitButton } from '@/components/submit-button'

export default async function DepartmentsPage() {
  await requireRole(['admin'])

  const [departments, hrbpUsers] = await Promise.all([
    prisma.department.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        _count: { select: { users: true } },
        hrbp_departments: {
          include: { hrbp: { select: { id: true, full_name: true, email: true } } },
        },
      },
    }),
    prisma.user.findMany({
      where: { role: 'hrbp', is_active: true },
      orderBy: { full_name: 'asc' },
      select: { id: true, full_name: true, email: true },
    }),
  ])

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold">Departments</h1>

      <form action={createDepartment as unknown as (fd: FormData) => Promise<void>} className="flex gap-2">
        <input
          name="name"
          placeholder="New department name"
          className="flex-1 rounded-md border px-3 py-2 text-sm"
          required
        />
        <SubmitButton>Add</SubmitButton>
      </form>

      <div className="space-y-4">
        {departments.map(d => {
          const assignedHrbpIds = new Set(d.hrbp_departments.map(h => h.hrbp_id))
          const availableHrbps = hrbpUsers.filter(u => !assignedHrbpIds.has(u.id))

          return (
            <div key={d.id} className="rounded-lg border">
              {/* Department header */}
              <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b gap-4">
                <div>
                  <p className="text-sm font-semibold">{d.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {d._count.users} user(s) · {d.hrbp_departments.length} HRBP(s)
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <form action={renameDepartment.bind(null, d.id) as unknown as (fd: FormData) => Promise<void>} className="flex items-center gap-1">
                    <input
                      name="name"
                      defaultValue={d.name}
                      className="rounded border px-2 py-1 text-xs w-32"
                      required
                    />
                    <button type="submit" className="text-xs text-primary hover:underline">
                      Rename
                    </button>
                  </form>
                  <form action={deleteDepartment.bind(null, d.id) as unknown as (fd: FormData) => Promise<void>}>
                    <button
                      type="submit"
                      className="text-xs text-destructive hover:underline"
                    >
                      Delete
                    </button>
                  </form>
                </div>
              </div>

              {/* HRBP assignment section */}
              <div className="px-4 py-3 space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Assigned HRBPs</p>

                {d.hrbp_departments.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No HRBPs assigned</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {d.hrbp_departments.map(h => (
                      <div key={h.hrbp_id} className="flex items-center gap-1.5 bg-primary/10 text-primary rounded-full pl-3 pr-1 py-1 text-xs font-medium">
                        <span>{h.hrbp.full_name}</span>
                        <form action={removeHrbp.bind(null, h.hrbp_id, d.id) as unknown as (fd: FormData) => Promise<void>}>
                          <button type="submit" className="hover:bg-primary/20 rounded-full p-0.5" title="Remove HRBP">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          </button>
                        </form>
                      </div>
                    ))}
                  </div>
                )}

                {availableHrbps.length > 0 && (
                  <form action={assignHrbp.bind(null, d.id) as unknown as (fd: FormData) => Promise<void>} className="flex items-center gap-2 pt-1">
                    <select name="hrbp_id" required className="rounded border px-2 py-1 text-xs flex-1 max-w-xs">
                      <option value="">+ Add HRBP...</option>
                      {availableHrbps.map(u => (
                        <option key={u.id} value={u.id}>{u.full_name} ({u.email})</option>
                      ))}
                    </select>
                    <button type="submit" className="text-xs text-primary hover:underline font-medium">Assign</button>
                  </form>
                )}
              </div>
            </div>
          )
        })}
        {departments.length === 0 && (
          <p className="px-4 py-6 text-sm text-muted-foreground text-center">
            No departments yet
          </p>
        )}
      </div>
    </div>
  )
}
