import { redirect } from 'next/navigation'
import { requireRole } from '@/lib/auth'

export default async function DeptHeadTeamPage() {
  await requireRole(['department_head'])
  redirect('/manager')
}
