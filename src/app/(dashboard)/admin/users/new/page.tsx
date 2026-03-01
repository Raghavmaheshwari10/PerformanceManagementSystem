import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { NewUserForm } from './new-user-form'
import Link from 'next/link'

export default async function NewUserPage() {
  await requireRole(['admin'])
  const supabase = await createClient()

  const [deptsRes, managersRes] = await Promise.all([
    supabase.from('departments').select('id, name').order('name'),
    supabase.from('users').select('id, full_name').eq('role', 'manager').eq('is_active', true).order('full_name'),
  ])

  return (
    <div className="max-w-lg space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">New User</h1>
        <Link href="/admin/users" className="text-sm text-muted-foreground hover:underline">← Back</Link>
      </div>

      <NewUserForm
        departments={deptsRes.data ?? []}
        managers={managersRes.data ?? []}
      />
    </div>
  )
}
