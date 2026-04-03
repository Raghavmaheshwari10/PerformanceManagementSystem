import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { fetchRoleOptions } from '@/lib/db/role-slugs'
import { TemplateForm } from '../template-form'
import { createKpiTemplate } from '../actions'

export default async function NewKpiTemplatePage() {
  await requireRole(['admin'])
  const [kraTemplates, roleOptions, departments] = await Promise.all([
    prisma.kraTemplate.findMany({
      where: { is_active: true },
      select: { id: true, title: true, role_slug_id: true, category: true },
      orderBy: { title: 'asc' },
    }),
    fetchRoleOptions(),
    prisma.department.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
  ])
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">New KPI Template</h1>
      <TemplateForm action={createKpiTemplate} kraTemplates={kraTemplates} roleOptions={roleOptions} departments={departments} />
    </div>
  )
}
