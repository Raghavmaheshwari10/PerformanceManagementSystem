'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { signOut, useSession } from 'next-auth/react'

const IDLE_MS      = 30 * 60 * 1000   // 30 minutes
const WARNING_MS   = 25 * 60 * 1000   // warn at 25 minutes
const EVENTS       = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'] as const

export function SessionTimeout() {
  const { status } = useSession()
  const [showWarning, setShowWarning] = useState(false)
  const [countdown, setCountdown]     = useState(5 * 60) // seconds remaining in warning window
  const idleTimer    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const warnTimer    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const clearAllTimers = () => {
    if (idleTimer.current)    clearTimeout(idleTimer.current)
    if (warnTimer.current)    clearTimeout(warnTimer.current)
    if (countdownRef.current) clearInterval(countdownRef.current)
  }

  const logout = useCallback(() => {
    clearAllTimers()
    signOut({ callbackUrl: '/login?reason=timeout' })
  }, [])

  const resetTimers = useCallback(() => {
    if (status !== 'authenticated') return
    clearAllTimers()
    setShowWarning(false)
    setCountdown(5 * 60)

    warnTimer.current = setTimeout(() => {
      setShowWarning(true)
      setCountdown(5 * 60)
      // Tick countdown every second
      countdownRef.current = setInterval(() => {
        setCountdown(s => {
          if (s <= 1) {
            clearInterval(countdownRef.current!)
            return 0
          }
          return s - 1
        })
      }, 1000)
    }, WARNING_MS)

    idleTimer.current = setTimeout(logout, IDLE_MS)
  }, [status, logout])

  // Start timers when authenticated, stop when not
  useEffect(() => {
    if (status !== 'authenticated') { clearAllTimers(); return }
    resetTimers()
    EVENTS.forEach(e => window.addEventListener(e, resetTimers, { passive: true }))
    return () => {
      clearAllTimers()
      EVENTS.forEach(e => window.removeEventListener(e, resetTimers))
    }
  }, [status, resetTimers])

  if (!showWarning) return null

  const mins = Math.floor(countdown / 60)
  const secs = countdown % 60

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-xl border bg-background shadow-2xl p-6 space-y-4 mx-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40">
            <svg className="h-5 w-5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-sm">Session expiring soon</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              You&apos;ll be signed out in{' '}
              <span className="font-semibold text-foreground tabular-nums">
                {mins > 0 ? `${mins}m ${secs}s` : `${secs}s`}
              </span>{' '}
              due to inactivity.
            </p>
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button
            onClick={logout}
            className="rounded-md border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted transition-colors"
          >
            Sign out now
          </button>
          <button
            onClick={resetTimers}
            className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 transition-colors font-medium"
          >
            Stay signed in
          </button>
        </div>
      </div>
    </div>
  )
}
