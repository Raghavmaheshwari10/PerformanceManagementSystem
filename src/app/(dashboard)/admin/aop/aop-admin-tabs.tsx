'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'
import { TableProperties, GitBranch } from 'lucide-react'
import { AopForm } from './aop-form'
import { AopCascadeTree, type CascadeTreeProps } from '@/components/aop-cascade-tree'

interface SerializedOrgAop {
  id: string
  fiscal_year: string
  metric: string
  annual_target: number
  apr: number; may: number; jun: number; jul: number
  aug: number; sep: number; oct: number; nov: number
  dec: number; jan: number; feb: number; mar: number
  department_aops: {
    id: string
    org_aop_id: string
    department_id: string
    department_name: string
    annual_target: number
    apr: number; may: number; jun: number; jul: number
    aug: number; sep: number; oct: number; nov: number
    dec: number; jan: number; feb: number; mar: number
  }[]
}

interface Props {
  departments: { id: string; name: string }[]
  departmentsWithHeads: { id: string; name: string; dept_head?: string }[]
  orgAops: SerializedOrgAop[]
  selectedFy: string
  selectedMetric: string
  selectedView: string
  cascadeTree: CascadeTreeProps['orgAop'] | null
}

const VIEWS = [
  { value: 'targets', label: 'Targets', icon: TableProperties },
  { value: 'tree', label: 'Cascade Tree', icon: GitBranch },
] as const

const FY_OPTIONS = ['FY25', 'FY26', 'FY27', 'FY28'] as const

const METRICS = [
  { value: 'delivered_revenue', label: 'Delivered Revenue' },
  { value: 'gross_margin', label: 'Gross Margin' },
  { value: 'gmv', label: 'GMV' },
] as const

export function AopAdminTabs({
  departments,
  departmentsWithHeads,
  orgAops,
  selectedFy,
  selectedMetric,
  selectedView,
  cascadeTree,
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set(key, value)
      router.push(`/admin/aop?${params.toString()}`)
    },
    [router, searchParams]
  )

  return (
    <div className="space-y-6">
      {/* View toggle */}
      <div className="flex items-center gap-1 rounded-lg bg-white/5 border border-white/10 p-1 w-fit">
        {VIEWS.map((view) => {
          const Icon = view.icon
          const isActive = selectedView === view.value
          return (
            <button
              key={view.value}
              type="button"
              onClick={() => updateParam('view', view.value)}
              className={`flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-sm font-medium transition-all ${
                isActive
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                  : 'text-white/50 hover:text-white/70 border border-transparent'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {view.label}
            </button>
          )
        })}
      </div>

      {/* Render the active view */}
      {selectedView === 'targets' ? (
        <AopForm
          departments={departments}
          orgAops={orgAops}
          selectedFy={selectedFy}
          selectedMetric={selectedMetric}
        />
      ) : (
        <div className="space-y-6">
          {/* FY Selector for tree view */}
          <div className="flex items-center gap-2">
            {FY_OPTIONS.map((fy) => (
              <button
                key={fy}
                type="button"
                onClick={() => updateParam('fy', fy)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                  selectedFy === fy
                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                    : 'glass-interactive border border-white/10 text-white/60 hover:text-white/80'
                }`}
              >
                {fy}
              </button>
            ))}
          </div>

          {/* Metric Tabs for tree view */}
          <div className="flex border-b border-white/10">
            {METRICS.map((metric) => (
              <button
                key={metric.value}
                type="button"
                onClick={() => updateParam('metric', metric.value)}
                className={`px-5 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px ${
                  selectedMetric === metric.value
                    ? 'border-indigo-500 text-indigo-300'
                    : 'border-transparent text-white/50 hover:text-white/70 hover:border-white/20'
                }`}
              >
                {metric.label}
              </button>
            ))}
          </div>

          <AopCascadeTree
            orgAop={cascadeTree}
            departments={departmentsWithHeads}
          />
        </div>
      )}
    </div>
  )
}
