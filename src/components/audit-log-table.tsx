'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { AuditLog } from '@/lib/types'
import { cn } from '@/lib/utils'
import { toTitleCase } from '@/lib/constants'

interface AuditLogRow extends AuditLog {
  changed_by_user?: { full_name: string } | null
}

interface AuditLogTableProps {
  logs: AuditLogRow[]
  page: number
  hasMore: boolean
  baseUrl: string
}

const ACTION_GROUPS: Record<string, string[] | null> = {
  'All':        null,
  'User Mgmt':  ['user_created','user_updated','user_deleted','role_change','toggle_active','bulk_department_update','bulk_role_update','bulk_toggle_active','bulk_delete_users','csv_upload'],
  'Cycle':      ['cycle_created','cycle_status_changed','department_status_changed','employee_status_override_set','employee_status_override_cleared'],
  'KRA/KPI':    ['kra_added','kra_deleted','kpi_added','kpi_deleted','kpis_finalized','kpis_unfinalized'],
  'Reviews':    ['review_submitted','manager_review_submitted','override_rating','rating_override'],
  'Config':     ['payout_config_updated','department_created','hrbp_departments_updated'],
}

export function AuditLogTable({ logs, page, hasMore, baseUrl }: AuditLogTableProps) {
  const [filter, setFilter] = useState<string>('All')

  const prevUrl = page > 1 ? `${baseUrl}?page=${page - 1}` : null
  const nextUrl = hasMore ? `${baseUrl}?page=${page + 1}` : null

  const filteredLogs = filter === 'All'
    ? logs
    : logs.filter(l => ACTION_GROUPS[filter]?.includes(l.action) ?? false)

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap mb-4">
        {Object.keys(ACTION_GROUPS).map(g => (
          <button
            key={g}
            onClick={() => setFilter(g)}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium transition-colors',
              filter === g ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            )}
          >
            {g}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="p-3 text-left text-xs font-semibold text-slate-500">Timestamp</th>
              <th className="p-3 text-left text-xs font-semibold text-slate-500">User</th>
              <th className="p-3 text-left text-xs font-semibold text-slate-500">Action</th>
              <th className="p-3 text-left text-xs font-semibold text-slate-500">Entity</th>
              <th className="p-3 text-left text-xs font-semibold text-slate-500">Details</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-slate-400">No audit log entries.</td>
              </tr>
            )}
            {filteredLogs.map(log => (
              <tr key={log.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td className="p-3 text-xs text-slate-500">{new Date(log.created_at).toLocaleString()}</td>
                <td className="p-3 font-medium text-slate-800">{log.changed_by_user?.full_name ?? 'System'}</td>
                <td className="p-3">
                  <span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                    {toTitleCase(log.action)}
                  </span>
                </td>
                <td className="p-3 text-xs text-slate-600">{toTitleCase(log.entity_type)}</td>
                <td className="p-3 text-xs text-slate-400">
                  {log.justification ?? (log.new_value ? summarizeChange(log.new_value) : '—')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-400">Page {page}</span>
        <div className="flex gap-2">
          {prevUrl ? (
            <Link href={prevUrl} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs hover:bg-slate-50">Previous</Link>
          ) : (
            <span className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-300 cursor-not-allowed">Previous</span>
          )}
          {nextUrl ? (
            <Link href={nextUrl} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs hover:bg-slate-50">Next</Link>
          ) : (
            <span className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-300 cursor-not-allowed">Next</span>
          )}
        </div>
      </div>
    </div>
  )
}

/** Summarize JSON change data into a readable string */
function summarizeChange(value: unknown): string {
  if (!value || typeof value !== 'object') return '—'
  const obj = value as Record<string, unknown>
  const parts: string[] = []
  for (const [key, val] of Object.entries(obj)) {
    if (val === null || val === undefined) continue
    const label = toTitleCase(key)
    parts.push(`${label}: ${String(val)}`)
  }
  return parts.length > 0 ? parts.slice(0, 3).join(', ') : '—'
}
