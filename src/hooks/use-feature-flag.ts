'use client'

import { createContext, useContext } from 'react'

export const FeatureFlagContext = createContext<Record<string, boolean>>({})

export function useFeatureFlag(key: string): boolean {
  const flags = useContext(FeatureFlagContext)
  return flags[key] ?? false
}
