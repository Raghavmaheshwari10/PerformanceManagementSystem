import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { NotificationForm } from './notification-form'
import type { User } from '@/lib/types'

export default async function AdminNotificationsPage() {
  await requireRole(['admin'])
  const supabase = await createClient()

  const [usersRes, deptsRes, historyRes] = await Promise.all([
    supabase.from('users').select('id, full_name, email').eq('is_active', true).order('full_name'),
    supabase.from('departments').select('name').order('name'),
    supabase
      .from('audit_logs')
      .select('id, created_at, new_value, users!audit_logs_changed_by_fkey(full_name)')
      .eq('action', 'manual_notification')
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  const users = (usersRes.data ?? []) as Pick<User, 'id' | 'full_name' | 'email'>[]
  const departments = (deptsRes.data ?? []).map(d => d.name as string)

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Send Notification</h1>
        <p className="text-sm text-muted-foreground mt-1">Send an in-app message to users</p>
      </div>

      <NotificationForm users={users} departments={departments} />

      {/* Sent history */}
      {(historyRes.data ?? []).length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold">Recent Sends</h2>
          <div className="rounded-md border divide-y text-sm">
            {(historyRes.data ?? []).map((log: any) => (
              <div key={log.id} className="p-3 space-y-0.5">
                <p className="font-medium truncate">{(log.new_value as any)?.message}</p>
                <p className="text-xs text-muted-foreground">
                  {(log.new_value as any)?.count} recipients · {(log.new_value as any)?.scope} · by {log.users?.full_name} · {new Date(log.created_at).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
