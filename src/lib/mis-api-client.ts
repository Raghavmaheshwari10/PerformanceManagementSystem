import { prisma } from '@/lib/prisma'

interface MisApiConfig {
  baseUrl: string
  apiKey: string
}

async function getConfig(): Promise<MisApiConfig> {
  const config = await prisma.misConfig.findFirst()
  if (!config || !config.api_base_url || !config.api_key_encrypted) {
    throw new Error('MIS API not configured — set API URL and key in /admin/mis/settings')
  }
  return { baseUrl: config.api_base_url, apiKey: config.api_key_encrypted }
}

async function fetchMis<T>(path: string, params: Record<string, string>): Promise<T> {
  const { baseUrl, apiKey } = await getConfig()
  const url = new URL(path, baseUrl)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`MIS API error ${res.status}: ${await res.text()}`)
  return res.json()
}

export async function fetchAopTargets(fiscalYear: number, updatedSince?: string) {
  const params: Record<string, string> = { fiscal_year: String(fiscalYear) }
  if (updatedSince) params.updated_since = updatedSince
  return fetchMis<{ data: any[]; meta: { total: number } }>('/api/v1/aop/targets', params)
}

export async function fetchMisActuals(fiscalYear: number, month: number, updatedSince?: string) {
  const params: Record<string, string> = { fiscal_year: String(fiscalYear), month: String(month) }
  if (updatedSince) params.updated_since = updatedSince
  return fetchMis<{ data: any[]; meta: { total: number } }>('/api/v1/mis/actuals', params)
}

export async function checkMisHealth(): Promise<boolean> {
  try {
    const { baseUrl, apiKey } = await getConfig()
    const res = await fetch(new URL('/api/v1/health', baseUrl).toString(), {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    return res.ok
  } catch {
    return false
  }
}
