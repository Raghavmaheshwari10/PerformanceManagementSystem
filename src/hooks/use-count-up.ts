'use client'

import { useState, useEffect, useRef } from 'react'

/**
 * Animates a number from 0 to target with ease-out cubic easing.
 * @param target - The final number to animate to
 * @param duration - Animation duration in ms (default 1200)
 * @returns The current animated value (integer)
 */
export function useCountUp(target: number, duration = 1200): number {
  const [value, setValue] = useState(0)
  const startTime = useRef<number | null>(null)
  const rafId = useRef<number>(0)

  useEffect(() => {
    if (target === 0) {
      setValue(0)
      return
    }

    startTime.current = null

    function tick(timestamp: number) {
      if (startTime.current === null) startTime.current = timestamp
      const elapsed = timestamp - startTime.current
      const progress = Math.min(elapsed / duration, 1)

      // Ease-out cubic: 1 - (1 - t)^3
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(eased * target))

      if (progress < 1) {
        rafId.current = requestAnimationFrame(tick)
      }
    }

    rafId.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId.current)
  }, [target, duration])

  return value
}
