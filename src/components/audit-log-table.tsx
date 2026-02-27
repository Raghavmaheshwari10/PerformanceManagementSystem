import Link from 'next/link'
import type { AuditLog } from '@/lib/types'

interface AuditLogRow extends AuditLog {
  users?: { full_name: string } | null
}

interface AuditLogTableProps {
  logs: AuditLogRow[]
  page: number
  hasMore: boolean
  baseUrl: string
}

export function AuditLogTable({ logs, page, hasMore, baseUrl }: AuditLogTableProps) {
  const prevUrl = page > 1 ? `${baseUrl}?page=${page - 1}` : null
  const nextUrl = hasMore ? `${baseUrl}?page=${page + 1}` : null

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="p-3 text-left">Timestamp</th>
              <th className="p-3 text-left">User</th>
              <th className="p-3 text-left">Action</th>
              <th className="p-3 text-left">Entity</th>
              <th className="p-3 text-left">Justification</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 && (
              <tr>
                <td colSpan={5} className="p-3 text-center text-muted-foreground">No audit log entries.</td>
              </tr>
            )}
            {logs.map(log => (
              <tr key={log.id} className="border-b">
                <td className="p-3 text-xs">{new Date(log.created_at).toLocaleString()}</td>
                <td className="p-3">{log.users?.full_name ?? 'System'}</td>
                <td className="p-3 font-mono text-xs">{log.action}</td>
                <td className="p-3 text-xs">{log.entity_type}</td>
                <td className="p-3 text-xs">{log.justification ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Page {page}</span>
        <div className="flex gap-2">
          {prevUrl ? (
            <Link href={prevUrl} className="rounded border px-3 py-1 hover:bg-muted">Previous</Link>
          ) : (
            <span className="rounded border px-3 py-1 text-muted-foreground cursor-not-allowed">Previous</span>
          )}
          {nextUrl ? (
            <Link href={nextUrl} className="rounded border px-3 py-1 hover:bg-muted">Next</Link>
          ) : (
            <span className="rounded border px-3 py-1 text-muted-foreground cursor-not-allowed">Next</span>
          )}
        </div>
      </div>
    </div>
  )
}
