import { requireRole } from '@/lib/auth'

export default async function HrbpLayout({ children }: { children: React.ReactNode }) {
  await requireRole(['hrbp'])
  return <>{children}</>
}
