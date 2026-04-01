import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { notFound } from 'next/navigation'
import { TemplateForm } from '../../template-form'
import { updateKpiTemplate } from '../../actions'
import type { KpiTemplate } from '@/lib/types'

export default async function EditKpiTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(['admin'])
  const { id } = await params

  const [template, kraTemplates] = await Promise.all([
    prisma.kpiTemplate.findUnique({ where: { id } }),
    prisma.kraTemplate.findMany({
      where: { is_active: true },
      select: { id: true, title: true, role_slug: true, category: true },
      orderBy: { title: 'asc' },
    }),
  ])
  if (!template) notFound()

  const boundAction = updateKpiTemplate.bind(null, id)
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Edit KPI Template</h1>
      <TemplateForm action={boundAction} defaultValues={template as unknown as KpiTemplate} kraTemplates={kraTemplates} />
    </div>
  )
}
