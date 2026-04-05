'use client'

import { createContext, useContext, useReducer, useCallback, type ReactNode } from 'react'

export type ToastVariant = 'success' | 'error' | 'info' | 'warning'

export interface ToastAction {
  label: string
  onClick: () => void
}

export interface ToastOptions {
  action?: ToastAction
  duration?: number
}

export interface Toast {
  id: string
  variant: ToastVariant
  message: string
  action?: ToastAction
}

export interface ToastState { toasts: Toast[] }

export type ToastReducerAction =
  | { type: 'ADD'; toast: Toast }
  | { type: 'DISMISS'; id: string }

export function toastReducer(state: ToastState, action: ToastReducerAction): ToastState {
  switch (action.type) {
    case 'ADD': {
      const toasts = [...state.toasts, action.toast]
      return { toasts: toasts.length > 3 ? toasts.slice(toasts.length - 3) : toasts }
    }
    case 'DISMISS':
      return { toasts: state.toasts.filter(t => t.id !== action.id) }
  }
}

interface ToastContextValue {
  toast: {
    success: (message: string, options?: ToastOptions) => void
    error:   (message: string, options?: ToastOptions) => void
    info:    (message: string, options?: ToastOptions) => void
    warning: (message: string, options?: ToastOptions) => void
  }
  toasts: Toast[]
  dismiss: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(toastReducer, { toasts: [] })

  const add = useCallback((variant: ToastVariant, message: string, options?: ToastOptions) => {
    const id = crypto.randomUUID()
    dispatch({ type: 'ADD', toast: { id, variant, message, action: options?.action } })
    setTimeout(() => dispatch({ type: 'DISMISS', id }), options?.duration ?? 4000)
  }, [])

  const toast = {
    success: (m: string, o?: ToastOptions) => add('success', m, o),
    error:   (m: string, o?: ToastOptions) => add('error', m, o),
    info:    (m: string, o?: ToastOptions) => add('info', m, o),
    warning: (m: string, o?: ToastOptions) => add('warning', m, o),
  }

  return (
    <ToastContext.Provider value={{ toast, toasts: state.toasts, dismiss: (id) => dispatch({ type: 'DISMISS', id }) }}>
      {children}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
