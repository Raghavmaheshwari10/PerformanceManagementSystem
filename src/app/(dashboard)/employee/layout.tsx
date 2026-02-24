import { requireRole } from '@/lib/auth'

export default async function EmployeeLayout({ children }: { children: React.ReactNode }) {
  await requireRole(['employee'])
  return <>{children}</>
}
