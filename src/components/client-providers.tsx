'use client'

import { SessionProvider } from 'next-auth/react'
import { ToastProvider } from '@/lib/toast'
import { ConfirmProvider } from '@/lib/confirm'
import { TourProvider } from '@/lib/tour'
import { Toaster } from '@/components/toaster'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { TourEngine } from '@/components/tour-engine'
import { HelpButton } from '@/components/help-button'
import { SessionTimeout } from '@/components/session-timeout'
import { KeyboardShortcutsDialog } from '@/components/keyboard-shortcuts-dialog'
import type { ReactNode } from 'react'

export function ClientProviders({ children, initialOnboarded = false }: { children: ReactNode; initialOnboarded?: boolean }) {
  return (
    <SessionProvider>
      <ToastProvider>
        <ConfirmProvider>
          <TourProvider initialOnboarded={initialOnboarded}>
            {children}
            <Toaster />
            <ConfirmDialog />
            <TourEngine />
            <HelpButton />
            <SessionTimeout />
            <KeyboardShortcutsDialog />
          </TourProvider>
        </ConfirmProvider>
      </ToastProvider>
    </SessionProvider>
  )
}
