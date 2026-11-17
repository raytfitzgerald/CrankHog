// Plain text from what the document readers give back, keeping the shape a
// training plan relies on: a table's rows stay rows (cells joined by " | "),
// so "Week 3 | Tue | 4x8 min threshold" still says which day is which.

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : m
    }
    return ENTITIES[e.toLowerCase()] ?? m
  })
}

const stripTags = (html: string) => html.replace(/<[^>]*>/g, '')

/** A table cell's text, its paragraphs and line breaks joined by " / ". */
function cellText(html: string): string {
  const parts = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|h[1-6]|li)>/gi, '\n')
    .split('\n')
    .map((p) => decodeEntities(stripTags(p)).replace(/\s+/g, ' ').trim())
    .filter((p) => p !== '')
  return parts.join(' / ')
}

/** A table as lines: one row a line, cells joined by " | ". */
function tableText(html: string): string {
  const rows: string[] = []
  for (const [, row] of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row!.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(([, c]) => cellText(c!))
    let end = cells.length
    while (end > 0 && cells[end - 1] === '') end--
    if (end > 0) rows.push(cells.slice(0, end).join(' | '))
  }
  return rows.join('\n')
}

/**
 * The text of the HTML mammoth makes from a .docx: headings, paragraphs and
 * list items a line each, tables a row a line. Mammoth's HTML is simple and
 * well formed (no scripts, no attributes that matter), so tags are read here
 * rather than through a DOM.
 */
export function htmlToText(html: string): string {
  let s = html
  // innermost tables first, so a table in a table still reads row by row
  const innermost = /<table[^>]*>((?:(?!<table)[\s\S])*?)<\/table>/i
  for (let guard = 0; innermost.test(s) && guard < 1000; guard++) s = s.replace(innermost, (_m, body: string) => `\n${tableText(body)}\n`)
  s = s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<\/(p|h[1-6]|li|ul|ol|div)>/gi, '\n')
  // a Word document's empty paragraphs are spacing, not structure
  return tidyLines(decodeEntities(stripTags(s))).replace(/\n{2,}/g, '\n')
}

/** Lines trimmed, runs of blank lines down to one. */
export function tidyLines(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.replace(/[ \t\u00a0]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** A run of text on a PDF page: where it starts (x, y up from the bottom), how wide and tall it is. */
export interface PdfTextItem {
  str: string
  x: number
  y: number
  width: number
  height: number
}

/**
 * A PDF page's text as lines, in reading order. Runs on the same baseline are
 * one line; a wide gap between runs (a table's columns) becomes " | ", a
 * narrow one a space.
 */
export function pdfPageText(items: readonly PdfTextItem[]): string {
  const runs = items.filter((i) => i.str.trim() !== '').sort((a, b) => b.y - a.y || a.x - b.x)
  const lines: PdfTextItem[][] = []
  for (const run of runs) {
    const line = lines.at(-1)
    const size = Math.max(run.height, 1)
    if (line && Math.abs(line[0]!.y - run.y) < size * 0.5) line.push(run)
    else lines.push([run])
  }
  return lines
    .map((line) => {
      const sorted = line.sort((a, b) => a.x - b.x)
      let out = sorted[0]!.str
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1]!
        const run = sorted[i]!
        const gap = run.x - (prev.x + prev.width)
        const size = Math.max(run.height, prev.height, 1)
        if (gap > size * 1.5) out = `${out.trimEnd()} | ${run.str.trimStart()}`
        else if (gap > size * 0.15 && !/\s$/.test(out) && !/^\s/.test(run.str)) out += ` ${run.str}`
        else out += run.str
      }
      return out
    })
    .join('\n')
}
