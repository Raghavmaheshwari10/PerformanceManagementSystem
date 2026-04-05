import * as Sentry from '@sentry/nextjs'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Sidebar } from '@/components/sidebar'
import { CommandPaletteProvider } from '@/components/command-palette'
import { NotificationBell } from '@/components/notification-bell'
import { Greeting } from '@/components/greeting'
import { ClientProviders } from '@/components/client-providers'

/** Generate a human-readable notification message from type + payload */
function notificationMessage(type: string, p: Record<string, string | undefined>): string {
  const name = p.employee_name ?? p.sender_name ?? ''
  const cycle = p.cycle_name ?? ''
  switch (type) {
    case 'cycle_kpi_setting_open':
      return cycle ? `KPI setting is now open for ${cycle}.` : 'KPI setting is now open.'
    case 'cycle_self_review_open':
      return cycle ? `Self-review is now open for ${cycle}.` : 'Self-review is now open.'
    case 'cycle_manager_review_open':
      return cycle ? `Manager review is now open for ${cycle}.` : 'Manager review is now open.'
    case 'cycle_published':
      return cycle ? `Results for ${cycle} have been published.` : 'Cycle results have been published.'
    case 'review_submitted':
      return name ? `${name} submitted their self-review.` : 'A self-review has been submitted.'
    case 'manager_review_submitted':
      return name ? `Manager review submitted for ${name}.` : 'A manager review has been submitted.'
    case 'review_reminder':
      return cycle ? `Reminder: Complete your review for ${cycle}.` : 'Reminder: Complete your pending review.'
    case 'meeting_scheduled':
      return name ? `Discussion meeting scheduled for ${name}.` : 'A discussion meeting has been scheduled.'
    case 'meeting_reminder':
      return name ? `Reminder: Discussion meeting for ${name} is tomorrow.` : 'Reminder: You have a discussion meeting tomorrow.'
    case 'meeting_mom_submitted':
      return name ? `Meeting MOM submitted for ${name}. Manager review is now unlocked.` : 'Meeting MOM has been submitted.'
    case 'peer_review_requested':
      return name ? `${name} requested a peer review from you.` : 'You have a new peer review request.'
    case 'peer_review_submitted':
      return name ? `${name} submitted a peer review.` : 'A peer review has been submitted.'
    case 'feedback_received':
      return name ? `${name} sent you feedback.` : 'You received new feedback.'
    case 'admin_message':
      return p.text ?? 'You have a new message from admin.'
    default:
      return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  }
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  Sentry.setUser({ id: user.id, email: user.email, username: user.full_name })

  const rawNotifications = await prisma.notification.findMany({
    where: { recipient_id: user.id, dismissed_at: null },
    orderBy: { created_at: 'desc' },
    take: 50,
    select: {
      id: true,
      type: true,
      payload: true,
      status: true,
      snoozed_until: true,
      dismissed_at: true,
      created_at: true,
    },
  })

  // Map Prisma notifications to NotificationBell's expected shape
  // Generate a human-readable message from notification type + payload
  const notifications = rawNotifications.map(n => {
    const p = (n.payload ?? {}) as Record<string, string | undefined>
    return {
      id: n.id,
      type: n.type as string,
      message: (p.message as string | undefined) ?? notificationMessage(n.type, p),
      link: (p.link as string | null | undefined) ?? null,
      is_read: n.status === 'sent',
      created_at: n.created_at.toISOString(),
      snoozed_until: n.snoozed_until ? n.snoozed_until.toISOString() : null,
      dismissed_at: n.dismissed_at ? n.dismissed_at.toISOString() : null,
    }
  })

  const firstName = user.full_name.split(' ')[0]

  // Detect all available roles for this user
  const hasDirectReports = await prisma.user.count({ where: { manager_id: user.id, is_active: true } }) > 0
  const availableRoles: string[] = [user.role]
  // Everyone can access employee view (self-review, goals, peer reviews)
  if (!availableRoles.includes('employee')) {
    availableRoles.push('employee')
  }
  // Users with direct reports get manager view
  if (hasDirectReports && !availableRoles.includes('manager')) {
    availableRoles.push('manager')
  }

  return (
    <ClientProviders initialOnboarded={!!user.onboarded_at}>
      <CommandPaletteProvider role={user.role}>
        <div className="flex h-screen">
          <Sidebar
            role={user.role}
            userName={user.full_name}
            isAlsoEmployee={user.is_also_employee ?? false}
            availableRoles={availableRoles}
          />
          <div className="flex flex-1 flex-col overflow-hidden gradient-mesh noise-overlay">
            <header className="relative z-10 flex items-center justify-between bg-white/80 backdrop-blur-sm border-b border-indigo-100/50 px-6 py-3 lg:px-8">
              <div className="hidden lg:flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white text-sm font-bold shadow-md shadow-indigo-500/20">
                  {firstName[0]}
                </div>
                <div>
                  <Greeting name={firstName} />
                  <p className="text-xs text-slate-400">{user.role === 'hrbp' ? 'HRBP' : user.role.charAt(0).toUpperCase() + user.role.slice(1)} Dashboard</p>
                </div>
              </div>
              {/* Spacer for mobile (hamburger takes left side) */}
              <div className="lg:hidden" />
              <div className="flex items-center gap-3">
                <div className="hidden md:flex items-center gap-1.5 rounded-lg bg-indigo-50/50 border border-indigo-100/50 px-3 py-1.5 text-xs text-slate-400">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" /></svg>
                  {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </div>
                <NotificationBell notifications={notifications} />
              </div>
            </header>
            <main className="flex-1 overflow-y-auto p-6 lg:p-8">
              <div className="animate-in-page">
                {children}
              </div>
            </main>
          </div>
        </div>
      </CommandPaletteProvider>
    </ClientProviders>
  )
}
