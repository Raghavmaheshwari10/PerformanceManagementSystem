'use client'

import { useState, useMemo, useCallback } from 'react'
import {
  ChevronRight,
  ChevronDown,
  Lock,
  AlertTriangle,
  CheckCircle2,
  Building2,
  User,
  Target,
} from 'lucide-react'

// ── Types ──

interface EmployeeAopNode {
  id: string
  employee: { id: string; full_name: string }
  annual_target: number
}

interface DepartmentAopNode {
  id: string
  department: { id: string; name: string }
  status: string // draft | cascaded | locked
  annual_target: number
  employee_aops: EmployeeAopNode[]
}

interface OrgAopNode {
  id: string
  fiscal_year: string
  metric: string
  annual_target: number
  department_aops: DepartmentAopNode[]
}

export interface CascadeTreeProps {
  orgAop: OrgAopNode | null
  departments: { id: string; name: string; dept_head?: string }[]
  /** If set, only show this single department (used in dept-head view) */
  singleDepartmentId?: string
}

// ── Formatting helpers ──

const METRIC_LABELS: Record<string, string> = {
  delivered_revenue: 'Delivered Revenue',
  gross_margin: 'Gross Margin',
  gmv: 'GMV (New Orders)',
}

function formatCurrency(lacs: number): string {
  if (lacs === 0) return '\u20B90'
  if (Math.abs(lacs) >= 100) {
    const cr = lacs / 100
    return `\u20B9${cr.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}Cr`
  }
  return `\u20B9${lacs.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}L`
}

function pct(part: number, whole: number): number {
  if (whole === 0) return 0
  return Math.min(Math.round((part / whole) * 100), 100)
}

// ── Status badge ──

function StatusBadge({ status, percent }: { status: string; percent: number }) {
  if (status === 'locked') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/25 px-2.5 py-0.5 text-[11px] font-medium text-emerald-400">
        <Lock className="h-3 w-3" />
        Locked
      </span>
    )
  }
  if (percent > 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/25 px-2.5 py-0.5 text-[11px] font-medium text-amber-400">
        <AlertTriangle className="h-3 w-3" />
        In Progress
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-white/5 border border-white/10 px-2.5 py-0.5 text-[11px] font-medium text-white/40">
      Not Started
    </span>
  )
}

// ── Progress bar ──

function ProgressBar({ percent }: { percent: number }) {
  const barColor =
    percent >= 100
      ? 'bg-emerald-500'
      : percent > 0
        ? 'bg-amber-500'
        : 'bg-white/20'

  return (
    <div className="flex items-center gap-2 mt-1.5">
      <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
      <span className={`text-[11px] font-mono tabular-nums ${
        percent >= 100 ? 'text-emerald-400' : percent > 0 ? 'text-amber-400' : 'text-white/30'
      }`}>
        {percent}%
      </span>
    </div>
  )
}

// ── Department node ──

function DepartmentNode({
  dept,
  deptHead,
}: {
  dept: DepartmentAopNode
  deptHead?: string
}) {
  const [expanded, setExpanded] = useState(false)

  const empTotal = useMemo(
    () => dept.employee_aops.reduce((s, e) => s + e.annual_target, 0),
    [dept.employee_aops]
  )
  const unallocated = dept.annual_target - empTotal
  const percent = pct(empTotal, dept.annual_target)

  const toggle = useCallback(() => setExpanded((prev) => !prev), [])

  const ChevronIcon = expanded ? ChevronDown : ChevronRight

  return (
    <div className="rounded-lg bg-white/[0.03] border border-white/[0.07] overflow-hidden">
      {/* Department header — clickable */}
      <button
        type="button"
        onClick={toggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.03] transition-colors group"
      >
        <ChevronIcon className="h-4 w-4 text-white/40 shrink-0 group-hover:text-white/60 transition-colors" />
        <Building2 className="h-4 w-4 text-indigo-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-white/90 truncate">
              {dept.department.name}
            </span>
            <span className="text-xs text-white/40">
              {formatCurrency(dept.annual_target)}
            </span>
            {deptHead && (
              <span className="text-xs text-white/30">
                — Head: {deptHead}
              </span>
            )}
          </div>
          <ProgressBar percent={percent} />
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          {percent >= 100 && dept.status !== 'locked' && (
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          )}
          <StatusBadge status={dept.status} percent={percent} />
        </div>
      </button>

      {/* Expanded employee list */}
      {expanded && (
        <div className="border-t border-white/[0.05] px-4 py-2 space-y-1">
          {dept.employee_aops.length === 0 ? (
            <p className="text-xs text-white/30 py-2 pl-8">No employees assigned yet</p>
          ) : (
            dept.employee_aops.map((emp) => (
              <div
                key={emp.id}
                className="flex items-center gap-3 py-1.5 pl-8"
              >
                <User className="h-3.5 w-3.5 text-white/30 shrink-0" />
                <span className="text-xs text-white/70 flex-1 truncate">
                  {emp.employee.full_name}
                </span>
                <span className="text-xs font-mono text-white/60 tabular-nums">
                  {formatCurrency(emp.annual_target)}
                </span>
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400/70" />
              </div>
            ))
          )}

          {/* Unallocated row */}
          {Math.abs(unallocated) > 0.005 && (
            <div className="flex items-center gap-3 py-1.5 pl-8 border-t border-white/5 mt-1 pt-2">
              <Target className="h-3.5 w-3.5 text-amber-400/60 shrink-0" />
              <span className="text-xs text-amber-400/80 flex-1">Unallocated</span>
              <span className="text-xs font-mono text-amber-400 tabular-nums">
                {formatCurrency(unallocated)}
              </span>
              <AlertTriangle className="h-3.5 w-3.5 text-amber-400/70" />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main tree component ──

export function AopCascadeTree({ orgAop, departments, singleDepartmentId }: CascadeTreeProps) {
  // Hooks must be called before any early returns (Rules of Hooks)
  const deptHeadMap = useMemo(() => {
    const map: Record<string, string | undefined> = {}
    for (const d of departments) {
      map[d.id] = d.dept_head
    }
    return map
  }, [departments])

  if (!orgAop) {
    return (
      <div className="glass rounded-xl border border-white/10 p-8 text-center">
        <Target className="h-8 w-8 text-white/20 mx-auto mb-3" />
        <p className="text-sm text-white/40">
          No AOP target set yet for this metric and fiscal year.
        </p>
      </div>
    )
  }

  // Filter to single department if specified
  const visibleDepts = singleDepartmentId
    ? orgAop.department_aops.filter((d) => d.department.id === singleDepartmentId)
    : orgAop.department_aops

  // Org-level stats
  const deptAllocatedTotal = visibleDepts.reduce((s, d) => s + d.annual_target, 0)
  const orgUnallocated = singleDepartmentId
    ? 0 // not relevant in single-dept view
    : orgAop.annual_target - orgAop.department_aops.reduce((s, d) => s + d.annual_target, 0)
  const orgPercent = pct(
    orgAop.department_aops.reduce((s, d) => s + d.annual_target, 0),
    orgAop.annual_target
  )

  const metricLabel = METRIC_LABELS[orgAop.metric] ?? orgAop.metric

  return (
    <div className="space-y-3">
      {/* Org-level header */}
      {!singleDepartmentId && (
        <div className="glass rounded-xl border border-white/10 px-5 py-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
                <Target className="h-4 w-4 text-indigo-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white/90">
                    {metricLabel}
                  </span>
                  <span className="text-xs text-white/40">
                    {orgAop.fiscal_year}
                  </span>
                </div>
                <span className="text-lg font-mono font-semibold text-white/90">
                  {formatCurrency(orgAop.annual_target)}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs">
              {orgPercent >= 100 ? (
                <span className="inline-flex items-center gap-1 text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                  100% allocated
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-amber-400">
                  <AlertTriangle className="h-4 w-4" />
                  {orgPercent}% allocated to departments
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Department nodes */}
      <div className="space-y-2">
        {visibleDepts.map((dept) => (
          <DepartmentNode
            key={dept.id}
            dept={dept}
            deptHead={deptHeadMap[dept.department.id]}
          />
        ))}
      </div>

      {/* Org-level unallocated */}
      {!singleDepartmentId && Math.abs(orgUnallocated) > 0.005 && (
        <div className="flex items-center gap-3 px-5 py-2.5 rounded-lg bg-white/[0.02] border border-white/[0.05]">
          <Target className="h-4 w-4 text-amber-400/60 shrink-0" />
          <span className="text-xs text-amber-400/80 flex-1">
            Unallocated to departments
          </span>
          <span className="text-xs font-mono text-amber-400 tabular-nums">
            {formatCurrency(orgUnallocated)}
          </span>
        </div>
      )}

      {/* Fully allocated indicator at org level */}
      {!singleDepartmentId && Math.abs(orgUnallocated) < 0.005 && (
        <div className="flex items-center gap-3 px-5 py-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
          <CheckCircle2 className="h-4 w-4 text-emerald-400/60 shrink-0" />
          <span className="text-xs text-emerald-400/70 flex-1">
            Fully allocated to departments
          </span>
          <span className="text-xs font-mono text-emerald-400 tabular-nums">
            {formatCurrency(0)}
          </span>
        </div>
      )}

      {/* Summary stats */}
      {!singleDepartmentId && (
        <div className="grid grid-cols-3 gap-3 pt-1">
          <div className="rounded-lg bg-white/[0.03] border border-white/[0.07] px-4 py-3 text-center">
            <p className="text-[10px] text-white/40 uppercase tracking-wider">Departments</p>
            <p className="text-lg font-semibold text-white/80 mt-0.5">{orgAop.department_aops.length}</p>
          </div>
          <div className="rounded-lg bg-white/[0.03] border border-white/[0.07] px-4 py-3 text-center">
            <p className="text-[10px] text-white/40 uppercase tracking-wider">Locked</p>
            <p className="text-lg font-semibold text-emerald-400 mt-0.5">
              {orgAop.department_aops.filter((d) => d.status === 'locked').length}
            </p>
          </div>
          <div className="rounded-lg bg-white/[0.03] border border-white/[0.07] px-4 py-3 text-center">
            <p className="text-[10px] text-white/40 uppercase tracking-wider">Total Employees</p>
            <p className="text-lg font-semibold text-white/80 mt-0.5">
              {orgAop.department_aops.reduce((s, d) => s + d.employee_aops.length, 0)}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
