import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Sidebar } from '@/components/sidebar'
import { CommandPaletteProvider } from '@/components/command-palette'
import { NotificationBell } from '@/components/notification-bell'
import { Greeting } from '@/components/greeting'
import { ClientProviders } from '@/components/client-providers'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()

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
  // payload JSON may contain { message, link } fields
  const notifications = rawNotifications.map(n => {
    const p = (n.payload ?? {}) as Record<string, unknown>
    return {
      id: n.id,
      type: n.type as string,
      message: (p.message as string | undefined) ?? '',
      link: (p.link as string | null | undefined) ?? null,
      is_read: n.status === 'sent',
      created_at: n.created_at.toISOString(),
      snoozed_until: n.snoozed_until ? n.snoozed_until.toISOString() : null,
      dismissed_at: n.dismissed_at ? n.dismissed_at.toISOString() : null,
    }
  })

  const firstName = user.full_name.split(' ')[0]

  return (
    <ClientProviders>
      <CommandPaletteProvider role={user.role}>
        <div className="flex h-screen">
          <Sidebar
            role={user.role}
            userName={user.full_name}
            isAlsoEmployee={user.is_also_employee ?? false}
          />
          <div className="flex flex-1 flex-col overflow-hidden gradient-mesh noise-overlay">
            <header className="flex items-center justify-between bg-white border-b border-slate-200 px-6 py-3 lg:px-8">
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
                <div className="hidden md:flex items-center gap-1.5 rounded-lg bg-slate-50 border border-slate-200 px-3 py-1.5 text-xs text-slate-400">
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
