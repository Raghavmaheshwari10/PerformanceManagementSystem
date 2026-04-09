import { requireRole } from '@/lib/auth'
import { UploadForm } from './upload-form'

export default async function MisActualsUploadPage() {
  await requireRole(['admin'])

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Upload MIS Actuals</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Bulk upload monthly actuals via CSV for the AOP cascade.
        </p>
      </div>
      <UploadForm />
    </div>
  )
}
