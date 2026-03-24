import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { NotificationForm } from './notification-form'

export default async function AdminNotificationsPage() {
  await requireRole(['admin'])

  const [users, departments, historyLogs] = await Promise.all([
    prisma.user.findMany({
      where: { is_active: true },
      select: { id: true, full_name: true, email: true },
      orderBy: { full_name: 'asc' },
    }),
    prisma.department.findMany({
      orderBy: { name: 'asc' },
      select: { name: true },
    }),
    prisma.auditLog.findMany({
      where: { action: 'manual_notification' },
      orderBy: { created_at: 'desc' },
      take: 20,
      select: {
        id: true,
        created_at: true,
        new_value: true,
        changed_by_user: { select: { full_name: true } },
      },
    }),
  ])

  const deptNames = departments.map(d => d.name)

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Send Notification</h1>
        <p className="text-sm text-muted-foreground mt-1">Send an in-app message to users</p>
      </div>

      <NotificationForm users={users} departments={deptNames} />

      {/* Sent history */}
      {historyLogs.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold">Recent Sends</h2>
          <div className="rounded-md border divide-y text-sm">
            {historyLogs.map(log => (
              <div key={log.id} className="p-3 space-y-0.5">
                <p className="font-medium truncate">{(log.new_value as Record<string, unknown>)?.message as string}</p>
                <p className="text-xs text-muted-foreground">
                  {(log.new_value as Record<string, unknown>)?.count as number} recipients · {(log.new_value as Record<string, unknown>)?.scope as string} · by {log.changed_by_user?.full_name} · {new Date(log.created_at).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
