import { requireRole } from '@/lib/auth'
import { CycleForm } from './cycle-form'

export default async function NewCyclePage() {
  await requireRole(['admin', 'hrbp'])

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-bold">Create New Cycle</h1>
      <CycleForm />
    </div>
  )
}
