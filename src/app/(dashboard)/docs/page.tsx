import { getCurrentUser } from '@/lib/auth'
import DocsClient from './docs-client'

export default async function DocsPage() {
  const user = await getCurrentUser()
  return <DocsClient userRole={user.role} />
}
