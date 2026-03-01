'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import type { UserRole } from '@/lib/types'
import { cn } from '@/lib/utils'
import { CommandPaletteTrigger } from '@/components/command-palette-trigger'
import { DensityToggle } from '@/components/density-toggle'
import { createClient } from '@/lib/supabase/client'

interface NavItem { label: string; href: string }

const NAV_ITEMS: Record<UserRole, NavItem[]> = {
  employee: [
    { label: 'My Review', href: '/employee' },
    { label: 'My History', href: '/employee/history' },
    { label: 'Help', href: '/help' },
  ],
  manager: [
    { label: 'My Team', href: '/manager' },
    { label: 'My Review', href: '/manager/my-review' },
    { label: 'Help', href: '/help' },
  ],
  hrbp: [
    { label: 'Cycles', href: '/hrbp' },
    { label: 'Calibration', href: '/hrbp/calibration' },
    { label: 'Audit Log', href: '/hrbp/audit-log' },
    { label: 'Help', href: '/help' },
  ],
  admin: [
    { label: 'Cycles', href: '/admin' },
    { label: 'Users', href: '/admin/users' },
    { label: 'Feature Flags', href: '/admin/feature-flags' },
    { label: 'Audit Log', href: '/admin/audit-log' },
    { label: 'Help', href: '/help' },
  ],
}

export function Sidebar({ role, userName }: { role: UserRole; userName: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const items = NAV_ITEMS[role]

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="flex w-64 flex-col border-r bg-muted/40 p-4">
      <div className="mb-6">
        <h2 className="text-lg font-semibold">PMS</h2>
        <p className="text-sm text-muted-foreground">{userName}</p>
      </div>
      <div className="mb-3">
        <CommandPaletteTrigger />
      </div>
      <nav className="flex flex-col gap-1">
        {items.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent",
              pathname === item.href && "bg-accent font-medium"
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="mt-auto pt-4 border-t space-y-1">
        <DensityToggle />
        <button
          onClick={handleSignOut}
          className="w-full rounded-md px-3 py-2 text-sm text-left text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          Sign out
        </button>
      </div>
    </aside>
  )
}
