'use client'
import { useCommandPalette } from '@/components/command-palette'

export function CommandPaletteTrigger() {
  const { setOpen } = useCommandPalette()
  return (
    <button
      onClick={() => setOpen(true)}
      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] text-slate-400 transition-all bg-slate-50 border border-slate-200 hover:bg-slate-100 hover:border-slate-300"
      aria-label="Open command palette"
    >
      <span className="flex-1 text-left">Search…</span>
      <kbd className="rounded border border-slate-200 bg-white px-1.5 text-[10px] font-mono text-slate-400">⌘K</kbd>
    </button>
  )
}
