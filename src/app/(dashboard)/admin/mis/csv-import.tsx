'use client'

import { useActionState, useState, useRef } from 'react'
import { importTargetsCsv } from './actions'
import { Upload, FileText, X, Download } from 'lucide-react'

export function CsvImport({ fiscalYear }: { fiscalYear: number }) {
  const [state, formAction, pending] = useActionState(importTargetsCsv, { data: null, error: null })
  const [open, setOpen] = useState(false)
  const [csvData, setCsvData] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      setCsvData(ev.target?.result as string ?? '')
    }
    reader.readAsText(file)
  }

  function downloadTemplate() {
    const template = `metric_name,annual_target,level,category,unit,employee_email,department,red_threshold,amber_threshold
Revenue Target,1000000,individual,financial,INR,john@emb.global,Engineering,80,95
Client Acquisition,50,individual,operational,count,jane@emb.global,Sales,80,95
Department Revenue,5000000,department,financial,INR,,Engineering,80,95`

    const blob = new Blob([template], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'mis-targets-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
      >
        <Upload className="h-3.5 w-3.5" />
        CSV Import
      </button>
    )
  }

  return (
    <div className="glass rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Import Targets from CSV
        </h3>
        <button onClick={() => setOpen(false)} className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted/50">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={downloadTemplate}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <Download className="h-3.5 w-3.5" />
          Download Template
        </button>
        <p className="text-xs text-muted-foreground">
          Required columns: <code className="text-primary">metric_name</code>, <code className="text-primary">annual_target</code>, <code className="text-primary">level</code>
        </p>
      </div>

      <form action={formAction} className="space-y-3">
        <input type="hidden" name="fiscal_year" value={fiscalYear} />

        {/* File upload */}
        <div className="flex items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1.5 rounded-lg border border-dashed border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors"
          >
            <FileText className="h-4 w-4" />
            {csvData ? 'File loaded' : 'Choose CSV file'}
          </button>
          {csvData && (
            <span className="text-xs text-muted-foreground">
              {csvData.split('\n').length - 1} row(s) detected
            </span>
          )}
        </div>

        {/* Or paste CSV */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Or paste CSV data:</label>
          <textarea
            name="csv_data"
            value={csvData}
            onChange={e => setCsvData(e.target.value)}
            rows={6}
            placeholder="metric_name,annual_target,level,category,unit,employee_email,department,red_threshold,amber_threshold"
            className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs font-mono focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
        </div>

        {state.error && (
          <p className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{state.error}</p>
        )}

        <button
          type="submit"
          disabled={pending || !csvData.trim()}
          className="glow-button flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          <Upload className="h-4 w-4" />
          {pending ? 'Importing...' : 'Import Targets'}
        </button>
      </form>
    </div>
  )
}
