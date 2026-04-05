'use client'

import { useEffect, useState, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useTour } from '@/lib/tour'
import { getTourForPath } from '@/lib/tour-content'
import { Button } from '@/components/ui/button'

interface Rect { top: number; left: number; width: number; height: number }

const PAD = 8

export function TourEngine() {
  const pathname = usePathname()
  const { tourState, startTour, nextStep, finishTour, isDone, isOnboarded } = useTour()
  const [rect, setRect] = useState<Rect | null>(null)
  const autoStarted = useRef<Set<string>>(new Set())

  const tour = getTourForPath(pathname)
  const step = tourState.status === 'active' && tour
    ? tour.steps[tourState.stepIndex] ?? null
    : null
  const isLast = tour ? tourState.stepIndex === tour.steps.length - 1 : false

  useEffect(() => {
    // Only auto-start on first-ever login (before user is marked as onboarded)
    if (!tour || isOnboarded() || isDone(tour.id) || autoStarted.current.has(tour.id)) return
    autoStarted.current.add(tour.id)
    const timer = setTimeout(() => startTour(tour.id), 800)
    return () => clearTimeout(timer)
  }, [pathname, tour, isDone, isOnboarded, startTour])

  useEffect(() => {
    if (!step) { setRect(null); return }
    const el = document.querySelector(`[data-tour="${step.id}"]`)
    if (!el) { setRect(null); return }

    const measure = () => {
      const r = el.getBoundingClientRect()
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height })
    }

    // Scroll instantly so getBoundingClientRect is accurate immediately
    el.scrollIntoView({ behavior: 'instant', block: 'center' })
    measure()

    // Re-measure on scroll/resize so overlay stays anchored to the element
    window.addEventListener('scroll', measure, { passive: true })
    window.addEventListener('resize', measure, { passive: true })
    return () => {
      window.removeEventListener('scroll', measure)
      window.removeEventListener('resize', measure)
    }
  }, [step])

  if (!step || !rect) return null

  const spotTop  = rect.top  - PAD
  const spotLeft = rect.left - PAD
  const spotW    = rect.width  + PAD * 2
  const spotH    = rect.height + PAD * 2

  const popoverTop = spotTop + spotH + 12 < window.innerHeight - 180
    ? spotTop + spotH + 12
    : spotTop - 180

  return (
    <>
      <div
        className="fixed inset-0 z-[200] pointer-events-none"
        style={{
          boxShadow: `0 0 0 9999px rgba(0,0,0,0.55)`,
          top: spotTop, left: spotLeft,
          width: spotW, height: spotH,
          borderRadius: 8,
        }}
      />
      <div
        className="fixed inset-0 z-[199]"
        onClick={() => finishTour()}
        aria-label="Close tour"
      />
      <div
        className="fixed z-[201] w-80 rounded-xl border bg-background shadow-xl p-5"
        style={{ top: popoverTop, left: Math.min(spotLeft, window.innerWidth - 340) }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-muted-foreground font-medium">
            Step {tourState.stepIndex + 1} of {tour!.steps.length}
          </span>
          <button onClick={finishTour} className="text-xs text-muted-foreground hover:text-foreground">Skip tour</button>
        </div>
        <h3 className="font-semibold text-sm mb-1">{step.title}</h3>
        <p className="text-sm text-muted-foreground mb-4">{step.body}</p>
        <div className="flex justify-end gap-2">
          <Button size="sm" onClick={isLast ? finishTour : nextStep}>
            {isLast ? 'Finish' : 'Next →'}
          </Button>
        </div>
      </div>
    </>
  )
}
