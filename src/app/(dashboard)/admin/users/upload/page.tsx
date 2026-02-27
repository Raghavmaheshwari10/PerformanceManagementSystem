'use client'

import { useActionState } from 'react'
import { uploadUsersCsv, type UploadSummary } from './actions'
import { SubmitButton } from '@/components/submit-button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ActionResult } from '@/lib/types'

const INITIAL: ActionResult<UploadSummary> = {
  data: { added: 0, updated: 0, skipped: 0, skippedReasons: [] },
  error: null,
}

export default function UploadUsersPage() {
  const [state, action] = useActionState(uploadUsersCsv, INITIAL)

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-bold">Upload Users CSV</h1>
      <p className="text-sm text-muted-foreground">
        CSV columns: zimyo_id, email, full_name, department, designation, manager_email
      </p>

      <form action={action} className="space-y-4">
        {state.error && (
          <p className="rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>
        )}
        <div className="space-y-2">
          <Label htmlFor="file">CSV File</Label>
          <Input id="file" name="file" type="file" accept=".csv" required />
        </div>
        <SubmitButton pendingLabel="Uploading...">Upload & Import</SubmitButton>
      </form>

      {state.data && (state.data.added > 0 || state.data.updated > 0 || state.data.skipped > 0) && (
        <div className="rounded border p-4 space-y-3">
          <h2 className="font-semibold">Upload Summary</h2>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded bg-green-50 p-2">
              <p className="text-2xl font-bold text-green-700">{state.data.added}</p>
              <p className="text-xs text-green-600">Created</p>
            </div>
            <div className="rounded bg-blue-50 p-2">
              <p className="text-2xl font-bold text-blue-700">{state.data.updated}</p>
              <p className="text-xs text-blue-600">Updated</p>
            </div>
            <div className="rounded bg-yellow-50 p-2">
              <p className="text-2xl font-bold text-yellow-700">{state.data.skipped}</p>
              <p className="text-xs text-yellow-600">Skipped</p>
            </div>
          </div>
          {state.data.skippedReasons.length > 0 && (
            <div className="space-y-1">
              <p className="text-sm font-medium text-yellow-700">Skip reasons:</p>
              <ul className="space-y-0.5">
                {state.data.skippedReasons.map((reason, i) => (
                  <li key={i} className="text-xs text-muted-foreground">• {reason}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
