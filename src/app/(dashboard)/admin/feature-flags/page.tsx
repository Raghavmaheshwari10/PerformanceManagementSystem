import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { FeatureFlagToggle } from './feature-flag-toggle'

export default async function FeatureFlagsPage() {
  await requireRole(['admin'])
  const supabase = await createClient()
  
  const { data: flags } = await supabase
    .from('feature_flags')
    .select('*, feature_flag_overrides(*)')
    .order('category')
    .order('name')
  
  const categories = ['module', 'ui', 'notify'] as const
  const categoryLabels = { module: 'Modules', ui: 'UI Controls', notify: 'Notifications' }
  
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Feature Configuration</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Toggle features on/off for the entire organisation. User-level overrides
          take precedence over role overrides, which take precedence over org settings.
        </p>
      </div>
      {categories.map(cat => {
        const catFlags = (flags ?? []).filter(f => f.category === cat)
        if (!catFlags.length) return null
        return (
          <div key={cat} className="rounded-lg border p-4 space-y-3">
            <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
              {categoryLabels[cat]}
            </h2>
            <div className="divide-y">
              {catFlags.map(flag => {
                const orgOverride = flag.feature_flag_overrides?.find(
                  (o: any) => o.scope === 'org' && o.scope_id === null
                )
                const currentValue = orgOverride?.value ?? flag.default_value
                return (
                  <div key={flag.key} className="py-3 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium">{flag.name}</p>
                      {flag.description && (
                        <p className="text-xs text-muted-foreground">{flag.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Key: <code className="font-mono">{flag.key}</code>
                        {flag.default_value ? ' · Default: On' : ' · Default: Off'}
                      </p>
                    </div>
                    <FeatureFlagToggle
                      flagKey={flag.key}
                      value={currentValue}
                      name={flag.name}
                      category={cat}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
