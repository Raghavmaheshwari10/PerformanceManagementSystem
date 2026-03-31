'use client'

import { useCountUp } from '@/hooks/use-count-up'

export function AnimatedDonut({ percent, color, label, sub }: { percent: number; color: string; label: string; sub: string }) {
  const animatedPct = useCountUp(Math.round(percent))
  const r = 32
  const circ = 2 * Math.PI * r
  const dash = circ * Math.min(animatedPct / 100, 1)

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="80" height="80" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={r} fill="none" stroke="currentColor" className="text-muted/40" strokeWidth="6" />
        <circle
          cx="40" cy="40" r={r} fill="none"
          stroke={color} strokeWidth="6"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 40 40)"
          style={{ transition: 'stroke-dasharray 1.2s cubic-bezier(0.16, 1, 0.3, 1)' }}
        />
        <text x="40" y="44" textAnchor="middle" fill="currentColor" fontSize="14" className="font-bold">
          {animatedPct}%
        </text>
      </svg>
      <p className="text-xs font-medium">{label}</p>
      <p className="text-[10px] text-muted-foreground">{sub}</p>
    </div>
  )
}
