import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { triggerZimyoSync } from './actions'
import { SubmitButton } from '@/components/submit-button'
import { UsersTable } from './users-table'
import Link from 'next/link'
import type { User } from '@/lib/types'

export default async function AdminUsersPage() {
  await requireRole(['admin'])
  const supabase = await createClient()
  const { data: users } = await supabase.from('users').select('*').order('full_name')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">User Management</h1>
        <div className="flex gap-2">
          <Link href="/admin/users/new">
            <Button size="sm">+ New User</Button>
          </Link>
          <Link href="/admin/users/upload">
            <Button variant="outline">Upload CSV</Button>
          </Link>
          <form action={triggerZimyoSync as unknown as (fd: FormData) => Promise<void>}>
            <SubmitButton>Sync from Zimyo</SubmitButton>
          </form>
        </div>
      </div>

      {(!users || users.length === 0) ? (
        <p className="text-muted-foreground">No users yet — upload a CSV or sync with Zimyo.</p>
      ) : (
        <UsersTable users={users as User[]} />
      )}
    </div>
  )
}
