/**
 * Client-side CSV export utility.
 * Generates a CSV string from an array of objects and triggers a download.
 */

export function downloadCsv(
  rows: Record<string, string | number | null | undefined>[],
  filename: string,
  columns?: { key: string; label: string }[]
) {
  if (rows.length === 0) return

  const cols = columns ?? Object.keys(rows[0]).map(k => ({ key: k, label: k }))

  const header = cols.map(c => escapeCsvField(c.label)).join(',')
  const body = rows
    .map(row =>
      cols
        .map(c => {
          const val = row[c.key]
          return escapeCsvField(val == null ? '' : String(val))
        })
        .join(',')
    )
    .join('\n')

  const csv = `${header}\n${body}`
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}
