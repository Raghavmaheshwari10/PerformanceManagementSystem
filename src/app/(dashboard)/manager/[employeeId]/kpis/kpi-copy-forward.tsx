'use client'

import { useState } from 'react'
import type { Kpi } from '@/lib/types'

interface KpiCopyForwardProps {
  previousKpis: Kpi[]
  previousCycleName: string
  onCopyForward: (kpiIds: string[]) => void
}

export function KpiCopyForward({ previousKpis, previousCycleName, onCopyForward }: KpiCopyForwardProps) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  if (previousKpis.length === 0) return null

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAll() {
    setSelected(new Set(previousKpis.map(k => k.id)))
  }

  function clearAll() {
    setSelected(new Set())
  }

  return (
    <div className="rounded-lg border border-dashed">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors"
      >
        <span>
          💡 Suggested KPIs from <span className="font-semibold">{previousCycleName}</span>
          <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs">{previousKpis.length}</span>
        </span>
        <span className="text-muted-foreground">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="border-t px-4 pb-4 space-y-3">
          <div className="flex items-center gap-3 pt-3 text-xs">
            <button type="button" onClick={selectAll} className="text-blue-600 hover:underline">Select all</button>
            <button type="button" onClick={clearAll} className="text-muted-foreground hover:underline">Clear</button>
            <span className="ml-auto text-muted-foreground">{selected.size} selected</span>
          </div>

          <div className="space-y-2">
            {previousKpis.map(kpi => (
              <label key={kpi.id} className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={selected.has(kpi.id)}
                  onChange={() => toggle(kpi.id)}
                  className="mt-0.5 h-4 w-4 shrink-0"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium group-hover:text-primary">{kpi.title}</p>
                    <span className="text-xs text-muted-foreground shrink-0">{kpi.weight}%</span>
                  </div>
                  {kpi.description && (
                    <p className="text-xs text-muted-foreground">{kpi.description}</p>
                  )}
                </div>
              </label>
            ))}
          </div>

          {selected.size > 0 && (
            <button
              type="button"
              onClick={() => onCopyForward(Array.from(selected))}
              className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Copy {selected.size} KPI{selected.size !== 1 ? 's' : ''} forward
            </button>
          )}
        </div>
      )}
    </div>
  )
}
