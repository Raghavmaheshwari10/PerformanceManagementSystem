import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock localStorage for Node environment
const store: Record<string, string> = {}
const localStorageMock = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value },
  removeItem: (key: string) => { delete store[key] },
  clear: () => { Object.keys(store).forEach(k => delete store[k]) },
}

// Frecency logic extracted for unit testing (mirrors use-frecency.ts)
const STORAGE_KEY = 'pms-cmd-frecency'
const DECAY = 0.9

interface FrecencyRecord {
  score: number
  lastUsed: number
}

function load(storage: typeof localStorageMock): Record<string, FrecencyRecord> {
  try { return JSON.parse(storage.getItem(STORAGE_KEY) ?? '{}') }
  catch { return {} }
}

function recordUse(id: string, storage: typeof localStorageMock) {
  const data = load(storage)
  const existing = data[id] ?? { score: 0, lastUsed: 0 }
  const daysSince = (Date.now() - existing.lastUsed) / 86_400_000
  data[id] = {
    score: existing.score * Math.pow(DECAY, daysSince) + 1,
    lastUsed: Date.now(),
  }
  storage.setItem(STORAGE_KEY, JSON.stringify(data))
}

function getScore(id: string, storage: typeof localStorageMock): number {
  const r = load(storage)[id]
  if (!r) return 0
  const daysSince = (Date.now() - r.lastUsed) / 86_400_000
  return r.score * Math.pow(DECAY, daysSince)
}

describe('frecency scoring', () => {
  beforeEach(() => localStorageMock.clear())

  it('score is 0 for unseen command', () => {
    expect(getScore('nav-home', localStorageMock)).toBe(0)
  })

  it('score increases after each use', () => {
    recordUse('nav-home', localStorageMock)
    const s1 = getScore('nav-home', localStorageMock)
    recordUse('nav-home', localStorageMock)
    const s2 = getScore('nav-home', localStorageMock)
    expect(s2).toBeGreaterThan(s1)
  })

  it('frequently used command ranks higher than rarely used', () => {
    // Use A 5 times, B 1 time
    for (let i = 0; i < 5; i++) recordUse('cmd-a', localStorageMock)
    recordUse('cmd-b', localStorageMock)
    expect(getScore('cmd-a', localStorageMock)).toBeGreaterThan(getScore('cmd-b', localStorageMock))
  })

  it('scores are independent per command', () => {
    recordUse('cmd-x', localStorageMock)
    expect(getScore('cmd-y', localStorageMock)).toBe(0)
  })
})
