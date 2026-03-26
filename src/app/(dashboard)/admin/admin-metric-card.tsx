'use client'

import { useCountUp } from '@/hooks/use-count-up'

export function AdminMetricCard({ value, label, suffix = '' }: { value: number; label: string; suffix?: string }) {
  const animated = useCountUp(value)
  return (
    <div className="glass p-5 flex flex-col items-center justify-center text-center">
      <p className="text-3xl font-bold tabular-nums tracking-tight" style={{ animation: 'countUp 0.5s ease-out both' }}>
        {animated.toLocaleString()}{suffix}
      </p>
      <p className="text-xs text-muted-foreground mt-1.5">{label}</p>
    </div>
  )
}
