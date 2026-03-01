'use client'

import { useEffect, useState } from 'react'

export function DensityToggle() {
  const [compact, setCompact] = useState(false)

  // Load preference from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('pms-density')
    if (stored === 'compact') {
      setCompact(true)
      document.documentElement.setAttribute('data-density', 'compact')
    }
  }, [])

  function toggle() {
    const next = !compact
    setCompact(next)
    if (next) {
      document.documentElement.setAttribute('data-density', 'compact')
      localStorage.setItem('pms-density', 'compact')
    } else {
      document.documentElement.removeAttribute('data-density')
      localStorage.setItem('pms-density', 'comfortable')
    }
  }

  return (
    <button
      onClick={toggle}
      title={compact ? 'Switch to comfortable mode' : 'Switch to compact mode'}
      className="w-full rounded-md px-3 py-2 text-xs text-left text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
    >
      <span className="font-mono text-[10px] leading-none border rounded px-1 py-0.5">
        {compact ? '≡' : '☰'}
      </span>
      {compact ? 'Comfortable view' : 'Compact view'}
    </button>
  )
}
