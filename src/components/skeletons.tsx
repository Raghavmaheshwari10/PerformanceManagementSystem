// Reusable Suspense fallback skeletons — animate-pulse, no external deps

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-2">
      {/* Header row */}
      <div className="flex gap-4 rounded-lg border bg-muted/30 px-4 py-3">
        <div className="h-3 w-32 rounded bg-muted" />
        <div className="h-3 w-24 rounded bg-muted" />
        <div className="h-3 w-28 rounded bg-muted" />
        <div className="ml-auto h-3 w-16 rounded bg-muted" />
      </div>
      {/* Data rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 rounded-lg border px-4 py-3">
          <div className="h-3 w-36 rounded bg-muted/60" />
          <div className="h-3 w-20 rounded bg-muted/60" />
          <div className="h-3 w-28 rounded bg-muted/60" />
          <div className="ml-auto h-3 w-14 rounded bg-muted/60" />
        </div>
      ))}
    </div>
  )
}

export function StatCardsSkeleton() {
  return (
    <div className="animate-pulse grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-xl border bg-muted/20 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="h-10 w-10 rounded-xl bg-muted" />
            <div className="h-4 w-4 rounded bg-muted/40" />
          </div>
          <div className="h-7 w-16 rounded bg-muted" />
          <div className="h-3 w-24 rounded bg-muted/60" />
          <div className="h-2.5 w-20 rounded bg-muted/40" />
        </div>
      ))}
    </div>
  )
}

export function CardGridSkeleton({ cards = 6 }: { cards?: number }) {
  return (
    <div className="animate-pulse grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: cards }).map((_, i) => (
        <div key={i} className="rounded-xl border bg-muted/20 p-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-muted" />
            <div className="space-y-1.5">
              <div className="h-3 w-28 rounded bg-muted" />
              <div className="h-2.5 w-20 rounded bg-muted/70" />
            </div>
          </div>
          <div className="space-y-2 pt-1">
            <div className="h-2.5 w-full rounded bg-muted/50" />
            <div className="h-2.5 w-3/4 rounded bg-muted/50" />
          </div>
          <div className="h-6 w-20 rounded bg-muted/40" />
        </div>
      ))}
    </div>
  )
}
