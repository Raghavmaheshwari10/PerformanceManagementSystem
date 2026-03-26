'use client'

import { useState, useTransition } from 'react'
import { BellIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { snoozeNotification, dismissNotification, markAllNotificationsRead } from '@/app/(dashboard)/actions/notifications'

interface Notification {
  id: string
  type: string
  message: string
  link: string | null
  is_read: boolean
  created_at: string
  snoozed_until: string | null
  dismissed_at: string | null
}

export function NotificationBell({ notifications: initial }: { notifications: Notification[] }) {
  const [notifications, setNotifications] = useState(initial)
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const active = notifications.filter(n => !n.dismissed_at && !n.snoozed_until)
  const unread = active.filter(n => !n.is_read).length

  function handleDismiss(id: string) {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, dismissed_at: new Date().toISOString() } : n))
    startTransition(() => dismissNotification(id))
  }

  function handleSnooze(id: string) {
    const until = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, snoozed_until: until } : n))
    startTransition(() => snoozeNotification(id, until))
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="relative p-2 rounded-md hover:bg-accent transition-colors"
        aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ''}`}
      >
        <BellIcon className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 top-10 z-50 w-80 rounded-lg glass-strong"
            style={{ animation: 'fadeInUp 0.2s ease-out', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}
          >
            <div className="flex items-center justify-between border-b border-white/8 px-4 py-2">
              <span className="text-sm font-semibold">Notifications</span>
              {unread > 0 && (
                <button
                  onClick={() => startTransition(() => markAllNotificationsRead())}
                  className="text-xs text-muted-foreground hover:text-primary"
                >
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-[360px] overflow-y-auto">
              {active.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">All caught up!</p>
              ) : (
                active.map(n => (
                  <div
                    key={n.id}
                    className={cn(
                      'border-b border-white/5 px-4 py-3 last:border-0',
                      !n.is_read && 'border-l-2 border-l-primary bg-white/[0.03]'
                    )}
                  >
                    <p className="text-sm">{n.message}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {new Date(n.created_at).toLocaleDateString()}
                      </span>
                      <button
                        onClick={() => handleSnooze(n.id)}
                        className="text-xs text-muted-foreground hover:text-primary"
                      >
                        Snooze 1d
                      </button>
                      <button
                        onClick={() => handleDismiss(n.id)}
                        className="text-xs text-muted-foreground hover:text-primary"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
