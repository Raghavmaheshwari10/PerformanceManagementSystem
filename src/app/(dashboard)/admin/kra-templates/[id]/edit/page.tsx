import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { fetchRoleOptions } from '@/lib/db/role-slugs'
import { notFound } from 'next/navigation'
import { KraTemplateForm } from '../../template-form'
import { updateKraTemplate } from '../../actions'
import type { KraTemplate } from '@/lib/types'

export default async function EditKraTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(['admin'])
  const { id } = await params

  const [template, departments, roleOptions] = await Promise.all([
    prisma.kraTemplate.findUnique({
      where: { id },
      include: { departments: { select: { department_id: true } } },
    }),
    prisma.department.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    fetchRoleOptions(),
  ])
  if (!template) notFound()

  const defaultValues = {
    ...(template as unknown as KraTemplate),
    department_ids: template.departments.map(d => d.department_id),
  }

  const boundAction = updateKraTemplate.bind(null, id)
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Edit KRA Template</h1>
      <KraTemplateForm action={boundAction} defaultValues={defaultValues} departments={departments} roleOptions={roleOptions} />
    </div>
  )
}
