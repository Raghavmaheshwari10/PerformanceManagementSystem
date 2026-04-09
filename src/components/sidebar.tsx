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
  ScrollText, BookOpen, HelpCircle, LogOut, Star,
  Wallet, Bell, FileSpreadsheet, Menu, X,
  Mail, BadgeCheck, Video, PanelLeftClose, PanelLeftOpen,
  AlertTriangle, Crosshair, Crown, Upload, DollarSign,
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
    { label: 'Top Talent',       href: '/manager/top-talent',       icon: Star },
    { label: 'Competency Gaps',  href: '/manager/competency-gaps',  icon: Target },
    { label: 'Goal Cascading',   href: '/manager/goal-cascading',   icon: Target },
    { label: 'PIP',              href: '/manager/pip',              icon: AlertTriangle },
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
    { label: 'Top Talent',       href: '/hrbp/top-talent',       icon: Star },
    { label: 'Competency Gaps',  href: '/hrbp/competency-gaps',  icon: Target },
    { label: 'Goal Cascading',   href: '/hrbp/goal-cascading',   icon: Target },
    { label: 'PIP',              href: '/hrbp/pip',              icon: AlertTriangle },
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
    { label: 'AOP Targets',      href: '/admin/aop',              icon: Crosshair },
    { label: 'Upload MIS Actuals', href: '/admin/aop/upload',     icon: Upload },
    { label: 'Salary Data',        href: '/admin/aop/salary',     icon: DollarSign },
    { label: 'MIS Integration',  href: '/admin/mis',              icon: FileSpreadsheet },
    { label: 'Competencies',     href: '/admin/competencies',     icon: Target,          section: 'divider' },
    { label: 'Review Templates', href: '/admin/review-templates', icon: FileSpreadsheet },
    { label: 'Email Templates',  href: '/admin/email-templates',  icon: Mail },
    { label: 'Notifications',    href: '/admin/notifications',    icon: Bell },
    { label: 'Payout Config',    href: '/admin/payout-config',    icon: Wallet,          section: 'divider' },
    { label: 'Payouts',          href: '/admin/payouts',          icon: Settings2 },
    { label: 'Reports',          href: '/admin/reports',          icon: FileBarChart },
    { label: 'Top Talent',       href: '/admin/top-talent',       icon: Star },
    { label: 'Competency Gaps',  href: '/admin/competency-gaps',  icon: Target },
    { label: 'Goal Cascading',   href: '/admin/goal-cascading',   icon: Target },
    { label: 'PIP',              href: '/admin/pip',              icon: AlertTriangle },
    { label: 'Audit Log',        href: '/admin/audit-log',        icon: ScrollText },
    { label: 'Docs',             href: '/docs',                   icon: BookOpen,        section: 'divider' },
    { label: 'Help',             href: '#help',                   icon: HelpCircle },
  ],
  superadmin: [
    { label: 'Dashboard',        href: '/admin',                  icon: LayoutDashboard },
    { label: 'Cycles',           href: '/admin/cycles',           icon: CalendarClock },
    { label: 'Users',            href: '/admin/users',            icon: UserCog,         section: 'divider' },
    { label: 'Departments',      href: '/admin/departments',      icon: Building2 },
    { label: 'Roles',            href: '/admin/roles',            icon: BadgeCheck },
    { label: 'KPI Templates',    href: '/admin/kpi-templates',    icon: FileBarChart,    section: 'divider' },
    { label: 'KRA Templates',    href: '/admin/kra-templates',    icon: Target },
    { label: 'AOP Templates',    href: '/admin/aop-templates',    icon: FileSpreadsheet },
    { label: 'AOP Targets',      href: '/admin/aop',              icon: Crosshair },
    { label: 'Upload MIS Actuals', href: '/admin/aop/upload',     icon: Upload },
    { label: 'Salary Data',        href: '/admin/aop/salary',     icon: DollarSign },
    { label: 'MIS Integration',  href: '/admin/mis',              icon: FileSpreadsheet },
    { label: 'Competencies',     href: '/admin/competencies',     icon: Target,          section: 'divider' },
    { label: 'Review Templates', href: '/admin/review-templates', icon: FileSpreadsheet },
    { label: 'Email Templates',  href: '/admin/email-templates',  icon: Mail },
    { label: 'Notifications',    href: '/admin/notifications',    icon: Bell },
    { label: 'Payout Config',    href: '/admin/payout-config',    icon: Wallet,          section: 'divider' },
    { label: 'Payouts',          href: '/admin/payouts',          icon: Settings2 },
    { label: 'Reports',          href: '/admin/reports',          icon: FileBarChart },
    { label: 'Top Talent',       href: '/admin/top-talent',       icon: Star },
    { label: 'Competency Gaps',  href: '/admin/competency-gaps',  icon: Target },
    { label: 'Goal Cascading',   href: '/admin/goal-cascading',   icon: Target },
    { label: 'PIP',              href: '/admin/pip',              icon: AlertTriangle },
    { label: 'Audit Log',        href: '/admin/audit-log',        icon: ScrollText },
    { label: 'Docs',             href: '/docs',                   icon: BookOpen,        section: 'divider' },
    { label: 'Help',             href: '#help',                   icon: HelpCircle },
  ],
  department_head: [
    { label: 'AOP Cascade',  href: '/department-head/aop',    icon: Crosshair },
    { label: 'My Team',      href: '/department-head/team',   icon: Users2 },
    { label: 'My Review',    href: '/department-head/review', icon: ClipboardCheck },
    { label: 'Help',         href: '#help',                   icon: HelpCircle },
  ],
  founder: [
    { label: 'Founder View', href: '/admin/founder',          icon: Crown },
    { label: 'Help',         href: '#help',                   icon: HelpCircle },
  ],
}

const ROLE_COLORS: Record<UserRole, string> = {
  admin:           'bg-indigo-600',
  superadmin:      'bg-red-600',
  employee:        'bg-emerald-600',
  manager:         'bg-amber-500',
  hrbp:            'bg-violet-600',
  department_head: 'bg-cyan-600',
  founder:         'bg-yellow-600',
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
  admin:           '/admin',
  superadmin:      '/admin',
  manager:         '/manager',
  hrbp:            '/hrbp',
  employee:        '/employee',
  department_head: '/department-head',
  founder:         '/admin/founder',
}

const ROLE_DISPLAY: Record<string, string> = {
  admin:           'Admin',
  superadmin:      'Super Admin',
  manager:         'Manager',
  hrbp:            'HRBP',
  employee:        'Employee',
  department_head: 'Department Head',
  founder:         'Founder',
}

const STORAGE_KEY = 'pms-sidebar-collapsed'

export function Sidebar({
  role, userName, isAlsoEmployee = false, isFounder = false, availableRoles = []
}: {
  role: UserRole
  userName: string
  isAlsoEmployee?: boolean
  isFounder?: boolean
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
  const activeView: UserRole = pathname.startsWith('/admin') ? (role === 'superadmin' ? 'superadmin' : role === 'founder' ? 'founder' : 'admin')
    : pathname.startsWith('/manager') ? 'manager'
    : pathname.startsWith('/hrbp') ? 'hrbp'
    : pathname.startsWith('/department-head') ? 'department_head'
    : 'employee'

  const currentRole = availableRoles.includes(activeView) ? activeView : role
  const visibleItems = NAV_ITEMS[currentRole].filter(
    item => !item.requireAlsoEmployee || isAlsoEmployee
  )

  async function handleSignOut() {
    await signOut({ redirect: false })
    router.push('/login')
  }

  // Build a set of all nav hrefs to detect parent/child overlaps.
  // If a nav item's href is a prefix of another nav item's href,
  // only use exact match for the parent to avoid double-highlighting.
  const allHrefs = visibleItems.map(i => i.href).filter(h => h !== '#help')
  const parentHrefs = new Set(
    allHrefs.filter(href => allHrefs.some(other => other !== href && other.startsWith(href + '/')))
  )

  function isItemActive(href: string): boolean {
    if (href === '#help') return false
    // Exact match always wins
    if (pathname === href) return true
    // For parent routes (e.g. /admin/aop when /admin/aop/upload also exists), use exact match only
    if (parentHrefs.has(href)) return false
    // Dashboard roots: exact match only
    if (href === '/admin' || href === '/employee') return false
    // Otherwise, prefix match (for sub-routes like /admin/pip/123)
    return pathname.startsWith(href + '/')
  }

  // ── Full (expanded) sidebar content ──
  const expandedContent = (
    <>
      {/* Logo */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-center gap-3">
          <img src="/icon.svg" alt="EMB Global" className="h-8 w-8 rounded-lg" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-white tracking-tight leading-none">EMB Global</p>
            <p className="text-[9px] font-semibold text-white/40 uppercase tracking-[0.15em] mt-0.5">Performance Management</p>
          </div>
          {/* Collapse button — desktop only */}
          <button
            onClick={toggleCollapsed}
            className="hidden lg:flex h-6 w-6 items-center justify-center rounded-md text-white/30 hover:text-white/60 hover:bg-white/10 transition-colors"
            title="Collapse sidebar"
          >
            <PanelLeftClose className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Role Switcher */}
      {availableRoles.length > 1 && (
        <div className="px-4 mb-3">
          <div className="flex rounded-lg bg-white/[0.06] p-0.5">
            {availableRoles.map(r => (
              <button
                key={r}
                onClick={() => router.push(ROLE_HOME[r as UserRole])}
                className={cn(
                  'flex-1 rounded-md px-2 py-1.5 text-[11px] font-medium transition-all',
                  currentRole === r
                    ? 'bg-white/10 text-white shadow-sm'
                    : 'text-white/40 hover:text-white/60'
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
          const active = isItemActive(item.href)
          const showDivider = item.section === 'divider' && idx > 0

          const element = item.href === '#help' ? (
            <button
              key="help"
              onClick={() => setHelpOpen(true)}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-[7px] text-[13px] text-white/50 transition-colors hover:bg-white/[0.06] hover:text-white/70"
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
                  ? 'bg-indigo-500/15 text-indigo-300 font-medium'
                  : 'text-white/50 hover:bg-white/[0.06] hover:text-white/70'
              )}
            >
              <Icon className={cn(
                'h-4 w-4 shrink-0',
                active ? 'text-indigo-400' : 'text-white/30'
              )} />
              {item.label}
            </Link>
          )

          return showDivider ? (
            <div key={item.href || 'help'}>
              <div className="h-px bg-white/[0.06] my-2 mx-2" />
              {element}
            </div>
          ) : element
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 pb-4 pt-2">
        <div className="h-px bg-white/[0.06] mb-3" />
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-[7px] text-[13px] text-white/50 transition-colors hover:bg-red-500/10 hover:text-red-400"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
        <div className="flex items-center gap-2.5 px-3 py-2.5 mt-2 rounded-lg bg-white/[0.04]">
          <UserAvatar name={userName} role={role} />
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-white/90 truncate leading-tight">{userName}</p>
            <p className="text-[10px] text-white/40">{ROLE_DISPLAY[role] ?? (role.charAt(0).toUpperCase() + role.slice(1))}</p>
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
        <img src="/icon.svg" alt="EMB Global" className="h-8 w-8 rounded-lg" />
        <button
          onClick={toggleCollapsed}
          className="flex h-6 w-6 items-center justify-center rounded-md text-white/30 hover:text-white/60 hover:bg-white/10 transition-colors"
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
                  ? 'bg-indigo-500/15 text-indigo-300'
                  : 'text-white/40 hover:bg-white/[0.06] hover:text-white/60'
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
          const active = isItemActive(item.href)
          const showDivider = item.section === 'divider' && idx > 0

          const element = item.href === '#help' ? (
            <button
              key="help"
              onClick={() => setHelpOpen(true)}
              className="flex w-full items-center justify-center rounded-lg p-2 text-white/40 transition-colors hover:bg-white/[0.06] hover:text-white/60"
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
                  ? 'bg-indigo-500/15 text-indigo-400'
                  : 'text-white/40 hover:bg-white/[0.06] hover:text-white/60'
              )}
              title={item.label}
            >
              <Icon className="h-4 w-4" />
            </Link>
          )

          return showDivider ? (
            <div key={item.href || 'help'}>
              <div className="h-px bg-white/[0.06] my-1.5 mx-1" />
              {element}
            </div>
          ) : element
        })}
      </nav>

      {/* Footer — collapsed */}
      <div className="mt-auto flex flex-col items-center py-3 gap-2">
        <div className="h-px w-6 bg-white/[0.06] mb-1" />
        <button
          onClick={handleSignOut}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-white/40 transition-colors hover:bg-red-500/10 hover:text-red-400"
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
        'fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col bg-[#0c0a1a] border-r border-white/[0.06] shadow-xl transition-transform duration-300 lg:hidden',
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-4 right-4 flex h-6 w-6 items-center justify-center rounded-md text-white/40 hover:text-white/70 hover:bg-white/10"
          aria-label="Close menu"
        >
          <X className="h-4 w-4" />
        </button>
        {expandedContent}
      </aside>

      {/* Desktop sidebar — collapsible */}
      <aside className={cn(
        'hidden lg:flex flex-col shrink-0 bg-[#0c0a1a] border-r border-white/[0.06] transition-all duration-300',
        collapsed ? 'w-[56px]' : 'w-[240px]'
      )}>
        {collapsed ? collapsedContent : expandedContent}
      </aside>

      <HelpPanel open={helpOpen} onClose={() => setHelpOpen(false)} />
    </>
  )
}
