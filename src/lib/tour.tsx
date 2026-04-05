'use client'

import { createContext, useContext, useReducer, useCallback, type ReactNode } from 'react'

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
const ONBOARDED_KEY = 'pms:onboarded'

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

export function TourProvider({ children }: { children: ReactNode }) {
  const [tourState, dispatch] = useReducer(tourReducer, { status: 'idle', tourId: null, stepIndex: 0 })

  const isDone = useCallback((tourId: string) => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(STORAGE_KEY(tourId)) === '1'
  }, [])

  const isOnboarded = useCallback(() => {
    if (typeof window === 'undefined') return true
    return localStorage.getItem(ONBOARDED_KEY) === '1'
  }, [])

  const startTour = useCallback((tourId: string) => {
    dispatch({ type: 'START', tourId })
  }, [])

  const nextStep = useCallback(() => dispatch({ type: 'NEXT' }), [])

  const finishTour = useCallback(() => {
    if (tourState.tourId) localStorage.setItem(STORAGE_KEY(tourState.tourId), '1')
    localStorage.setItem(ONBOARDED_KEY, '1')   // Mark user as onboarded — no more auto-starts
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
