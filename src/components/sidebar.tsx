'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'
import type { UserRole } from '@/lib/types'
import { cn } from '@/lib/utils'
import { CommandPaletteTrigger } from '@/components/command-palette-trigger'
import { HelpPanel } from '@/components/help-panel'
import {
  ClipboardCheck, History, Target, MessageSquare, Users2,
  UserCircle, LayoutDashboard, CalendarClock, UserCog,
  Building2, FileBarChart, Settings2, BarChart3, Scale,
  ScrollText, BookOpen, HelpCircle, LogOut,
  Wallet, Bell, FileSpreadsheet, Menu, X,
  Mail, BadgeCheck, Video, PanelLeftClose, PanelLeftOpen,
} from 'lucide-react'

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  requireAlsoEmployee?: boolean
  section?: string
}

const NAV_ITEMS: Record<UserRole, NavItem[]> = {
  employee: [
    { label: 'My Review',    href: '/employee',              icon: ClipboardCheck },
    { label: 'My History',   href: '/employee/history',      icon: History },
    { label: 'Goals',        href: '/employee/goals',        icon: Target },
    { label: 'MIS Targets',  href: '/employee/mis',          icon: BarChart3 },
    { label: 'Feedback',     href: '/employee/feedback',     icon: MessageSquare },
    { label: 'Profile',      href: '/employee/profile',      icon: UserCircle },
    { label: 'Help',         href: '#help',                  icon: HelpCircle,  section: 'divider' },
  ],
  manager: [
    { label: 'My Team',      href: '/manager',           icon: Users2 },
    { label: 'Team Payouts', href: '/manager/payouts',   icon: Wallet },
    { label: 'Team Reports', href: '/manager/reports',   icon: FileBarChart },
    { label: 'MIS Tracking', href: '/manager/mis',       icon: BarChart3 },
    { label: 'My Review',    href: '/manager/my-review', icon: ClipboardCheck, section: 'divider' },
    { label: 'Help',         href: '#help',              icon: HelpCircle },
  ],
  hrbp: [
    { label: 'Cycles',       href: '/hrbp',              icon: CalendarClock },
    { label: 'Meetings',     href: '/hrbp/meetings',     icon: Video },
    { label: 'Calibration',  href: '/hrbp/calibration',  icon: Scale },
    { label: 'Employees',    href: '/hrbp/employees',    icon: Users2 },
    { label: 'Payouts',      href: '/hrbp/payouts',      icon: Wallet },
    { label: 'Reports',      href: '/hrbp/reports',      icon: BarChart3 },
    { label: 'MIS Overview', href: '/hrbp/mis',          icon: BarChart3 },
    { label: 'Audit Log',    href: '/hrbp/audit-log',    icon: ScrollText },
    { label: 'My Review',    href: '/hrbp/my-review',    icon: ClipboardCheck, requireAlsoEmployee: true, section: 'divider' },
    { label: 'Docs',         href: '/docs',              icon: BookOpen },
    { label: 'Help',         href: '#help',              icon: HelpCircle },
  ],
  admin: [
    { label: 'Dashboard',        href: '/admin',                  icon: LayoutDashboard },
    { label: 'Cycles',           href: '/admin/cycles',           icon: CalendarClock },
    { label: 'Users',            href: '/admin/users',            icon: UserCog,         section: 'divider' },
    { label: 'Departments',      href: '/admin/departments',      icon: Building2 },
    { label: 'Roles',            href: '/admin/roles',            icon: BadgeCheck },
    { label: 'KPI Templates',    href: '/admin/kpi-templates',    icon: FileBarChart,    section: 'divider' },
    { label: 'KRA Templates',    href: '/admin/kra-templates',    icon: Target },
    { label: 'MIS Integration',  href: '/admin/mis',              icon: FileSpreadsheet },
    { label: 'Competencies',     href: '/admin/competencies',     icon: Target,          section: 'divider' },
    { label: 'Review Templates', href: '/admin/review-templates', icon: FileSpreadsheet },
    { label: 'Email Templates',  href: '/admin/email-templates',  icon: Mail },
    { label: 'Notifications',    href: '/admin/notifications',    icon: Bell },
    { label: 'Payout Config',    href: '/admin/payout-config',    icon: Wallet,          section: 'divider' },
    { label: 'Payouts',          href: '/admin/payouts',          icon: Settings2 },
    { label: 'Reports',          href: '/admin/reports',          icon: FileBarChart },
    { label: 'Audit Log',        href: '/admin/audit-log',        icon: ScrollText },
    { label: 'Docs',             href: '/docs',                   icon: BookOpen,        section: 'divider' },
    { label: 'Help',             href: '#help',                   icon: HelpCircle },
  ],
}

const ROLE_COLORS: Record<UserRole, string> = {
  admin:    'bg-indigo-600',
  employee: 'bg-emerald-600',
  manager:  'bg-amber-500',
  hrbp:     'bg-violet-600',
}

function UserAvatar({ name, role }: { name: string; role?: UserRole }) {
  const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  return (
    <div className={cn(
      'flex h-8 w-8 items-center justify-center rounded-full text-white text-[11px] font-semibold shrink-0',
      role ? ROLE_COLORS[role] : 'bg-indigo-600',
    )}>
      {initials}
    </div>
  )
}

const ROLE_HOME: Record<UserRole, string> = {
  admin: '/admin',
  manager: '/manager',
  hrbp: '/hrbp',
  employee: '/employee',
}

const ROLE_DISPLAY: Record<string, string> = {
  admin: 'Admin',
  manager: 'Manager',
  hrbp: 'HRBP',
  employee: 'Employee',
}

const STORAGE_KEY = 'pms-sidebar-collapsed'

export function Sidebar({
  role, userName, isAlsoEmployee = false, availableRoles = []
}: {
  role: UserRole
  userName: string
  isAlsoEmployee?: boolean
  availableRoles?: string[]
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [helpOpen, setHelpOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  // Persist collapsed state in localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'true') setCollapsed(true)
  }, [])

  function toggleCollapsed() {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem(STORAGE_KEY, String(next))
  }

  // Determine active view based on current path
  const activeView: UserRole = pathname.startsWith('/admin') ? 'admin'
    : pathname.startsWith('/manager') ? 'manager'
    : pathname.startsWith('/hrbp') ? 'hrbp'
    : 'employee'

  const currentRole = availableRoles.includes(activeView) ? activeView : role
  const visibleItems = NAV_ITEMS[currentRole].filter(
    item => !item.requireAlsoEmployee || isAlsoEmployee
  )

  async function handleSignOut() {
    await signOut({ redirect: false })
    router.push('/login')
  }

  // ── Full (expanded) sidebar content ──
  const expandedContent = (
    <>
      {/* Logo */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-center gap-3">
          <img src="/icon.svg" alt="PMS" className="h-8 w-8 rounded-lg" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-slate-800 tracking-tight leading-none">PMS</p>
            <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-[0.15em] mt-0.5">EMB Global</p>
          </div>
          {/* Collapse button — desktop only */}
          <button
            onClick={toggleCollapsed}
            className="hidden lg:flex h-6 w-6 items-center justify-center rounded-md text-slate-300 hover:text-slate-500 hover:bg-slate-100 transition-colors"
            title="Collapse sidebar"
          >
            <PanelLeftClose className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Role Switcher */}
      {availableRoles.length > 1 && (
        <div className="px-4 mb-3">
          <div className="flex rounded-lg bg-slate-100/80 p-0.5">
            {availableRoles.map(r => (
              <button
                key={r}
                onClick={() => router.push(ROLE_HOME[r as UserRole])}
                className={cn(
                  'flex-1 rounded-md px-2 py-1.5 text-[11px] font-medium transition-all',
                  currentRole === r
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-600'
                )}
              >
                {ROLE_DISPLAY[r]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="px-4 mb-3">
        <CommandPaletteTrigger />
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 pb-2">
        {visibleItems.map((item, idx) => {
          const Icon = item.icon
          const isActive = item.href !== '#help' &&
            (pathname === item.href || (item.href !== '/admin' && item.href !== '/employee' && pathname.startsWith(item.href)))
          const isExactActive = pathname === item.href
          const active = isActive || isExactActive
          const showDivider = item.section === 'divider' && idx > 0

          const element = item.href === '#help' ? (
            <button
              key="help"
              onClick={() => setHelpOpen(true)}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-[7px] text-[13px] text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-600"
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </button>
          ) : (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'flex items-center gap-2.5 rounded-lg px-3 py-[7px] text-[13px] transition-all',
                active
                  ? 'bg-indigo-50/80 text-indigo-700 font-medium'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
              )}
            >
              <Icon className={cn(
                'h-4 w-4 shrink-0',
                active ? 'text-indigo-500' : 'text-slate-400'
              )} />
              {item.label}
            </Link>
          )

          return showDivider ? (
            <div key={item.href || 'help'}>
              <div className="h-px bg-slate-100 my-2 mx-2" />
              {element}
            </div>
          ) : element
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 pb-4 pt-2">
        <div className="h-px bg-slate-100 mb-3" />
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-[7px] text-[13px] text-slate-500 transition-colors hover:bg-red-50 hover:text-red-500"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
        <div className="flex items-center gap-2.5 px-3 py-2.5 mt-2 rounded-lg bg-slate-50/80">
          <UserAvatar name={userName} role={role} />
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-slate-700 truncate leading-tight">{userName}</p>
            <p className="text-[10px] text-slate-500">{role === 'hrbp' ? 'HRBP' : role.charAt(0).toUpperCase() + role.slice(1)}</p>
          </div>
        </div>
      </div>
    </>
  )

  // ── Collapsed (icon-only) sidebar content ──
  const collapsedContent = (
    <>
      {/* Logo icon + expand button */}
      <div className="flex flex-col items-center pt-5 pb-3 gap-2">
        <img src="/icon.svg" alt="PMS" className="h-8 w-8 rounded-lg" />
        <button
          onClick={toggleCollapsed}
          className="flex h-6 w-6 items-center justify-center rounded-md text-slate-300 hover:text-slate-500 hover:bg-slate-100 transition-colors"
          title="Expand sidebar"
        >
          <PanelLeftOpen className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Role Switcher — collapsed: show first letter */}
      {availableRoles.length > 1 && (
        <div className="flex flex-col items-center gap-1 mb-2 px-1">
          {availableRoles.map(r => (
            <button
              key={r}
              onClick={() => router.push(ROLE_HOME[r as UserRole])}
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-lg text-[10px] font-semibold transition-all',
                currentRole === r
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
              )}
              title={ROLE_DISPLAY[r]}
            >
              {ROLE_DISPLAY[r][0]}
            </button>
          ))}
        </div>
      )}

      {/* Nav — icon only with tooltips */}
      <nav className="flex-1 overflow-y-auto px-2 space-y-0.5">
        {visibleItems.map((item, idx) => {
          const Icon = item.icon
          const isActive = item.href !== '#help' &&
            (pathname === item.href || (item.href !== '/admin' && item.href !== '/employee' && pathname.startsWith(item.href)))
          const isExactActive = pathname === item.href
          const active = isActive || isExactActive
          const showDivider = item.section === 'divider' && idx > 0

          const element = item.href === '#help' ? (
            <button
              key="help"
              onClick={() => setHelpOpen(true)}
              className="flex w-full items-center justify-center rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600"
              title={item.label}
            >
              <Icon className="h-4 w-4" />
            </button>
          ) : (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center justify-center rounded-lg p-2 transition-all',
                active
                  ? 'bg-indigo-50/80 text-indigo-600'
                  : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'
              )}
              title={item.label}
            >
              <Icon className="h-4 w-4" />
            </Link>
          )

          return showDivider ? (
            <div key={item.href || 'help'}>
              <div className="h-px bg-slate-100 my-1.5 mx-1" />
              {element}
            </div>
          ) : element
        })}
      </nav>

      {/* Footer — collapsed */}
      <div className="mt-auto flex flex-col items-center py-3 gap-2">
        <div className="h-px w-6 bg-slate-100 mb-1" />
        <button
          onClick={handleSignOut}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
          title="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </button>
        <div title={`${userName} (${role === 'hrbp' ? 'HRBP' : role.charAt(0).toUpperCase() + role.slice(1)})`}>
          <UserAvatar name={userName} role={role} />
        </div>
      </div>
    </>
  )

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-3 left-3 z-50 flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white shadow-sm lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-4 w-4 text-slate-600" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Mobile sidebar — always expanded */}
      <aside className={cn(
        'fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col bg-white/95 backdrop-blur-md border-r border-slate-200/80 shadow-xl transition-transform duration-300 lg:hidden',
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-4 right-4 flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          aria-label="Close menu"
        >
          <X className="h-4 w-4" />
        </button>
        {expandedContent}
      </aside>

      {/* Desktop sidebar — collapsible */}
      <aside className={cn(
        'hidden lg:flex flex-col shrink-0 bg-white/95 backdrop-blur-md border-r border-slate-200/80 transition-all duration-300',
        collapsed ? 'w-[56px]' : 'w-[240px]'
      )}>
        {collapsed ? collapsedContent : expandedContent}
      </aside>

      <HelpPanel open={helpOpen} onClose={() => setHelpOpen(false)} />
    </>
  )
}
