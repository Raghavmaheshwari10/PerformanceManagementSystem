'use client'
import { useCommandPalette } from '@/components/command-palette'

export function CommandPaletteTrigger() {
  const { setOpen } = useCommandPalette()
  return (
    <button
      onClick={() => setOpen(true)}
      className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-all bg-muted/30 border border-border backdrop-blur-sm hover:bg-muted/50 hover:border-border"
      aria-label="Open command palette"
    >
      <span className="flex-1 text-left">Search…</span>
      <kbd className="rounded border bg-muted px-1.5 text-xs font-mono">⌘K</kbd>
    </button>
  )
}
