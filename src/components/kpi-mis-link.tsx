'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { linkKpiToMis, unlinkKpiFromMis, getAvailableTargets } from '@/app/(dashboard)/manager/mis-mapping-actions'

const CATEGORY_BADGE: Record<string, string> = {
  financial: 'bg-emerald-500/15 text-emerald-400',
  operational: 'bg-blue-500/15 text-blue-400',
  customer: 'bg-amber-500/15 text-amber-400',
  people: 'bg-purple-500/15 text-purple-400',
}

const FORMULA_OPTIONS = [
  { value: 'linear', label: 'Linear', description: 'Score scales proportionally with achievement' },
  { value: 'capped', label: 'Capped (max 100%)', description: 'Score capped at 100% even if over-achieved' },
  { value: 'inverse', label: 'Inverse (lower is better)', description: 'Lower actual values yield higher scores' },
]

interface CurrentMapping {
  id: string
  aopTargetId: string
  metricName: string
  formula: string
}

interface Props {
  kpiId: string
  kpiTitle: string
  employeeId: string
  currentMapping: CurrentMapping | null
}

interface AopTargetOption {
  id: string
  metric_name: string
  category: string
  annual_target: number
  unit: string
}

export function KpiMisLink({ kpiId, kpiTitle, employeeId, currentMapping }: Props) {
  const [open, setOpen] = useState(false)
  const [targets, setTargets] = useState<AopTargetOption[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedTarget, setSelectedTarget] = useState('')
  const [formula, setFormula] = useState('linear')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setLoading(true)
      setError('')
      getAvailableTargets(employeeId)
        .then(setTargets)
        .catch(() => setError('Failed to load targets'))
        .finally(() => setLoading(false))
    }
  }, [open, employeeId])

  async function handleLink() {
    if (!selectedTarget) return
    setPending(true)
    setError('')
    const result = await linkKpiToMis(kpiId, selectedTarget, formula)
    setPending(false)
    if (result.error) {
      setError(result.error)
    } else {
      setOpen(false)
      setSelectedTarget('')
      setFormula('linear')
    }
  }

  async function handleUnlink() {
    if (!currentMapping) return
    setPending(true)
    setError('')
    const result = await unlinkKpiFromMis(currentMapping.id)
    setPending(false)
    if (result.error) {
      setError(result.error)
    }
  }

  // If already mapped, show badge with unlink option
  if (currentMapping) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
        MIS: {currentMapping.metricName}
        <button
          onClick={handleUnlink}
          disabled={pending}
          className="ml-0.5 rounded-full p-0.5 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
          title="Unlink from MIS"
        >
          <svg className="size-3" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4.646 4.646a.5.5 0 01.708 0L8 7.293l2.646-2.647a.5.5 0 01.708.708L8.707 8l2.647 2.646a.5.5 0 01-.708.708L8 8.707l-2.646 2.647a.5.5 0 01-.708-.708L7.293 8 4.646 5.354a.5.5 0 010-.708z" />
          </svg>
        </button>
      </span>
    )
  }

  // Not mapped — show link button + dialog
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2.5 py-0.5 text-xs font-medium text-muted-foreground hover:bg-white/10 transition-colors">
          <svg className="size-3" viewBox="0 0 16 16" fill="currentColor">
            <path d="M6.354 5.5H4a3 3 0 000 6h3a3 3 0 002.83-4H9.4a2 2 0 01-1.4.58H4a2 2 0 110-4h2.354a4.002 4.002 0 010-1.58zM9 4a4 4 0 11.58 1.5H12a2 2 0 110 4H9.646a4.002 4.002 0 010 1.58H12a3 3 0 100-6H9z" />
          </svg>
          Link to MIS
        </button>
      </DialogTrigger>
      <DialogContent className="glass border-white/10">
        <DialogHeader>
          <DialogTitle>Link KPI to MIS Target</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Link &ldquo;{kpiTitle}&rdquo; to an AOP target to auto-calculate MIS scores.
        </p>

        {error && (
          <p className="rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading targets...</p>
        ) : targets.length === 0 ? (
          <p className="text-sm text-muted-foreground">No individual AOP targets found for this employee.</p>
        ) : (
          <>
            <div className="space-y-1">
              <label htmlFor="mis-target-select" className="text-sm font-medium">AOP Target</label>
              <select
                id="mis-target-select"
                value={selectedTarget}
                onChange={e => setSelectedTarget(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
              >
                <option value="">Select a target...</option>
                {targets.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.metric_name} [{t.category}] — {t.annual_target} {t.unit}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label htmlFor="mis-formula-select" className="text-sm font-medium">Score Formula</label>
              <select
                id="mis-formula-select"
                value={formula}
                onChange={e => setFormula(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
              >
                {FORMULA_OPTIONS.map(f => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                {FORMULA_OPTIONS.find(f => f.value === formula)?.description}
              </p>
            </div>

            {selectedTarget && (
              <div className="rounded-lg bg-white/5 p-3 text-sm">
                <p className="font-medium">
                  {targets.find(t => t.id === selectedTarget)?.metric_name}
                </p>
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <span className={`rounded-full px-2 py-0.5 ${CATEGORY_BADGE[targets.find(t => t.id === selectedTarget)?.category ?? ''] ?? 'bg-white/10 text-muted-foreground'}`}>
                    {targets.find(t => t.id === selectedTarget)?.category}
                  </span>
                  <span>Target: {targets.find(t => t.id === selectedTarget)?.annual_target} {targets.find(t => t.id === selectedTarget)?.unit}</span>
                </div>
              </div>
            )}

            <Button onClick={handleLink} disabled={!selectedTarget || pending} className="w-full">
              {pending ? 'Linking...' : 'Link to MIS Target'}
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
