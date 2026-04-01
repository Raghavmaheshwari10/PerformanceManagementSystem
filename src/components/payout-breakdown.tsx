interface PayoutBreakdownProps {
  snapshottedVariablePay: number
  rating: string
  individualMultiplier: number
  payoutAmount: number
  currency?: string
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function PayoutBreakdown({
  snapshottedVariablePay,
  rating,
  individualMultiplier,
  payoutAmount,
  currency = 'INR',
}: PayoutBreakdownProps) {
  return (
    <div className="rounded-md border bg-muted/30 overflow-hidden">
      <dl className="divide-y">
        <div className="flex items-center justify-between px-4 py-3">
          <dt className="text-sm text-muted-foreground">
            Your variable pay (at cycle start)
          </dt>
          <dd className="text-sm font-medium tabular-nums">
            {formatCurrency(snapshottedVariablePay, currency)}
          </dd>
        </div>

        <div className="flex items-center justify-between px-4 py-3">
          <dt className="text-sm text-muted-foreground">
            &times; Rating multiplier&nbsp;
            <span className="font-medium text-foreground">
              ({rating}: {individualMultiplier}&times;)
            </span>
          </dt>
          <dd className="text-sm font-medium tabular-nums">
            {individualMultiplier}&times;
          </dd>
        </div>

        <div className="flex items-center justify-between px-4 py-4 bg-background">
          <dt className="text-sm font-semibold flex items-center gap-1">
            <span className="text-muted-foreground">=</span>
            Your payout
          </dt>
          <dd className="text-lg font-bold tabular-nums text-green-700">
            {formatCurrency(payoutAmount, currency)}
          </dd>
        </div>
      </dl>
    </div>
  )
}
