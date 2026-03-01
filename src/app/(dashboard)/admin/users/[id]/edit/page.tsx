import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { EditUserForm } from './edit-user-form'

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(['admin'])
  const { id } = await params
  const supabase = await createClient()

  const [userRes, deptsRes, managersRes, hrbpDeptsRes] = await Promise.all([
    supabase.from('users').select('id, email, full_name, role, department_id, designation, variable_pay, manager_id, is_also_employee, is_active').eq('id', id).single(),
    supabase.from('departments').select('id, name').order('name'),
    supabase.from('users').select('id, full_name').eq('role', 'manager').eq('is_active', true).order('full_name'),
    supabase.from('hrbp_departments').select('department_id').eq('hrbp_id', id),
  ])

  if (!userRes.data) notFound()

  return (
    <div className="max-w-lg space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Edit User</h1>
        <Link href="/admin/users" className="text-sm text-muted-foreground hover:underline">Back</Link>
      </div>
      <EditUserForm
        user={userRes.data}
        departments={deptsRes.data ?? []}
        managers={managersRes.data ?? []}
        assignedDeptIds={(hrbpDeptsRes.data ?? []).map(h => h.department_id)}
      />
    </div>
  )
}
