import type { UserRole } from '@/lib/types'

export interface PaletteCommand {
  id: string
  label: string
  description?: string
  href?: string
  action?: () => void
  roles: UserRole[]
  keywords?: string[]
}

export const STATIC_COMMANDS: PaletteCommand[] = [
  // Employee
  { id: 'nav-employee-dashboard', label: 'Go to Dashboard', href: '/employee', roles: ['employee'], keywords: ['home', 'dashboard'] },
  { id: 'nav-employee-kpis', label: 'Set my KPIs', href: '/employee', roles: ['employee'], keywords: ['goals', 'objectives', 'kpi'] },
  { id: 'nav-employee-history', label: 'My Review History', href: '/employee/history', roles: ['employee'], keywords: ['history', 'past'] },
  // Manager
  { id: 'nav-manager-team', label: 'View My Team', href: '/manager', roles: ['manager'], keywords: ['team', 'employees'] },
  { id: 'nav-manager-my-review', label: 'My Own Review', href: '/manager/my-review', roles: ['manager'], keywords: ['self', 'review'] },
  // HRBP
  { id: 'nav-hrbp-cycles', label: 'Cycles Overview', href: '/hrbp', roles: ['hrbp'], keywords: ['cycles', 'overview'] },
  { id: 'nav-hrbp-calibrate', label: 'Calibration View', href: '/hrbp/calibration', roles: ['hrbp'], keywords: ['calibrate', 'override', 'final'] },
  { id: 'nav-hrbp-audit', label: 'Audit Log', href: '/hrbp/audit-log', roles: ['hrbp'], keywords: ['audit', 'log', 'history'] },
  // Admin
  { id: 'nav-admin-cycles', label: 'Manage Cycles', href: '/admin', roles: ['admin'], keywords: ['cycle', 'period', 'appraisal'] },
  { id: 'nav-admin-users', label: 'Manage Users', href: '/admin/users', roles: ['admin'], keywords: ['users', 'people', 'employees', 'team'] },
  { id: 'nav-admin-audit', label: 'Audit Log', href: '/admin/audit-log', roles: ['admin'], keywords: ['audit', 'log'] },
  // Help — all roles (empty array = all)
  { id: 'help-overview', label: 'Help: What is PMS?', href: '/help/what-is-pms', roles: [] as UserRole[], keywords: ['help', 'about', 'overview', 'what'] },
  { id: 'help-kpis', label: 'Help: Setting KPIs', href: '/help/setting-kpis', roles: [] as UserRole[], keywords: ['help', 'kpi', 'goals'] },
  { id: 'help-self-review', label: 'Help: Self Review', href: '/help/self-review', roles: [] as UserRole[], keywords: ['help', 'review', 'rating', 'self'] },
  { id: 'help-centre', label: 'Browse Help Centre', href: '/help', roles: [] as UserRole[], keywords: ['help', 'docs', 'documentation'] },
]
