import { redirect } from 'next/navigation'
import { requireRole } from '@/lib/auth'

export default async function DeptHeadReviewPage() {
  await requireRole(['department_head'])
  redirect('/employee')
}
