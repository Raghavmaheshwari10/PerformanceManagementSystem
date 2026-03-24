import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { notFound } from 'next/navigation'
import { TemplateForm } from '../../template-form'
import { updateKpiTemplate } from '../../actions'
import type { KpiTemplate } from '@/lib/types'

export default async function EditKpiTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(['admin'])
  const { id } = await params

  const template = await prisma.kpiTemplate.findUnique({ where: { id } })
  if (!template) notFound()

  const boundAction = updateKpiTemplate.bind(null, id)
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Edit KPI Template</h1>
      <TemplateForm action={boundAction} defaultValues={template as unknown as KpiTemplate} />
    </div>
  )
}
