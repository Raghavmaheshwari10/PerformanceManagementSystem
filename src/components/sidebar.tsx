'use client'

import Link from 'next/link'
import { useState } from 'react'
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
  ScrollText, BookOpen, HelpCircle, LogOut, Flag,
  Wallet, Bell, FileSpreadsheet, Menu, X, ChevronRight,
  Mail,
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
    { label: 'MIS Targets',  href: '/employee/mis',          icon: BarChart3 },
    { label: 'Feedback',     href: '/employee/feedback',     icon: MessageSquare },
    // { label: 'Peer Reviews', href: '/employee/peer-reviews', icon: Users2 }, // Hidden — feature disabled
    { label: 'Profile',      href: '/employee/profile',      icon: UserCircle },
    { label: 'Docs',         href: '/docs',                  icon: BookOpen },
    { label: 'Help',         href: '#help',                  icon: HelpCircle },
  ],
  manager: [
    { label: 'My Team',      href: '/manager',           icon: Users2 },
    { label: 'Team Payouts', href: '/manager/payouts',   icon: Wallet },
    { label: 'MIS Tracking', href: '/manager/mis',       icon: BarChart3 },
    { label: 'My Review',    href: '/manager/my-review', icon: ClipboardCheck },
    { label: 'Docs',         href: '/docs',              icon: BookOpen },
    { label: 'Help',         href: '#help',              icon: HelpCircle },
  ],
  hrbp: [
    { label: 'Cycles',       href: '/hrbp',              icon: CalendarClock },
    { label: 'Calibration',  href: '/hrbp/calibration',  icon: Scale },
    { label: 'Employees',    href: '/hrbp/employees',    icon: Users2 },
    { label: 'Payouts',      href: '/hrbp/payouts',      icon: Wallet },
    { label: 'Reports',      href: '/hrbp/reports',      icon: BarChart3 },
    { label: 'MIS Overview', href: '/hrbp/mis',          icon: BarChart3 },
    { label: 'Audit Log',    href: '/hrbp/audit-log',    icon: ScrollText },
    { label: 'My Review',    href: '/hrbp/my-review',    icon: ClipboardCheck, requireAlsoEmployee: true },
    { label: 'Docs',         href: '/docs',              icon: BookOpen },
    { label: 'Help',         href: '#help',              icon: HelpCircle },
  ],
  admin: [
    { label: 'Dashboard',        href: '/admin',                  icon: LayoutDashboard },
    { label: 'Cycles',           href: '/admin/cycles',           icon: CalendarClock },
    { label: 'Users',            href: '/admin/users',            icon: UserCog },
    { label: 'Departments',      href: '/admin/departments',      icon: Building2 },
    { label: 'KPI Templates',    href: '/admin/kpi-templates',    icon: FileBarChart },
    { label: 'KRA Templates',    href: '/admin/kra-templates',    icon: Target },
    { label: 'MIS Integration',  href: '/admin/mis',              icon: FileSpreadsheet },
    { label: 'Competencies',     href: '/admin/competencies',     icon: Target },
    { label: 'Review Templates', href: '/admin/review-templates', icon: FileSpreadsheet },
    { label: 'Email Templates',  href: '/admin/email-templates',  icon: Mail },
    { label: 'Notifications',    href: '/admin/notifications',    icon: Bell },
    { label: 'Feature Flags',    href: '/admin/feature-flags',    icon: Flag },
    { label: 'Payout Config',    href: '/admin/payout-config',    icon: Wallet },
    { label: 'Payouts',          href: '/admin/payouts',          icon: Settings2 },
    { label: 'Audit Log',        href: '/admin/audit-log',        icon: ScrollText },
    { label: 'Docs',             href: '/docs',                   icon: BookOpen },
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

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="px-5 pt-6 pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 shadow-lg shadow-indigo-500/20">
            <svg viewBox="0 0 24 24" className="h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v20M2 12h20M5.636 5.636l12.728 12.728M18.364 5.636L5.636 18.364" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <p className="text-[15px] font-bold text-slate-900 tracking-tight">PMS</p>
            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">EMB Global</p>
          </div>
        </div>
      </div>

      {/* Role Switcher */}
      {availableRoles.length > 1 && (
        <div className="px-4 mb-3">
          <div className="flex rounded-lg bg-slate-100 p-0.5">
            {availableRoles.map(r => (
              <button
                key={r}
                onClick={() => router.push(ROLE_HOME[r as UserRole])}
                className={cn(
                  'flex-1 rounded-md px-2 py-1.5 text-[11px] font-medium transition-all',
                  currentRole === r
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                )}
              >
                {ROLE_DISPLAY[r]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="px-4 mb-4">
        <CommandPaletteTrigger />
      </div>

      {/* Nav */}
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
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
              >
                <Icon className="h-[18px] w-[18px] shrink-0" />
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
                'flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-all',
                (isActive || isExactActive)
                  ? 'bg-indigo-50 text-indigo-700 font-semibold border-l-[3px] border-indigo-600 pl-[9px]'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
              )}
            >
              <Icon className={cn(
                'h-[18px] w-[18px] shrink-0',
                (isActive || isExactActive) ? 'text-indigo-600' : ''
              )} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="mt-auto px-4 py-4 space-y-2">
        <div className="h-px bg-slate-100 mb-3" />
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
        >
          <LogOut className="h-[18px] w-[18px]" />
          Sign out
        </button>
        <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-slate-50 border border-slate-100">
          <UserAvatar name={userName} role={role} />
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-slate-800 truncate">{userName}</p>
            <p className="text-[10px] font-medium text-slate-400">{role === 'hrbp' ? 'HRBP' : role.charAt(0).toUpperCase() + role.slice(1)}</p>
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
        className="fixed top-3 left-3 z-50 flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white shadow-sm lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-4 w-4 text-slate-600" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Mobile sidebar */}
      <aside className={cn(
        'fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col bg-white border-r border-slate-200 shadow-xl transition-transform duration-300 lg:hidden',
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-4 right-4 flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          aria-label="Close menu"
        >
          <X className="h-4 w-4" />
        </button>
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-[260px] flex-col shrink-0 bg-white border-r border-slate-200">
        {sidebarContent}
      </aside>

      <HelpPanel open={helpOpen} onClose={() => setHelpOpen(false)} />
    </>
  )
}
