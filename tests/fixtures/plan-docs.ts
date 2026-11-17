// Small plan documents built in code, for the plan-document import's unit and
// E2E tests: a Word file, a PDF and a spreadsheet, each the least the real
// readers (mammoth, pdf.js, SheetJS) accept. Nobody's real plan is in here.
import { strToU8, zipSync } from 'fflate'
import * as XLSX from 'xlsx'

const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** A Word document: paragraphs, and tables of rows of cells. */
export function makeDocx(blocks: readonly (string | readonly (readonly string[])[])[]): Uint8Array {
  const para = (t: string) => `<w:p><w:r><w:t xml:space="preserve">${xml(t)}</w:t></w:r></w:p>`
  const body = blocks
    .map((b) => (typeof b === 'string' ? para(b) : `<w:tbl>${b.map((row) => `<w:tr>${row.map((c) => `<w:tc>${para(c)}</w:tc>`).join('')}</w:tr>`).join('')}</w:tbl>`))
    .join('')
  return zipSync({
    '[Content_Types].xml': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    ),
    '_rels/.rels': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    ),
    'word/document.xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`),
  })
}

/** A one-page PDF in Helvetica: each run of text at x, y (points up from the bottom of a Letter page). */
export function makePdf(runs: readonly { x: number; y: number; text: string }[]): Uint8Array {
  const esc = (s: string) => s.replace(/[\\()]/g, (c) => `\\${c}`)
  const stream = runs.map((r) => `BT /F1 12 Tf ${r.x} ${r.y} Td (${esc(r.text)}) Tj ET`).join('\n')
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
  ]
  let out = '%PDF-1.4\n'
  const offsets: number[] = []
  objects.forEach((o, i) => {
    offsets.push(out.length)
    out += `${i + 1} 0 obj\n${o}\nendobj\n`
  })
  const xref = out.length
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return strToU8(out)
}

/** An .xlsx workbook: sheets of rows; a Date cell is written as a date. */
/** A spreadsheet; a cell given as { v, z } is a number with that format, such as a duration { v: 0.0625, z: 'h:mm' }. */
export function makeXlsx(sheets: Record<string, readonly (readonly (string | number | Date | { v: number; z: string })[])[]>): Uint8Array {
  const wb = XLSX.utils.book_new()
  const cell = (c: string | number | Date | { v: number; z: string }) => (typeof c === 'object' && !(c instanceof Date) ? { t: 'n', ...c } : c)
  for (const [name, rows] of Object.entries(sheets)) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows.map((r) => r.map(cell)), { cellDates: true }), name)
  return new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer)
}
