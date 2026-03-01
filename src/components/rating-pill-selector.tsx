'use client'

import { cn } from '@/lib/utils'

export type RatingOption = {
  value: string
  label: string
  shortLabel?: string
  color?: string // tailwind bg class for selected state
}

interface RatingPillSelectorProps {
  options: RatingOption[]
  value: string | null
  onChange: (value: string) => void
  name?: string
  disabled?: boolean
  label?: string
}

const DEFAULT_COLORS: Record<string, string> = {
  FEE: 'bg-emerald-600 text-white border-emerald-600',
  EE:  'bg-blue-600 text-white border-blue-600',
  ME:  'bg-primary text-primary-foreground border-primary',
  SME: 'bg-amber-500 text-white border-amber-500',
  BE:  'bg-destructive text-destructive-foreground border-destructive',
}

export function RatingPillSelector({
  options,
  value,
  onChange,
  name,
  disabled = false,
  label,
}: RatingPillSelectorProps) {
  return (
    <div>
      {label && (
        <p className="text-xs font-medium text-muted-foreground mb-1.5">{label}</p>
      )}
      <div
        role="radiogroup"
        aria-label={label}
        className="flex flex-wrap gap-1.5"
      >
        {options.map(option => {
          const selected = value === option.value
          const colorClass = option.color ?? DEFAULT_COLORS[option.value] ?? 'bg-primary text-primary-foreground border-primary'
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              name={name}
              disabled={disabled}
              onClick={() => onChange(option.value)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-all',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                'disabled:cursor-not-allowed disabled:opacity-50',
                selected
                  ? colorClass
                  : 'border-border bg-background text-foreground hover:bg-muted'
              )}
            >
              {option.shortLabel ?? option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// Pre-configured for the standard 5-tier rating scale
export const STANDARD_RATING_OPTIONS: RatingOption[] = [
  { value: 'FEE', label: 'Far Exceeds Expectations', shortLabel: 'FEE' },
  { value: 'EE',  label: 'Exceeds Expectations',     shortLabel: 'EE'  },
  { value: 'ME',  label: 'Meets Expectations',        shortLabel: 'ME'  },
  { value: 'SME', label: 'Some Meets Expectations',   shortLabel: 'SME' },
  { value: 'BE',  label: 'Below Expectations',        shortLabel: 'BE'  },
]
