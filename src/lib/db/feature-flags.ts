import { prisma } from '@/lib/prisma'

/**
 * Resolves a feature flag with priority: user > role > org > default.
 * Replaces the resolve_feature_flag() PL/pgSQL RPC.
 */
export async function resolveFeatureFlag(
  key: string,
  userId: string,
  role: string
): Promise<boolean> {
  const flag = await prisma.featureFlag.findUnique({ where: { key } })
  if (!flag) return false

  const userOverride = await prisma.featureFlagOverride.findFirst({
    where: { flag_key: key, scope: 'user', scope_id: userId },
  })
  if (userOverride) return userOverride.value

  const roleOverride = await prisma.featureFlagOverride.findFirst({
    where: { flag_key: key, scope: 'role', scope_id: role },
  })
  if (roleOverride) return roleOverride.value

  const orgOverride = await prisma.featureFlagOverride.findFirst({
    where: { flag_key: key, scope: 'org', scope_id: null },
  })
  if (orgOverride) return orgOverride.value

  return flag.default_value
}
