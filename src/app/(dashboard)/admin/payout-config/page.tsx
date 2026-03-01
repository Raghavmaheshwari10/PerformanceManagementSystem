import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { updatePayoutConfig } from './actions'
import { SubmitButton } from '@/components/submit-button'
import type { PayoutConfig, RatingTier } from '@/lib/types'

const TIER_LABELS: Record<RatingTier, string> = {
  FEE: 'Far Exceeded Expectations',
  EE:  'Exceeded Expectations',
  ME:  'Met Expectations',
  SME: 'Significantly Met Expectations (base)',
  BE:  'Below Expectations',
}

// Order tiers for display
const TIER_ORDER: RatingTier[] = ['FEE', 'EE', 'ME', 'SME', 'BE']

export default async function PayoutConfigPage() {
  await requireRole(['admin'])
  const supabase = await createClient()
  const { data: config } = await supabase
    .from('payout_config')
    .select('*')
    .order('rating_tier')

  // Sort by TIER_ORDER for display
  const sorted = config ? [...config].sort((a, b) =>
    TIER_ORDER.indexOf(a.rating_tier as RatingTier) - TIER_ORDER.indexOf(b.rating_tier as RatingTier)
  ) : []

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-2xl font-bold">Payout Multipliers</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Global defaults. Individual cycles can override FEE, EE, and ME.
          Changes apply to future cycle locks only.
        </p>
      </div>

      <div className="rounded-lg border divide-y">
        {sorted.map((row: PayoutConfig) => (
          <form
            key={row.rating_tier}
            action={updatePayoutConfig.bind(null, row.rating_tier) as (formData: FormData) => void}
            className="flex items-center justify-between px-4 py-3 gap-4"
          >
            <div className="flex-1">
              <p className="text-sm font-medium">{row.rating_tier}</p>
              <p className="text-xs text-muted-foreground">{TIER_LABELS[row.rating_tier]}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">×</span>
              <input
                name="multiplier"
                type="number"
                step="0.01"
                min="0"
                defaultValue={row.multiplier}
                className="w-20 rounded border px-2 py-1 text-sm text-right"
              />
              <SubmitButton size="sm">Save</SubmitButton>
            </div>
          </form>
        ))}
      </div>

      <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/20 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
        ⚠ Locked cycles are unaffected. Only future locks use updated values.
      </div>
    </div>
  )
}
