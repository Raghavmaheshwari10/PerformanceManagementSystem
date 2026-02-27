import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { triggerZimyoSync } from './actions'
import type { User } from '@/lib/types'

export default async function AdminUsersPage() {
  await requireRole(['admin'])
  const supabase = await createClient()
  const { data: users } = await supabase.from('users').select('*').order('full_name')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">User Management</h1>
        <form action={async () => { await triggerZimyoSync() }}>
          <Button type="submit">Sync from Zimyo</Button>
        </form>
      </div>
      {(!users || users.length === 0) ? (
        <p className="text-muted-foreground">No users yet — upload a CSV or sync with Zimyo.</p>
      ) : (
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="p-3 text-left">Name</th>
                <th className="p-3 text-left">Email</th>
                <th className="p-3 text-left">Department</th>
                <th className="p-3 text-left">Role</th>
                <th className="p-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {(users as User[]).map(u => (
                <tr key={u.id} className="border-b">
                  <td className="p-3">{u.full_name}</td>
                  <td className="p-3">{u.email}</td>
                  <td className="p-3">{u.department}</td>
                  <td className="p-3"><Badge variant="outline">{u.role}</Badge></td>
                  <td className="p-3">{u.is_active ? 'Active' : 'Inactive'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
