'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export function useAutoSave<T>(
  data: T,
  saveFn: (data: T) => Promise<void>,
  delay = 2000
) {
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dataRef = useRef(data)

  // Keep ref in sync
  dataRef.current = data

  const save = useCallback(async () => {
    setStatus('saving')
    try {
      await saveFn(dataRef.current)
      setStatus('saved')
      setLastSaved(new Date())
    } catch {
      setStatus('error')
    }
  }, [saveFn])

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(save, delay)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [data, delay, save])

  const statusLabel = (() => {
    if (status === 'saving') return 'Saving…'
    if (status === 'error') return 'Save failed'
    if (status === 'saved' && lastSaved) {
      const secs = Math.round((Date.now() - lastSaved.getTime()) / 1000)
      return secs < 5 ? 'Saved' : `Saved ${secs}s ago`
    }
    return ''
  })()

  return { status, statusLabel, saveNow: save }
}
