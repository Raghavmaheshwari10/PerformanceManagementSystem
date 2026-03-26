'use client'
import { useCommandPalette } from '@/components/command-palette'

export function CommandPaletteTrigger() {
  const { setOpen } = useCommandPalette()
  return (
    <button
      onClick={() => setOpen(true)}
      className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-all bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] backdrop-blur-sm hover:bg-[rgba(255,255,255,0.07)] hover:border-[rgba(255,255,255,0.12)]"
      aria-label="Open command palette"
    >
      <span className="flex-1 text-left">Search…</span>
      <kbd className="rounded border bg-muted px-1.5 text-xs font-mono">⌘K</kbd>
    </button>
  )
}
