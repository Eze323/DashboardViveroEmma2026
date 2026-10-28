export interface CsvColumn {
  key: string
  label: string
}

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value)
  const safeText = typeof value === 'string' && /^[\t\r\n ]*[=+\-@]/.test(text)
    ? `'${text}`
    : text
  return `"${safeText.replaceAll('"', '""')}"`
}

export function downloadCsv(
  rows: Array<Record<string, unknown>>,
  columns: CsvColumn[],
  filename: string
): void {
  const content = [
    columns.map(column => csvCell(column.label)).join(','),
    ...rows.map(row => columns.map(column => csvCell(row[column.key])).join(','))
  ].join('\r\n')
  const blob = new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}
