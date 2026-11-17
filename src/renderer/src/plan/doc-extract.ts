// Text out of a plan document, read here on the rider's computer: nothing is
// sent anywhere to read a file. CSV, text and Markdown are read natively;
// spreadsheets (SheetJS), Word (mammoth) and PDF (pdf.js) by libraries loaded
// only when such a file is picked. Tables keep their rows (@core/plan-import/
// text), and a spreadsheet keeps its cells for the no-AI template.
import { parseCsv, rowsToText } from '@core/plan-import/csv'
import { DOCUMENT_MAX } from '@core/plan-import/chunk'
import { isPlanTemplate } from '@core/plan-import/template'
import { htmlToText, pdfPageText, tidyLines, type PdfTextItem } from '@core/plan-import/text'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

export const PLAN_DOCUMENT_EXTENSIONS = ['.csv', '.tsv', '.xlsx', '.xls', '.ods', '.docx', '.pdf', '.md', '.txt'] as const

export type DocumentKind = 'csv' | 'sheet' | 'docx' | 'pdf' | 'text'

export interface ExtractedDocument {
  fileName: string
  kind: DocumentKind
  /** The document as text: what the AI reads. */
  text: string
  /** A CSV's rows, or a spreadsheet's (the sheet in the template's shape, else the first), for the template. */
  rows?: string[][]
}

/** A file CrankHog can't read, with the reason in words for the rider. */
export class DocumentReadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DocumentReadError'
  }
}

/** Bigger than any plan document; a bigger file is probably something else. */
const MAX_FILE_BYTES = 25 * 1024 * 1024

const extensionOf = (name: string) => name.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] ?? ''

/** Reads a plan document's text. Throws DocumentReadError, with the reason, for a file it can't read. */
export async function extractDocument(file: File): Promise<ExtractedDocument> {
  const ext = extensionOf(file.name)
  if (!(PLAN_DOCUMENT_EXTENSIONS as readonly string[]).includes(ext)) throw new DocumentReadError(`CrankHog can't read ${ext || 'these'} files. Use a .csv, .xlsx, .docx, .pdf, .md or .txt file.`)
  if (file.size > MAX_FILE_BYTES) throw new DocumentReadError(`${file.name} is ${Math.round(file.size / 1024 / 1024)} MB. A plan document is much smaller: is it the right file?`)
  let doc: Omit<ExtractedDocument, 'fileName'>
  try {
    doc = await read(ext, file)
  } catch (e) {
    if (e instanceof DocumentReadError) throw e
    throw new DocumentReadError(`Couldn't read ${file.name}: ${e instanceof Error ? e.message : String(e)}`)
  }
  if (doc.text.trim() === '') throw new DocumentReadError(ext === '.pdf' ? `There's no text in ${file.name}. A scanned PDF is a picture of the page, which CrankHog can't read: export the plan as text from where you made it.` : `There's no text in ${file.name}.`)
  if (doc.text.length > DOCUMENT_MAX) throw new DocumentReadError(`${file.name} is too long to read (${Math.round(doc.text.length / 1000)}k characters). Split it into blocks of a few months each.`)
  return { fileName: file.name, ...doc }
}

async function read(ext: string, file: File): Promise<Omit<ExtractedDocument, 'fileName'>> {
  switch (ext) {
    case '.csv':
    case '.tsv': {
      const rows = parseCsv(await file.text())
      return { kind: 'csv', text: rowsToText(rows), rows }
    }
    case '.md':
    case '.txt':
      return { kind: 'text', text: tidyLines(await file.text()) }
    case '.docx':
      return { kind: 'docx', text: await docxText(await file.arrayBuffer()) }
    case '.pdf':
      return { kind: 'pdf', text: await pdfText(await file.arrayBuffer()) }
    default:
      return { kind: 'sheet', ...(await sheetText(await file.arrayBuffer())) }
  }
}

/** Every sheet of a workbook, a row a line, each under its name; and the rows of the sheet the template can read (else the first). */
export async function sheetText(data: ArrayBuffer): Promise<{ text: string; rows: string[][] }> {
  const XLSX = await import('xlsx')
  // cellNF keeps each cell's number format, to tell a date from a number
  const wb = XLSX.read(new Uint8Array(data), { type: 'array', cellNF: true, dense: true })
  const sheets = wb.SheetNames.map((name) => {
    const grid = (wb.Sheets[name]?.['!data'] ?? []) as (({ t: string; v?: unknown; w?: string; z?: string | number } | undefined)[] | undefined)[]
    const rows = grid.map((row) =>
      Array.from(row ?? [], (cell) => {
        if (!cell) return ''
        // a date's own format ("1/4/27") is the locale's: write it as YYYY-MM-DD, from the serial (no time zone in it)
        if (cell.t === 'n' && cell.z !== undefined && XLSX.SSF.is_date(cell.z)) return XLSX.SSF.format('yyyy-mm-dd', cell.v as number)
        return cell.w ?? (cell.v === undefined || cell.v === null ? '' : String(cell.v))
      }),
    )
    return { name, rows: rows.filter((r) => r.some((c) => c.trim() !== '')) }
  })
  const used = sheets.filter((s) => s.rows.length > 0)
  const text = used.map((s) => (used.length > 1 ? `## ${s.name}\n${rowsToText(s.rows)}` : rowsToText(s.rows))).join('\n\n')
  return { text, rows: (used.find((s) => isPlanTemplate(s.rows)) ?? used[0])?.rows ?? [] }
}

/** A Word document's text: paragraphs a line, tables a row a line. Images are left out, and links to other files are never followed. */
export async function docxText(data: ArrayBuffer): Promise<string> {
  const mammoth = await import('mammoth')
  const m = (mammoth as unknown as { default?: typeof mammoth }).default ?? mammoth
  // the browser build reads `arrayBuffer`; Node's (the unit tests) reads `buffer`
  const input = { arrayBuffer: data, buffer: new Uint8Array(data) } as unknown as { arrayBuffer: ArrayBuffer }
  const { value } = await m.convertToHtml(input, { convertImage: m.images.imgElement(async () => ({ src: '' })) })
  return htmlToText(value)
}

/** A PDF's text, page by page, a line of the page a line (tables' columns joined by " | "). */
export async function pdfText(data: ArrayBuffer): Promise<string> {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl
  const task = pdfjs.getDocument({ data: new Uint8Array(data), disableFontFace: true, useSystemFonts: false, stopAtErrors: false })
  try {
    const doc = await task.promise
    const pages: string[] = []
    for (let n = 1; n <= doc.numPages; n++) {
      const content = await (await doc.getPage(n)).getTextContent()
      const items: PdfTextItem[] = []
      for (const i of content.items) if ('str' in i) items.push({ str: i.str, x: i.transform[4] as number, y: i.transform[5] as number, width: i.width, height: i.height || Math.hypot(i.transform[2] as number, i.transform[3] as number) })
      pages.push(pdfPageText(items))
    }
    return tidyLines(pages.join('\n\n'))
  } finally {
    void task.destroy()
  }
}
