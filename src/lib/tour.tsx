'use client'

import { createContext, useContext, useReducer, useCallback, useRef, type ReactNode } from 'react'
import { markUserOnboarded } from '@/lib/tour-actions'

export interface TourState {
  status: 'idle' | 'active'
  tourId: string | null
  stepIndex: number
}

export type TourAction =
  | { type: 'START'; tourId: string }
  | { type: 'NEXT' }
  | { type: 'FINISH' }

export function tourReducer(state: TourState, action: TourAction): TourState {
  switch (action.type) {
    case 'START':  return { status: 'active', tourId: action.tourId, stepIndex: 0 }
    case 'NEXT':   return { ...state, stepIndex: state.stepIndex + 1 }
    case 'FINISH': return { status: 'idle', tourId: null, stepIndex: 0 }
  }
}

const STORAGE_KEY = (tourId: string) => `pms:tour:${tourId}:done`

interface TourContextValue {
  tourState: TourState
  startTour: (tourId: string) => void
  nextStep: () => void
  finishTour: () => void
  replayTour: (tourId: string) => void
  isDone: (tourId: string) => boolean
  isOnboarded: () => boolean
}

const TourContext = createContext<TourContextValue | null>(null)

export function TourProvider({
  children,
  initialOnboarded,
}: {
  children: ReactNode
  initialOnboarded: boolean
}) {
  const [tourState, dispatch] = useReducer(tourReducer, { status: 'idle', tourId: null, stepIndex: 0 })
  // Cache in ref so isOnboarded() stays O(1) after first finish
  const onboardedRef = useRef(initialOnboarded)

  const isDone = useCallback((tourId: string) => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(STORAGE_KEY(tourId)) === '1'
  }, [])

  const isOnboarded = useCallback(() => onboardedRef.current, [])

  const startTour = useCallback((tourId: string) => {
    dispatch({ type: 'START', tourId })
  }, [])

  const nextStep = useCallback(() => dispatch({ type: 'NEXT' }), [])

  const finishTour = useCallback(() => {
    if (tourState.tourId) localStorage.setItem(STORAGE_KEY(tourState.tourId), '1')
    // Mark in DB (server action) — fire-and-forget, non-blocking
    if (!onboardedRef.current) {
      onboardedRef.current = true
      markUserOnboarded().catch(console.error)
    }
    dispatch({ type: 'FINISH' })
  }, [tourState.tourId])

  const replayTour = useCallback((tourId: string) => {
    localStorage.removeItem(STORAGE_KEY(tourId))
    dispatch({ type: 'START', tourId })
  }, [])

  return (
    <TourContext.Provider value={{ tourState, startTour, nextStep, finishTour, replayTour, isDone, isOnboarded }}>
      {children}
    </TourContext.Provider>
  )
}

export function useTour() {
  const ctx = useContext(TourContext)
  if (!ctx) throw new Error('useTour must be used within TourProvider')
  return ctx
}
