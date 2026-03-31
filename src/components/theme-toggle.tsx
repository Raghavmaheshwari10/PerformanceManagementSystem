'use client'

import { useTheme } from '@/components/theme-provider'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  const options: { value: 'light' | 'dark' | 'system'; label: string; icon: string }[] = [
    { value: 'light', label: 'Light', icon: '\u2600' },
    { value: 'dark', label: 'Dark', icon: '\u263E' },
    { value: 'system', label: 'System', icon: '\u2699' },
  ]

  return (
    <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/50 p-0.5">
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => setTheme(opt.value)}
          className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-all ${
            theme === opt.value
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          title={opt.label}
        >
          <span className="mr-1">{opt.icon}</span>
          {opt.label}
        </button>
      ))}
    </div>
  )
}
