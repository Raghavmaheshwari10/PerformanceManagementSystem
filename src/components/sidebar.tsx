'use client'

import Link from 'next/link'
import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import type { UserRole } from '@/lib/types'
import { cn } from '@/lib/utils'
import { CommandPaletteTrigger } from '@/components/command-palette-trigger'
import { DensityToggle } from '@/components/density-toggle'
import { HelpPanel } from '@/components/help-panel'
import { createClient } from '@/lib/supabase/client'

interface NavItem { label: string; href: string; requireAlsoEmployee?: boolean }

const NAV_ITEMS: Record<UserRole, NavItem[]> = {
  employee: [
    { label: 'My Review',  href: '/employee' },
    { label: 'My History', href: '/employee/history' },
    { label: 'Docs',       href: '/docs' },
    { label: 'Help',       href: '#help' },
  ],
  manager: [
    { label: 'My Team',   href: '/manager' },
    { label: 'My Review', href: '/manager/my-review' },
    { label: 'Docs',      href: '/docs' },
    { label: 'Help',      href: '#help' },
  ],
  hrbp: [
    { label: 'Cycles',      href: '/hrbp' },
    { label: 'Calibration', href: '/hrbp/calibration' },
    { label: 'Audit Log',   href: '/hrbp/audit-log' },
    { label: 'My Review',   href: '/hrbp/my-review', requireAlsoEmployee: true },
    { label: 'Docs',        href: '/docs' },
    { label: 'Help',        href: '#help' },
  ],
  admin: [
    { label: 'Dashboard',     href: '/admin' },
    { label: 'Cycles',        href: '/admin/cycles' },
    { label: 'Users',         href: '/admin/users' },
    { label: 'Departments',   href: '/admin/departments' },
    { label: 'KPI Templates', href: '/admin/kpi-templates' },
    { label: 'Notifications', href: '/admin/notifications' },
    { label: 'Feature Flags', href: '/admin/feature-flags' },
    { label: 'Payout Config', href: '/admin/payout-config' },
    { label: 'Audit Log',     href: '/admin/audit-log' },
    { label: 'Docs',          href: '/docs' },
    { label: 'Help',          href: '#help' },
  ],
}

export function Sidebar({
  role, userName, isAlsoEmployee = false
}: {
  role: UserRole
  userName: string
  isAlsoEmployee?: boolean
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [helpOpen, setHelpOpen] = useState(false)
  const visibleItems = NAV_ITEMS[role].filter(
    item => !item.requireAlsoEmployee || isAlsoEmployee
  )

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
        {visibleItems.map(item =>
          item.href === '#help' ? (
            <button
              key="help"
              onClick={() => setHelpOpen(true)}
              className="rounded-md px-3 py-2 text-sm text-left transition-colors hover:bg-accent"
            >
              {item.label}
            </button>
          ) : (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent",
                (pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href))) && "bg-accent font-medium"
              )}
            >
              {item.label}
            </Link>
          )
        )}
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
      <HelpPanel open={helpOpen} onClose={() => setHelpOpen(false)} />
    </aside>
  )
}
