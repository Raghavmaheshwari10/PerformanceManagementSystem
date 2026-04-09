import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NewPipForm } from '@/components/new-pip-form'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default async function AdminNewPipPage() {
  await requireRole(['admin'])

  const [employees, cycles, departments] = await Promise.all([
    prisma.user.findMany({
      where: { is_active: true },
      orderBy: { full_name: 'asc' },
      select: { id: true, full_name: true, designation: true, department_id: true },
    }),
    prisma.cycle.findMany({
      orderBy: { created_at: 'desc' },
      select: { id: true, name: true },
    }),
    prisma.department.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
  ])

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/admin/pip" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft className="h-3 w-3" /> Back to PIP Management
        </Link>
        <h1 className="text-2xl font-bold">Initiate PIP</h1>
        <p className="text-sm text-muted-foreground mt-1">Create a new Performance Improvement Plan for an employee.</p>
      </div>
      <NewPipForm employees={employees} cycles={cycles} departments={departments} redirectBase="/admin/pip" />
    </div>
  )
}
