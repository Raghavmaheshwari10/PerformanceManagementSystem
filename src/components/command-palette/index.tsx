'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { CommandPalette } from './command-palette'
import type { PaletteCommand } from './commands'
import type { UserRole } from '@/lib/types'

interface CtxValue {
  addCommands: (cmds: PaletteCommand[]) => void
  removeCommands: (ids: string[]) => void
  setOpen: (v: boolean) => void
}

const Ctx = createContext<CtxValue | null>(null)

export function useCommandPalette() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('CommandPaletteProvider missing')
  return ctx
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (target.isContentEditable) return true
  return false
}

export function CommandPaletteProvider({
  role,
  children,
}: {
  role: UserRole
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [extra, setExtra] = useState<PaletteCommand[]>([])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(v => !v)
        return
      }
      if (e.key === '/' && !isEditableTarget(e.target)) {
        e.preventDefault()
        setOpen(true)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return (
    <Ctx.Provider
      value={{
        addCommands: cmds => setExtra(p => [...p, ...cmds]),
        removeCommands: ids => setExtra(p => p.filter(c => !ids.includes(c.id))),
        setOpen,
      }}
    >
      <CommandPalette role={role} extraCommands={extra} open={open} onOpenChange={setOpen} />
      {children}
    </Ctx.Provider>
  )
}
