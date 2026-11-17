// CSV, read the way spreadsheets write it (RFC 4180): quoted cells may hold
// the delimiter, line breaks and doubled quotes. The delimiter is whichever of
// comma, semicolon or tab the first line uses most, since a spreadsheet saved
// in a comma-decimal locale writes semicolons.

const DELIMITERS = [',', ';', '\t'] as const

/** The delimiter the first line uses most (outside quotes); a comma when it uses none. */
export function sniffDelimiter(text: string): string {
  const first = text.split(/\r?\n/, 1)[0] ?? ''
  const unquoted = first.replace(/"[^"]*"/g, '')
  let best: string = ','
  let most = 0
  for (const d of DELIMITERS) {
    const n = unquoted.split(d).length - 1
    if (n > most) [best, most] = [d, n]
  }
  return best
}

/** Rows of cells. Blank lines are dropped; cells are not trimmed. */
export function parseCsv(text: string, delimiter = sniffDelimiter(text)): string[][] {
  const src = text.replace(/^\uFEFF/, '')
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  const endRow = () => {
    row.push(cell)
    if (row.some((c) => c.trim() !== '')) rows.push(row)
    row = []
    cell = ''
  }
  for (let i = 0; i < src.length; i++) {
    const c = src[i]!
    if (quoted) {
      if (c !== '"') cell += c
      else if (src[i + 1] === '"') {
        cell += '"'
        i++
      } else quoted = false
    } else if (c === '"' && cell === '') quoted = true
    else if (c === delimiter) {
      row.push(cell)
      cell = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++
      endRow()
    } else cell += c
  }
  if (cell !== '' || row.length > 0) endRow()
  return rows
}

/** Rows as text for the AI: cells joined by " | ", one row a line, line breaks inside a cell kept as " / ". */
export function rowsToText(rows: readonly (readonly string[])[]): string {
  return rows
    .map((r) => r.map((c) => c.trim().replace(/\s*\r?\n\s*/g, ' / ')))
    .map((r) => {
      // trailing empty cells say nothing
      let end = r.length
      while (end > 0 && r[end - 1] === '') end--
      return r.slice(0, end).join(' | ')
    })
    .filter((line) => line !== '')
    .join('\n')
}
