import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { KraTemplateForm } from '../template-form'
import { createKraTemplate } from '../actions'

export default async function NewKraTemplatePage() {
  await requireRole(['admin'])

  const departments = await prisma.department.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  })

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">New KRA Template</h1>
      <KraTemplateForm action={createKraTemplate} departments={departments} />
    </div>
  )
}
