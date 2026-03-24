import { prisma } from '@/lib/prisma'
import { resolveFeatureFlag } from '@/lib/db/feature-flags'

export type FeatureFlags = Record<string, boolean>

/**
 * Resolves all feature flags for a user in 2 round trips (flags + overrides).
 */
export async function getFeatureFlags(userId: string, role: string): Promise<FeatureFlags> {
  const [flags, overrides] = await Promise.all([
    prisma.featureFlag.findMany(),
    prisma.featureFlagOverride.findMany({
      where: {
        OR: [
          { scope: 'user', scope_id: userId },
          { scope: 'role', scope_id: role },
          { scope: 'org' },
        ],
      },
    }),
  ])

  return Object.fromEntries(
    flags.map(flag => {
      const userOverride = overrides.find(o => o.flag_key === flag.key && o.scope === 'user' && o.scope_id === userId)
      if (userOverride) return [flag.key, userOverride.value]

      const roleOverride = overrides.find(o => o.flag_key === flag.key && o.scope === 'role' && o.scope_id === role)
      if (roleOverride) return [flag.key, roleOverride.value]

      const orgOverride = overrides.find(o => o.flag_key === flag.key && o.scope === 'org')
      if (orgOverride) return [flag.key, orgOverride.value]

      return [flag.key, flag.default_value]
    })
  )
}

export async function getFlag(key: string, userId: string, role: string): Promise<boolean> {
  return resolveFeatureFlag(key, userId, role)
}
