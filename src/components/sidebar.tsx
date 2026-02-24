'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { UserRole } from '@/lib/types'
import { cn } from '@/lib/utils'

interface NavItem { label: string; href: string }

const NAV_ITEMS: Record<UserRole, NavItem[]> = {
  employee: [
    { label: 'My Review', href: '/employee' },
    { label: 'My History', href: '/employee/history' },
  ],
  manager: [
    { label: 'My Team', href: '/manager' },
    { label: 'My Review', href: '/manager/my-review' },
  ],
  hrbp: [
    { label: 'Cycles', href: '/hrbp' },
    { label: 'Calibration', href: '/hrbp/calibration' },
    { label: 'Audit Log', href: '/hrbp/audit-log' },
  ],
  admin: [
    { label: 'Cycles', href: '/admin' },
    { label: 'Users', href: '/admin/users' },
    { label: 'Audit Log', href: '/admin/audit-log' },
  ],
}

export function Sidebar({ role, userName }: { role: UserRole; userName: string }) {
  const pathname = usePathname()
  const items = NAV_ITEMS[role]

  return (
    <aside className="flex w-64 flex-col border-r bg-muted/40 p-4">
      <div className="mb-6">
        <h2 className="text-lg font-semibold">PMS</h2>
        <p className="text-sm text-muted-foreground">{userName}</p>
      </div>
      <nav className="flex flex-col gap-1">
        {items.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent',
              pathname === item.href && 'bg-accent font-medium'
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  )
}
