'use client'
import { useRouter } from 'next/navigation'
import { Command } from 'cmdk'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { useFrecency } from '@/hooks/use-frecency'
import { STATIC_COMMANDS, type PaletteCommand } from './commands'
import type { UserRole } from '@/lib/types'

interface Props {
  role: UserRole
  extraCommands?: PaletteCommand[]
  open: boolean
  onOpenChange: (v: boolean) => void
}

export function CommandPalette({ role, extraCommands = [], open, onOpenChange }: Props) {
  const router = useRouter()
  const { record, getScore } = useFrecency()

  const all = [...STATIC_COMMANDS, ...extraCommands]
    .filter(cmd => cmd.roles.length === 0 || cmd.roles.includes(role))
    .sort((a, b) => getScore(b.id) - getScore(a.id))

  function run(cmd: PaletteCommand) {
    record(cmd.id)
    onOpenChange(false)
    if (cmd.href) router.push(cmd.href)
    else cmd.action?.()
  }

  const recent  = all.filter(c => getScore(c.id) > 0)
  const theRest = all.filter(c => getScore(c.id) === 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 max-w-xl overflow-hidden [&>button]:hidden">
        <Command className="rounded-lg">
          <div className="flex items-center border-b px-3">
            <Command.Input
              placeholder="Type a command or search…"
              className="flex h-11 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <Command.List className="max-h-[300px] overflow-y-auto overflow-x-hidden p-1">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
              No results found.
            </Command.Empty>
            {recent.length > 0 && (
              <Command.Group heading="Recent">
                {recent.map(cmd => (
                  <Command.Item
                    key={cmd.id}
                    value={[cmd.label, ...(cmd.keywords ?? [])].join(' ')}
                    onSelect={() => run(cmd)}
                    className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                  >
                    {cmd.label}
                    {cmd.description && (
                      <span className="ml-auto text-xs text-muted-foreground">{cmd.description}</span>
                    )}
                  </Command.Item>
                ))}
              </Command.Group>
            )}
            <Command.Group heading="All commands">
              {theRest.map(cmd => (
                <Command.Item
                  key={cmd.id}
                  value={[cmd.label, ...(cmd.keywords ?? [])].join(' ')}
                  onSelect={() => run(cmd)}
                  className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                >
                  {cmd.label}
                </Command.Item>
              ))}
            </Command.Group>
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
