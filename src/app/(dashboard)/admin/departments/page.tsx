import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { createDepartment, deleteDepartment, renameDepartment } from './actions'
import { SubmitButton } from '@/components/submit-button'
import type { Department } from '@/lib/types'

type DeptWithCount = Department & { users: { count: number }[] }

export default async function DepartmentsPage() {
  await requireRole(['admin'])
  const supabase = await createClient()
  const { data: departments } = await supabase
    .from('departments')
    .select('*, users(count)')
    .order('name')

  return (
    <div className="space-y-6 max-w-xl">
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

      <div className="rounded-lg border divide-y">
        {(departments ?? []).map((d: DeptWithCount) => (
          <div key={d.id} className="flex items-center justify-between px-4 py-3 gap-4">
            <div>
              <p className="text-sm font-medium">{d.name}</p>
              <p className="text-xs text-muted-foreground">
                {d.users?.[0]?.count ?? 0} user(s)
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
        ))}
        {(departments ?? []).length === 0 && (
          <p className="px-4 py-6 text-sm text-muted-foreground text-center">
            No departments yet
          </p>
        )}
      </div>
    </div>
  )
}
