import { requireRole } from '@/lib/auth'
import { getExchangeRates, getSalaryData } from './actions'
import { SalaryPage } from './salary-page'

/** Compute current fiscal year: if month >= April, FY starts this year; else last year */
function currentFiscalYear(): string {
  const now = new Date()
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
  return `FY${String(year).slice(2)}`
}

export default async function AdminSalaryPage() {
  await requireRole(['admin'])

  const fy = currentFiscalYear()
  const [exchangeRates, employees] = await Promise.all([
    getExchangeRates(fy),
    getSalaryData(),
  ])

  // Build rate map: { AED: rate, USD: rate }
  const rateMap: Record<string, number> = {}
  for (const r of exchangeRates) {
    rateMap[r.from_currency] = r.rate
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Salary &amp; CTC Management</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage exchange rates, import CTC data, and view employee salary information
        </p>
      </div>

      <SalaryPage
        currentFy={fy}
        initialRates={rateMap}
        employees={employees}
      />
    </div>
  )
}
