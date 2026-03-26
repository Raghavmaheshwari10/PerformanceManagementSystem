'use client'

import Link from 'next/link'
import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'
import type { UserRole } from '@/lib/types'
import { cn } from '@/lib/utils'
import { CommandPaletteTrigger } from '@/components/command-palette-trigger'
import { DensityToggle } from '@/components/density-toggle'
import { HelpPanel } from '@/components/help-panel'
import {
  ClipboardCheck, History, Target, MessageSquare, Users2,
  UserCircle, LayoutDashboard, CalendarClock, UserCog,
  Building2, FileBarChart, Settings2, BarChart3, Scale,
  ScrollText, BookOpen, HelpCircle, LogOut, Flag,
  Wallet, Bell, FileSpreadsheet, Menu, X, ChevronRight,
} from 'lucide-react'

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  requireAlsoEmployee?: boolean
}

const NAV_ITEMS: Record<UserRole, NavItem[]> = {
  employee: [
    { label: 'My Review',    href: '/employee',              icon: ClipboardCheck },
    { label: 'My History',   href: '/employee/history',      icon: History },
    { label: 'Goals',        href: '/employee/goals',        icon: Target },
    { label: 'Feedback',     href: '/employee/feedback',     icon: MessageSquare },
    { label: 'Peer Reviews', href: '/employee/peer-reviews', icon: Users2 },
    { label: 'Profile',      href: '/employee/profile',      icon: UserCircle },
    { label: 'Docs',         href: '/docs',                  icon: BookOpen },
    { label: 'Help',         href: '#help',                  icon: HelpCircle },
  ],
  manager: [
    { label: 'My Team',   href: '/manager',           icon: Users2 },
    { label: 'My Review', href: '/manager/my-review',  icon: ClipboardCheck },
    { label: 'Docs',      href: '/docs',               icon: BookOpen },
    { label: 'Help',      href: '#help',               icon: HelpCircle },
  ],
  hrbp: [
    { label: 'Cycles',      href: '/hrbp',             icon: CalendarClock },
    { label: 'Calibration', href: '/hrbp/calibration',  icon: Scale },
    { label: 'Employees',   href: '/hrbp/employees',    icon: Users2 },
    { label: 'Reports',     href: '/hrbp/reports',      icon: BarChart3 },
    { label: 'Audit Log',   href: '/hrbp/audit-log',    icon: ScrollText },
    { label: 'My Review',   href: '/hrbp/my-review',    icon: ClipboardCheck, requireAlsoEmployee: true },
    { label: 'Docs',        href: '/docs',              icon: BookOpen },
    { label: 'Help',        href: '#help',              icon: HelpCircle },
  ],
  admin: [
    { label: 'Dashboard',        href: '/admin',                 icon: LayoutDashboard },
    { label: 'Cycles',           href: '/admin/cycles',          icon: CalendarClock },
    { label: 'Users',            href: '/admin/users',           icon: UserCog },
    { label: 'Departments',      href: '/admin/departments',     icon: Building2 },
    { label: 'KPI Templates',    href: '/admin/kpi-templates',   icon: FileBarChart },
    { label: 'Competencies',     href: '/admin/competencies',    icon: Target },
    { label: 'Review Templates', href: '/admin/review-templates', icon: FileSpreadsheet },
    { label: 'Notifications',    href: '/admin/notifications',   icon: Bell },
    { label: 'Feature Flags',    href: '/admin/feature-flags',   icon: Flag },
    { label: 'Payout Config',    href: '/admin/payout-config',   icon: Wallet },
    { label: 'Audit Log',        href: '/admin/audit-log',       icon: ScrollText },
    { label: 'Docs',             href: '/docs',                  icon: BookOpen },
    { label: 'Help',             href: '#help',                  icon: HelpCircle },
  ],
}

const ROLE_RING_COLOR: Record<UserRole, string> = {
  admin: 'ring-indigo-500',
  employee: 'ring-emerald-500',
  manager: 'ring-amber-500',
  hrbp: 'ring-purple-500',
}

function UserAvatar({ name, size = 'md', role }: { name: string; size?: 'sm' | 'md'; role?: UserRole }) {
  const initials = name
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div className={cn(
      'flex items-center justify-center rounded-full bg-sidebar-primary text-sidebar-primary-foreground font-semibold shrink-0',
      size === 'sm' ? 'h-7 w-7 text-[10px]' : 'h-9 w-9 text-xs',
      role && 'ring-2',
      role && ROLE_RING_COLOR[role],
    )}>
      {initials}
    </div>
  )
}

/** Gradient mesh background layer for the sidebar */
function SidebarMesh() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{
        background: [
          'radial-gradient(ellipse 300px 400px at 20% 15%, oklch(0.45 0.18 265 / 0.10), transparent)',
          'radial-gradient(ellipse 250px 300px at 80% 75%, oklch(0.5 0.2 310 / 0.07), transparent)',
        ].join(', '),
      }}
    />
  )
}

const activeNavStyle: React.CSSProperties = {
  background: 'linear-gradient(135deg, oklch(0.3 0.08 265), oklch(0.25 0.1 280), oklch(0.3 0.08 265))',
  backgroundSize: '200% 200%',
  animation: 'shimmer 3s ease infinite',
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
  const [mobileOpen, setMobileOpen] = useState(false)
  const visibleItems = NAV_ITEMS[role].filter(
    item => !item.requireAlsoEmployee || isAlsoEmployee
  )

  async function handleSignOut() {
    await signOut({ redirect: false })
    router.push('/login')
  }

  const sidebarContent = (
    <>
      {/* Logo + Brand */}
      <div className="px-4 pt-5 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary/20 border border-sidebar-border shadow-[0_0_12px_oklch(0.65_0.22_265_/_0.3)]">
            <svg viewBox="0 0 24 24" className="h-4 w-4 text-sidebar-primary" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v20M2 12h20M5.636 5.636l12.728 12.728M18.364 5.636L5.636 18.364" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-sidebar-foreground tracking-tight">PMS</p>
            <p className="text-[10px] text-sidebar-foreground/50 uppercase tracking-wider">EMB Global</p>
          </div>
        </div>
      </div>

      {/* Search trigger */}
      <div className="px-3 mb-3">
        <CommandPaletteTrigger />
      </div>

      <div className="gradient-divider mx-3 my-1" />

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 space-y-0.5">
        {visibleItems.map(item => {
          const Icon = item.icon
          const isActive = item.href !== '#help' &&
            (pathname === item.href || (item.href !== '/admin' && item.href !== '/employee' && pathname.startsWith(item.href)))
          const isExactActive = pathname === item.href

          if (item.href === '#help') {
            return (
              <button
                key="help"
                onClick={() => setHelpOpen(true)}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/70 transition-colors hover:bg-[rgba(255,255,255,0.05)] hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)] hover:text-sidebar-accent-foreground"
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </button>
            )
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all',
                (isActive || isExactActive)
                  ? 'text-sidebar-accent-foreground font-medium shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]'
                  : 'text-sidebar-foreground/70 hover:bg-[rgba(255,255,255,0.05)] hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)] hover:text-sidebar-accent-foreground'
              )}
              style={(isActive || isExactActive) ? activeNavStyle : undefined}
            >
              <Icon className={cn(
                'h-4 w-4 shrink-0',
                (isActive || isExactActive) ? 'text-sidebar-primary' : ''
              )} />
              {item.label}
              {(isActive || isExactActive) && (
                <ChevronRight className="h-3 w-3 ml-auto opacity-50" />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="mt-auto px-3 py-3 space-y-1">
        <div className="gradient-divider mb-3" />
        <DensityToggle />
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/60 transition-colors hover:bg-[rgba(255,255,255,0.05)] hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)] hover:text-sidebar-accent-foreground"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
        <div className="flex items-center gap-2.5 px-3 py-2 mt-1 rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)]">
          <UserAvatar name={userName} size="sm" role={role} />
          <div className="min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">{userName}</p>
            <p className="text-[10px] text-sidebar-foreground/50 capitalize">{role}</p>
          </div>
        </div>
      </div>
    </>
  )

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-3 left-3 z-50 flex h-9 w-9 items-center justify-center rounded-lg border bg-background shadow-sm lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-4 w-4" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Mobile sidebar */}
      <aside className={cn(
        'fixed inset-y-0 left-0 z-50 flex w-64 flex-col transition-transform duration-300 lg:hidden relative overflow-hidden',
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      )}
        style={{
          background: 'rgba(11, 11, 30, 0.85)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRight: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <SidebarMesh />
        <div className="relative z-10 flex flex-col h-full">
          <button
            onClick={() => setMobileOpen(false)}
            className="absolute top-3 right-3 flex h-7 w-7 items-center justify-center rounded-md text-sidebar-foreground/60 hover:text-sidebar-foreground"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
          {sidebarContent}
        </div>
      </aside>

      {/* Desktop sidebar */}
      <aside
        className="hidden lg:flex w-64 flex-col shrink-0 relative overflow-hidden"
        style={{
          background: 'rgba(11, 11, 30, 0.75)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRight: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <SidebarMesh />
        <div className="relative z-10 flex flex-col h-full">
          {sidebarContent}
        </div>
      </aside>

      <HelpPanel open={helpOpen} onClose={() => setHelpOpen(false)} />
    </>
  )
}
