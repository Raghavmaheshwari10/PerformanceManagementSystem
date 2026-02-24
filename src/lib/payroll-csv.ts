interface PayrollRow {
  zimyo_id: string
  full_name: string
  department: string
  final_rating: string
  payout_multiplier: number
  payout_amount: number
}

export function generatePayrollCsv(data: PayrollRow[]): string {
  const header = 'zimyo_employee_id,employee_name,department,final_rating,payout_multiplier,payout_amount'
  const rows = data.map(r =>
    `${r.zimyo_id},${r.full_name},${r.department},${r.final_rating},${r.payout_multiplier},${r.payout_amount}`
  )
  return [header, ...rows].join('\n')
}
