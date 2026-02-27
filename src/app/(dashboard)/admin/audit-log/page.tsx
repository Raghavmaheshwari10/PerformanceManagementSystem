import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { AuditLogTable } from '@/components/audit-log-table'

const PAGE_SIZE = 25

export default async function AuditLogPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requireRole(['admin'])
  const { page: pageStr } = await searchParams
  const page = Math.max(1, Number(pageStr) || 1)
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const supabase = await createClient()
  const { data: logs } = await supabase
    .from('audit_logs')
    .select('*, users!audit_logs_changed_by_fkey(full_name)')
    .order('created_at', { ascending: false })
    .range(from, to + 1) // fetch one extra to detect hasMore

  const hasMore = (logs?.length ?? 0) > PAGE_SIZE
  const displayLogs = logs?.slice(0, PAGE_SIZE) ?? []

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Audit Log</h1>
      <AuditLogTable
        logs={displayLogs as Parameters<typeof AuditLogTable>[0]['logs']}
        page={page}
        hasMore={hasMore}
        baseUrl="/admin/audit-log"
      />
    </div>
  )
}
