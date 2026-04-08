import { requireRole } from '@/lib/auth'

export default async function DepartmentHeadLayout({ children }: { children: React.ReactNode }) {
  await requireRole(['department_head'])
  return <>{children}</>
}
