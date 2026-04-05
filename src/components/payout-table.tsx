'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { DownloadAppraisalButton } from '@/components/download-appraisal-button'

interface PayoutRow {
  employeeName: string
  department: string
  finalRating: string | null
  variablePay: number
  multiplier: number
  payoutAmount: number
  employeeId: string
  cycleId: string
}

interface CycleSummary {
  id: string
  name: string
  status: string
  employeeCount: number
  totalPayout: number
  avgMultiplier: number
}

type SortKey = 'employeeName' | 'department' | 'finalRating' | 'variablePay' | 'multiplier' | 'payoutAmount'
type SortDir = 'asc' | 'desc'

const RATING_ORDER: Record<string, number> = { FEE: 1, EE: 2, ME: 3, SME: 4, BE: 5 }

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}

function statusBadge(status: string) {
  const map: Record<string, { bg: string; text: string }> = {
    published: { bg: 'bg-emerald-500/15', text: 'text-emerald-500' },
    locked:    { bg: 'bg-blue-500/15',    text: 'text-blue-500' },
  }
  const style = map[status] ?? { bg: 'bg-muted/50', text: 'text-muted-foreground' }
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${style.bg} ${style.text}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

function ratingColor(rating: string | null): string {
  if (!rating) return 'text-muted-foreground'
  const map: Record<string, string> = {
    FEE: 'text-emerald-500', EE: 'text-green-500', ME: 'text-blue-500',
    SME: 'text-amber-500', BE: 'text-red-500',
  }
  return map[rating] ?? 'text-foreground'
}

export function PayoutDashboard({
  cycles,
  payoutsByCycle,
}: {
  cycles: CycleSummary[]
  payoutsByCycle: Record<string, PayoutRow[]>
}) {
  const [selectedCycle, setSelectedCycle] = useState<string | null>(
    cycles.length > 0 ? cycles[0].id : null
  )
  const [sortKey, setSortKey] = useState<SortKey>('payoutAmount')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const rows = selectedCycle ? (payoutsByCycle[selectedCycle] ?? []) : []

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const sorted = [...rows].sort((a, b) => {
    let cmp = 0
    if (sortKey === 'finalRating') {
      cmp = (RATING_ORDER[a.finalRating ?? ''] ?? 99) - (RATING_ORDER[b.finalRating ?? ''] ?? 99)
    } else if (sortKey === 'employeeName' || sortKey === 'department') {
      cmp = (a[sortKey] ?? '').localeCompare(b[sortKey] ?? '')
    } else {
      cmp = (a[sortKey] ?? 0) - (b[sortKey] ?? 0)
    }
    return sortDir === 'asc' ? cmp : -cmp
  })

  const totalPayout = rows.reduce((s, r) => s + r.payoutAmount, 0)
  const totalVariablePay = rows.reduce((s, r) => s + r.variablePay, 0)

  function exportCsv() {
    if (rows.length === 0) return
    const header = 'Employee,Department,Final Rating,Variable Pay,Multiplier,Payout Amount'
    const csvRows = sorted.map(r =>
      [r.employeeName, r.department, r.finalRating ?? '—', r.variablePay, r.multiplier, r.payoutAmount].join(',')
    )
    const csv = [header, ...csvRows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const cycleName = cycles.find(c => c.id === selectedCycle)?.name ?? 'payouts'
    a.href = url
    a.download = `payouts-${cycleName}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const SortHeader = ({ label, col }: { label: string; col: SortKey }) => (
    <th
      className="p-3 text-left text-muted-foreground cursor-pointer hover:text-foreground select-none"
      onClick={() => handleSort(col)}
    >
      {label}
      {sortKey === col && <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>}
    </th>
  )

  return (
    <div className="space-y-6">
      {/* Cycle Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cycles.map(c => (
          <button
            key={c.id}
            onClick={() => { setSelectedCycle(c.id); setSortKey('payoutAmount'); setSortDir('desc') }}
            className={`glass rounded-xl p-4 text-left transition-all ${
              selectedCycle === c.id
                ? 'ring-2 ring-primary/50 bg-primary/5'
                : 'hover:bg-muted/30'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">{c.name}</h3>
              {statusBadge(c.status)}
            </div>
            {['locked', 'published'].includes(c.status) ? (
              <div className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Payout</span>
                  <span className="font-semibold">{formatCurrency(c.totalPayout)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Employees</span>
                  <span>{c.employeeCount}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Avg Multiplier</span>
                  <span>{c.avgMultiplier.toFixed(2)}x</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Payouts not yet calculated</p>
            )}
          </button>
        ))}
      </div>

      {/* Employee Table */}
      {selectedCycle && rows.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Employee Breakdown — {cycles.find(c => c.id === selectedCycle)?.name}
            </h2>
            <Button variant="outline" size="sm" onClick={exportCsv}>
              Export CSV
            </Button>
          </div>

          <div className="glass overflow-hidden rounded-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <SortHeader label="Employee" col="employeeName" />
                    <SortHeader label="Department" col="department" />
                    <SortHeader label="Final Rating" col="finalRating" />
                    <th className="p-3 text-right text-muted-foreground cursor-pointer hover:text-foreground select-none" onClick={() => handleSort('variablePay')}>
                      Variable Pay{sortKey === 'variablePay' && <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>}
                    </th>
                    <th className="p-3 text-right text-muted-foreground cursor-pointer hover:text-foreground select-none" onClick={() => handleSort('multiplier')}>
                      Multiplier{sortKey === 'multiplier' && <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>}
                    </th>
                    <th className="p-3 text-right text-muted-foreground cursor-pointer hover:text-foreground select-none" onClick={() => handleSort('payoutAmount')}>
                      Payout{sortKey === 'payoutAmount' && <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>}
                    </th>
                    <th className="p-3 text-right text-xs text-muted-foreground font-medium">PDF</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((r, i) => (
                    <tr key={i} className="border-b border-border">
                      <td className="p-3 font-medium">{r.employeeName}</td>
                      <td className="p-3 text-muted-foreground">{r.department}</td>
                      <td className={`p-3 font-semibold ${ratingColor(r.finalRating)}`}>
                        {r.finalRating ?? '—'}
                      </td>
                      <td className="p-3 text-right tabular-nums text-muted-foreground">
                        {formatCurrency(r.variablePay)}
                      </td>
                      <td className="p-3 text-right tabular-nums text-muted-foreground">
                        x{r.multiplier.toFixed(2)}
                      </td>
                      <td className="p-3 text-right tabular-nums font-semibold">
                        {formatCurrency(r.payoutAmount)}
                      </td>
                      <td className="p-3 text-right">
                        <DownloadAppraisalButton
                          cycleId={r.cycleId}
                          employeeId={r.employeeId}
                          size="icon"
                          variant="ghost"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border font-semibold bg-muted/30">
                    <td className="p-3" colSpan={3}>Total ({rows.length} employees)</td>
                    <td className="p-3 text-right tabular-nums">{formatCurrency(totalVariablePay)}</td>
                    <td className="p-3"></td>
                    <td className="p-3 text-right tabular-nums text-green-600">{formatCurrency(totalPayout)}</td>
                    <td className="p-3"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {selectedCycle && rows.length === 0 && (
        <div className="glass rounded-xl p-8 text-center">
          <p className="text-muted-foreground">No payout data available for this cycle yet. Payouts are calculated when the cycle is locked.</p>
        </div>
      )}
    </div>
  )
}
