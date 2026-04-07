import { requireRole } from '@/lib/auth'
import { fetchPipDetail } from '@/lib/db/pip'
import { PipDetailView } from '@/components/pip-detail'
import { notFound } from 'next/navigation'

export default async function ManagerPipDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(['manager'])
  const { id } = await params
  const pip = await fetchPipDetail(id)
  if (!pip) notFound()

  return <PipDetailView pip={pip} role="manager" currentUserId={user.id} />
}
