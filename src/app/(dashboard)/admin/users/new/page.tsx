import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { createUser } from '../actions'
import { SubmitButton } from '@/components/submit-button'
import Link from 'next/link'

export default async function NewUserPage() {
  await requireRole(['admin'])
  const supabase = await createClient()

  const [deptsRes, managersRes] = await Promise.all([
    supabase.from('departments').select('id, name').order('name'),
    supabase.from('users').select('id, full_name').eq('role', 'manager').eq('is_active', true).order('full_name'),
  ])

  return (
    <div className="max-w-lg space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">New User</h1>
        <Link href="/admin/users" className="text-sm text-muted-foreground hover:underline">← Back</Link>
      </div>

      <form action={createUser as unknown as (fd: FormData) => Promise<void>} className="space-y-4 rounded-lg border p-5">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium">Full Name *</label>
            <input name="full_name" required className="w-full rounded border px-3 py-2 text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Email *</label>
            <input name="email" type="email" required className="w-full rounded border px-3 py-2 text-sm" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium">Role *</label>
            <select name="role" required className="w-full rounded border px-3 py-2 text-sm">
              <option value="">Select role</option>
              <option value="employee">Employee</option>
              <option value="manager">Manager</option>
              <option value="hrbp">HRBP</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Department</label>
            <select name="department_id" className="w-full rounded border px-3 py-2 text-sm">
              <option value="">None</option>
              {(deptsRes.data ?? []).map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium">Designation</label>
            <input name="designation" className="w-full rounded border px-3 py-2 text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Variable Pay (₹)</label>
            <input name="variable_pay" type="number" min="0" defaultValue={0} className="w-full rounded border px-3 py-2 text-sm" />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium">Manager</label>
          <select name="manager_id" className="w-full rounded border px-3 py-2 text-sm">
            <option value="">None</option>
            {(managersRes.data ?? []).map(m => (
              <option key={m.id} value={m.id}>{m.full_name}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <input type="checkbox" name="send_invite" value="true" id="send_invite" />
          <label htmlFor="send_invite" className="text-sm">Send magic link invite</label>
        </div>

        <SubmitButton className="w-full">Create User</SubmitButton>
      </form>
    </div>
  )
}
