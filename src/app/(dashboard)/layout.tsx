import { getCurrentUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/sidebar'
import { CommandPaletteProvider } from '@/components/command-palette'
import { NotificationBell } from '@/components/notification-bell'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  const supabase = await createClient()

  const { data: notifications } = await supabase
    .from('notifications')
    .select('id, type, message, link, is_read, created_at, snoozed_until, dismissed_at')
    .eq('user_id', user.id)
    .is('dismissed_at', null)
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <CommandPaletteProvider role={user.role}>
      <div className="flex h-screen">
        <Sidebar role={user.role} userName={user.full_name} />
        <div className="flex flex-1 flex-col overflow-hidden">
          <header className="flex items-center justify-end border-b px-6 py-2">
            <NotificationBell notifications={notifications ?? []} />
          </header>
          <main className="flex-1 overflow-y-auto p-6">
            {children}
          </main>
        </div>
      </div>
    </CommandPaletteProvider>
  )
}
