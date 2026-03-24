import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { AuditLogTable } from '@/components/audit-log-table'

const PAGE_SIZE = 25

export default async function HrbpAuditLogPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requireRole(['hrbp'])
  const { page: pageStr } = await searchParams
  const page = Math.max(1, Number(pageStr) || 1)
  const skip = (page - 1) * PAGE_SIZE

  const logs = await prisma.auditLog.findMany({
    orderBy: { created_at: 'desc' },
    skip,
    take: PAGE_SIZE + 1, // fetch one extra to detect hasMore
    include: { changed_by_user: { select: { full_name: true } } },
  })

  const hasMore = logs.length > PAGE_SIZE
  const displayLogs = logs.slice(0, PAGE_SIZE)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Audit Log</h1>
      <AuditLogTable
        logs={displayLogs as unknown as Parameters<typeof AuditLogTable>[0]['logs']}
        page={page}
        hasMore={hasMore}
        baseUrl="/hrbp/audit-log"
      />
    </div>
  )
}
