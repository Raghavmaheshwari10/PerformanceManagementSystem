import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { fetchRoleOptions } from '@/lib/db/role-slugs'
import { notFound } from 'next/navigation'
import { CompetencyForm } from '../../competency-form'
import { updateCompetency } from '../../actions'
import Link from 'next/link'

export default async function EditCompetencyPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(['admin', 'hrbp'])
  const { id } = await params

  const [competency, departments, roleOptions] = await Promise.all([
    prisma.competency.findUnique({ where: { id } }),
    prisma.department.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    fetchRoleOptions(),
  ])

  if (!competency) notFound()

  const boundAction = updateCompetency.bind(null, id)

  const defaultValues = {
    id: competency.id,
    name: competency.name,
    description: competency.description,
    category: competency.category,
    department_id: competency.department_id,
    role_slug_id: competency.role_slug_id,
    is_active: competency.is_active,
    proficiency_levels: competency.proficiency_levels as Array<{ band: string; label: string; description: string }> | null,
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/competencies" className="text-sm text-muted-foreground hover:text-foreground">
          &larr; Back
        </Link>
        <h1 className="text-2xl font-bold">Edit Competency</h1>
      </div>
      <div className="glass rounded-lg border p-5">
        <CompetencyForm
          departments={departments}
          roleOptions={roleOptions}
          defaultValues={defaultValues}
          editAction={boundAction}
        />
      </div>
    </div>
  )
}
