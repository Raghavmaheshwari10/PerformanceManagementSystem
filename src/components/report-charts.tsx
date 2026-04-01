'use client'

import { useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend, Cell, PieChart, Pie,
  LineChart, Line,
} from 'recharts'

/* ── Color palettes ── */

const RATING_COLORS: Record<string, string> = {
  FEE: '#34d399', // emerald-400
  EE:  '#4ade80', // green-400
  ME:  '#60a5fa', // blue-400
  SME: '#fbbf24', // amber-400
  BE:  '#f87171', // red-400
}

const DEPT_COLORS = [
  '#818cf8', '#a78bfa', '#c084fc', '#e879f9', '#f472b6',
  '#fb923c', '#facc15', '#34d399', '#22d3ee', '#60a5fa',
]

const TOOLTIP_STYLE = {
  contentStyle: {
    background: 'rgba(15, 23, 42, 0.95)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    fontSize: '12px',
    color: '#e2e8f0',
  },
  labelStyle: { color: '#94a3b8', fontWeight: 600, marginBottom: 4 },
}

/* ── Rating Distribution Bar Chart ── */

export interface RatingDistData {
  tier: string
  label: string
  count: number
}

export function RatingDistributionChart({ data }: { data: RatingDistData[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} layout="vertical" margin={{ left: 100, right: 30, top: 5, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" horizontal={false} />
        <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis
          type="category"
          dataKey="label"
          tick={{ fill: '#94a3b8', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={95}
        />
        <Tooltip {...TOOLTIP_STYLE} />
        <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={28}>
          {data.map((entry) => (
            <Cell key={entry.tier} fill={RATING_COLORS[entry.tier] ?? '#64748b'} fillOpacity={0.85} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

/* ── Cross-Cycle Trend Line Chart ── */

export interface CycleTrendData {
  cycleName: string
  FEE: number
  EE: number
  ME: number
  SME: number
  BE: number
}

export function CycleTrendChart({ data }: { data: CycleTrendData[] }) {
  if (data.length < 2) return <p className="text-xs text-muted-foreground italic">Need at least 2 cycles for trend.</p>
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ left: 10, right: 30, top: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
        <XAxis dataKey="cycleName" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
        <Tooltip {...TOOLTIP_STYLE} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {(['FEE', 'EE', 'ME', 'SME', 'BE'] as const).map(tier => (
          <Line
            key={tier}
            type="monotone"
            dataKey={tier}
            stroke={RATING_COLORS[tier]}
            strokeWidth={2}
            dot={{ r: 4, strokeWidth: 2 }}
            activeDot={{ r: 6 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

/* ── Department Heatmap (Stacked Bar) ── */

export interface DeptHeatmapData {
  department: string
  FEE: number
  EE: number
  ME: number
  SME: number
  BE: number
}

export function DeptHeatmapChart({ data }: { data: DeptHeatmapData[] }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 40 + 40)}>
      <BarChart data={data} layout="vertical" margin={{ left: 120, right: 30, top: 5, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" horizontal={false} />
        <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis
          type="category"
          dataKey="department"
          tick={{ fill: '#94a3b8', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={115}
        />
        <Tooltip {...TOOLTIP_STYLE} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {(['FEE', 'EE', 'ME', 'SME', 'BE'] as const).map(tier => (
          <Bar key={tier} dataKey={tier} stackId="a" fill={RATING_COLORS[tier]} fillOpacity={0.85} maxBarSize={24} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

/* ── Payout Summary Pie Chart ── */

export interface PayoutPieData {
  name: string
  value: number
}

export function PayoutPieChart({ data }: { data: PayoutPieData[] }) {
  const total = useMemo(() => data.reduce((s, d) => s + d.value, 0), [data])
  if (total === 0) return <p className="text-xs text-muted-foreground italic">No payout data.</p>
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={90}
          paddingAngle={2}
          dataKey="value"
          nameKey="name"
          label={({ name, percent }: any) => `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`}
          labelLine={{ stroke: '#64748b' }}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={DEPT_COLORS[i % DEPT_COLORS.length]} fillOpacity={0.85} />
          ))}
        </Pie>
        <Tooltip
          {...TOOLTIP_STYLE}
          formatter={(value: unknown) => [`₹${Number(value ?? 0).toLocaleString('en-IN')}`, 'Payout']}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}

/* ── Completion Trend Bar Chart ── */

export interface CompletionTrendData {
  cycleName: string
  selfReview: number
  managerReview: number
}

export function CompletionTrendChart({ data }: { data: CompletionTrendData[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ left: 10, right: 30, top: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
        <XAxis dataKey="cycleName" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} unit="%" />
        <Tooltip {...TOOLTIP_STYLE} formatter={(v: unknown) => [`${v}%`, '']} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="selfReview" name="Self Review %" fill="#60a5fa" radius={[4, 4, 0, 0]} maxBarSize={32} fillOpacity={0.85} />
        <Bar dataKey="managerReview" name="Manager Review %" fill="#a78bfa" radius={[4, 4, 0, 0]} maxBarSize={32} fillOpacity={0.85} />
      </BarChart>
    </ResponsiveContainer>
  )
}
