'use client'

import { useActionState, useState, useTransition } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { SubmitButton } from '@/components/submit-button'
import { saveMisConfig, saveDepartmentMapping, saveScoringConfig, testMisConnection } from './actions'
import type { ActionResult } from '@/lib/types'
import type { MisConfig, ScoringConfig } from '@prisma/client'

const INITIAL: ActionResult = { data: null, error: null }

interface Props {
  config: MisConfig | null
  scoringConfigs: ScoringConfig[]
  departments: { id: string; name: string }[]
}

function getScoreForTier(configs: ScoringConfig[], tier: string): number | undefined {
  const c = configs.find(sc => sc.rating_tier === tier)
  return c ? Number(c.min_score) : undefined
}

export function MisSettingsForm({ config, scoringConfigs, departments }: Props) {
  // API config form
  const [apiState, apiAction] = useActionState(saveMisConfig, INITIAL)

  // Scoring config form
  const [scoringState, scoringAction] = useActionState(saveScoringConfig, INITIAL)

  // Department mapping form
  const [mappingState, mappingAction] = useActionState(saveDepartmentMapping, INITIAL)

  // Test connection
  const [testPending, startTestTransition] = useTransition()
  const [testResult, setTestResult] = useState<{ connected: boolean } | null>(null)

  // Department mapping state
  const existingMapping = (config?.department_mapping ?? {}) as Record<string, string>
  const [mappings, setMappings] = useState<{ misCode: string; departmentId: string }[]>(() =>
    Object.entries(existingMapping).map(([misCode, departmentId]) => ({ misCode, departmentId }))
  )

  function handleTestConnection() {
    startTestTransition(async () => {
      const result = await testMisConnection()
      if (result.data) setTestResult(result.data)
    })
  }

  function addMapping() {
    setMappings(prev => [...prev, { misCode: '', departmentId: '' }])
  }

  function removeMapping(idx: number) {
    setMappings(prev => prev.filter((_, i) => i !== idx))
  }

  function updateMapping(idx: number, field: 'misCode' | 'departmentId', value: string) {
    setMappings(prev => prev.map((m, i) => (i === idx ? { ...m, [field]: value } : m)))
  }

  // Build mapping JSON for hidden input
  const mappingJson = JSON.stringify(
    mappings.reduce<Record<string, string>>((acc, { misCode, departmentId }) => {
      if (misCode.trim() && departmentId) acc[misCode.trim()] = departmentId
      return acc
    }, {})
  )

  return (
    <div className="space-y-8">
      {/* Section 1: API Configuration */}
      <form action={apiAction} className="glass rounded-lg border p-6 space-y-5">
        <h2 className="text-lg font-semibold">API Configuration</h2>

        {apiState.error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{apiState.error}</p>
        )}
        {!apiState.error && apiState.data === null && apiState !== INITIAL ? null : null}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="api_base_url">API Base URL <span className="text-destructive">*</span></Label>
            <Input id="api_base_url" name="api_base_url" defaultValue={config?.api_base_url ?? ''} placeholder="https://mis.example.com" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="api_key">API Key</Label>
            <Input id="api_key" name="api_key" type="password" defaultValue={config?.api_key_encrypted ? '********' : ''} placeholder="Enter API key" />
            <p className="text-xs text-muted-foreground">Leave unchanged to keep current key</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="fiscal_year">Fiscal Year</Label>
            <Input id="fiscal_year" name="fiscal_year" type="number" defaultValue={config?.fiscal_year ?? 2026} min={2020} max={2050} />
          </div>
          <div className="flex items-end gap-3">
            <Button type="button" variant="outline" onClick={handleTestConnection} disabled={testPending}>
              {testPending ? 'Testing...' : 'Test Connection'}
            </Button>
            {testResult && (
              <span className={`text-sm font-medium ${testResult.connected ? 'text-green-400' : 'text-red-400'}`}>
                {testResult.connected ? 'Connected' : 'Connection failed'}
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <SubmitButton pendingLabel="Saving...">Save API Config</SubmitButton>
        </div>
      </form>

      {/* Section 2: Sync Schedule */}
      <form action={apiAction} className="glass rounded-lg border p-6 space-y-5">
        <h2 className="text-lg font-semibold">Sync Schedule</h2>

        {/* Include required fields for the API config action */}
        <input type="hidden" name="api_base_url" value={config?.api_base_url ?? ''} />
        <input type="hidden" name="api_key" value="********" />
        <input type="hidden" name="fiscal_year" value={config?.fiscal_year ?? 2026} />

        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-3">
            <input
              id="auto_sync_enabled"
              name="auto_sync_enabled"
              type="checkbox"
              value="true"
              defaultChecked={config?.auto_sync_enabled !== false}
              className="rounded"
            />
            <Label htmlFor="auto_sync_enabled">Enable automatic sync</Label>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sync_cron">Cron Expression</Label>
            <Input id="sync_cron" name="sync_cron" defaultValue={config?.sync_cron ?? '0 6 * * *'} placeholder="0 6 * * *" />
            <p className="text-xs text-muted-foreground">0 6 * * * = daily at 6 AM</p>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <SubmitButton pendingLabel="Saving...">Save Sync Settings</SubmitButton>
        </div>
      </form>

      {/* Section 3: Scoring Thresholds */}
      <form action={scoringAction} className="glass rounded-lg border p-6 space-y-5">
        <h2 className="text-lg font-semibold">Scoring Thresholds</h2>
        <p className="text-sm text-muted-foreground">
          Minimum MIS score (%) required for each rating tier. BE is assigned below the SME threshold.
        </p>

        {scoringState.error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{scoringState.error}</p>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="fee_min">FEE minimum (%)</Label>
            <Input id="fee_min" name="fee_min" type="number" step="0.01" defaultValue={getScoreForTier(scoringConfigs, 'FEE') ?? 110} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ee_min">EE minimum (%)</Label>
            <Input id="ee_min" name="ee_min" type="number" step="0.01" defaultValue={getScoreForTier(scoringConfigs, 'EE') ?? 95} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="me_min">ME minimum (%)</Label>
            <Input id="me_min" name="me_min" type="number" step="0.01" defaultValue={getScoreForTier(scoringConfigs, 'ME') ?? 80} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sme_min">SME minimum (%)</Label>
            <Input id="sme_min" name="sme_min" type="number" step="0.01" defaultValue={getScoreForTier(scoringConfigs, 'SME') ?? 60} />
          </div>
        </div>

        <p className="text-sm text-muted-foreground">BE: Below SME threshold</p>

        <div className="flex gap-3 pt-2">
          <SubmitButton pendingLabel="Saving...">Save Scoring Thresholds</SubmitButton>
        </div>
      </form>

      {/* Section 4: Department Mapping */}
      <form action={mappingAction} className="glass rounded-lg border p-6 space-y-5">
        <h2 className="text-lg font-semibold">Department Mapping</h2>
        <p className="text-sm text-muted-foreground">
          Map MIS department codes to system departments for automatic data routing.
        </p>

        {mappingState.error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{mappingState.error}</p>
        )}

        <input type="hidden" name="department_mapping" value={mappingJson} />

        <div className="space-y-3">
          {mappings.map((m, idx) => (
            <div key={idx} className="flex items-end gap-3">
              <div className="space-y-1.5 flex-1">
                {idx === 0 && <Label>MIS Code</Label>}
                <Input
                  value={m.misCode}
                  onChange={e => updateMapping(idx, 'misCode', e.target.value)}
                  placeholder="e.g. DEPT-ENG"
                />
              </div>
              <span className="pb-2 text-muted-foreground">&rarr;</span>
              <div className="space-y-1.5 flex-1">
                {idx === 0 && <Label>Department</Label>}
                <select
                  value={m.departmentId}
                  onChange={e => updateMapping(idx, 'departmentId', e.target.value)}
                  className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
                >
                  <option value="">-- Select --</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => removeMapping(idx)} className="text-destructive">
                Remove
              </Button>
            </div>
          ))}
        </div>

        <Button type="button" variant="outline" size="sm" onClick={addMapping}>
          + Add Mapping
        </Button>

        <div className="flex gap-3 pt-2">
          <SubmitButton pendingLabel="Saving...">Save Department Mapping</SubmitButton>
        </div>
      </form>
    </div>
  )
}
