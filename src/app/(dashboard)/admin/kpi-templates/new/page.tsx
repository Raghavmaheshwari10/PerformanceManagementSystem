import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { TemplateForm } from '../template-form'
import { createKpiTemplate } from '../actions'

export default async function NewKpiTemplatePage() {
  await requireRole(['admin'])
  const kraTemplates = await prisma.kraTemplate.findMany({
    where: { is_active: true },
    select: { id: true, title: true, role_slug: true, category: true },
    orderBy: { title: 'asc' },
  })
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">New KPI Template</h1>
      <TemplateForm action={createKpiTemplate} kraTemplates={kraTemplates} />
    </div>
  )
}
