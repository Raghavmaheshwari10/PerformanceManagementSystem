import { requireRole } from '@/lib/auth'
import { TemplateForm } from '../template-form'
import { createKpiTemplate } from '../actions'

export default async function NewKpiTemplatePage() {
  await requireRole(['admin'])
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">New KPI Template</h1>
      <TemplateForm action={createKpiTemplate} />
    </div>
  )
}
