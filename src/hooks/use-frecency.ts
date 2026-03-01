'use client'
import { useCallback } from 'react'

interface FrecencyRecord {
  score: number
  lastUsed: number
}

const STORAGE_KEY = 'pms-cmd-frecency'
const DECAY = 0.9

function load(): Record<string, FrecencyRecord> {
  if (typeof window === 'undefined') return {}
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') }
  catch { return {} }
}

export function useFrecency() {
  const record = useCallback((id: string) => {
    const data = load()
    const existing = data[id] ?? { score: 0, lastUsed: 0 }
    const daysSince = (Date.now() - existing.lastUsed) / 86_400_000
    data[id] = {
      score: existing.score * Math.pow(DECAY, daysSince) + 1,
      lastUsed: Date.now(),
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }, [])

  const getScore = useCallback((id: string): number => {
    const r = load()[id]
    if (!r) return 0
    const daysSince = (Date.now() - r.lastUsed) / 86_400_000
    return r.score * Math.pow(DECAY, daysSince)
  }, [])

  return { record, getScore }
}
