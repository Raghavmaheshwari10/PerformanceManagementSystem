'use client'

import { FeatureFlagContext } from '@/hooks/use-feature-flag'

export function FeatureFlagProvider({
  flags,
  children,
}: {
  flags: Record<string, boolean>
  children: React.ReactNode
}) {
  return (
    <FeatureFlagContext.Provider value={flags}>
      {children}
    </FeatureFlagContext.Provider>
  )
}
