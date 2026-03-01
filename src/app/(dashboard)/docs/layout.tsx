import { requireRole } from '@/lib/auth'

export const metadata = { title: 'System Documentation — PMS' }

export default async function DocsLayout({ children }: { children: React.ReactNode }) {
  await requireRole(['admin', 'hrbp', 'manager', 'employee'])
  return <div className="p-6">{children}</div>
}
