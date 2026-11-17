// A plan document in parts small enough for one AI call each. Parts break at
// the document's week headings ("Week 3", "WK 3:", "## Week 3"), so a week is
// read whole, by one call, whenever it fits. Each part after the first takes
// the start of the document with it (the plan's name, its race, how its
// sessions are written), so the AI reads every part the same way.

/** Most characters of document in one part. Well under ai.structured's 40,000, with room for the context and the framing. */
export const CHUNK_MAX = 12_000
/** Most characters of the document's start sent with each later part. */
export const CONTEXT_MAX = 2_000
/** Longer than this and the document is refused: about 17 parts, which no training plan needs. */
export const DOCUMENT_MAX = 200_000

export interface DocChunk {
  text: string
  /** The first and last week it covers, by the document's week headings; null when it has none. */
  weeks: [number, number] | null
}

export interface ChunkedDocument {
  /** The start of the document, sent with every part after the first. */
  context: string
  chunks: DocChunk[]
}

/** "Week 3", "WK 3:", "## Week 3 (build)", "**Week 12**", "Week 3 | Mon | …" (a table row). */
const WEEK_HEADING = /^[\s#>*_|-]*(?:week|wk)\.?\s*(\d{1,3})\b/i

/** The week a line opens, or null. */
export function weekHeading(line: string): number | null {
  const m = WEEK_HEADING.exec(line)
  return m ? Number(m[1]) : null
}

interface Piece {
  week: number | null
  text: string
}

/** A block cut at line ends into pieces of at most `max`; a line longer than that is cut where it has to be. */
function split(week: number | null, text: string, max: number): Piece[] {
  if (text.length <= max) return [{ week, text }]
  const pieces: Piece[] = []
  let cur = ''
  for (const line of text.split('\n')) {
    for (let at = 0; at < Math.max(line.length, 1); at += max) {
      const part = line.slice(at, at + max)
      if (cur !== '' && cur.length + 1 + part.length > max) {
        pieces.push({ week, text: cur })
        cur = part
      } else cur = cur === '' ? part : `${cur}\n${part}`
    }
  }
  if (cur.trim() !== '') pieces.push({ week, text: cur })
  return pieces
}

/** Splits a document's text into parts of at most `max` characters, at week headings where it has them. */
export function chunkDocument(text: string, max = CHUNK_MAX): ChunkedDocument {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const blocks: { week: number | null; lines: string[] }[] = [{ week: null, lines: [] }]
  for (const line of lines) {
    const n = weekHeading(line)
    // a table has a row per day, each starting "Week 3": one block until the number changes
    if (n !== null && n !== blocks.at(-1)!.week) blocks.push({ week: n, lines: [line] })
    else blocks.at(-1)!.lines.push(line)
  }
  const hasWeeks = blocks.length > 1
  const preamble = blocks[0]!.lines.join('\n').trim()
  // without week headings the first line is the best context there is: often a table's header row
  const context = (hasWeeks ? preamble : (lines.find((l) => l.trim() !== '') ?? '')).slice(0, CONTEXT_MAX).trim()

  const pieces = blocks.flatMap((b) => split(b.week, b.lines.join('\n').trim(), max)).filter((p) => p.text !== '')
  const chunks: { pieces: Piece[]; length: number }[] = []
  for (const p of pieces) {
    const cur = chunks.at(-1)
    if (cur && cur.length + 2 + p.text.length <= max) {
      cur.pieces.push(p)
      cur.length += 2 + p.text.length
    } else chunks.push({ pieces: [p], length: p.text.length })
  }
  return {
    context,
    chunks: chunks.map((c) => {
      const weeks = c.pieces.map((p) => p.week).filter((w): w is number => w !== null)
      return { text: c.pieces.map((p) => p.text).join('\n\n'), weeks: weeks.length > 0 ? [Math.min(...weeks), Math.max(...weeks)] : null }
    }),
  }
}

/**
 * The user message for one part: today's date (for dates written without a
 * year), which part this is, the document's start for context after the
 * first, and the part itself. Nothing about the rider goes with it.
 */
export function planImportInput(o: { fileName: string; today: string; chunk: DocChunk; part: number; parts: number; context: string }): string {
  const name = o.fileName.replace(/["\n\r]/g, '').slice(0, 120)
  const weeks = o.chunk.weeks ? ` (weeks ${o.chunk.weeks[0]}${o.chunk.weeks[1] !== o.chunk.weeks[0] ? `-${o.chunk.weeks[1]}` : ''})` : ''
  const lines = [`Today is ${o.today}.`]
  if (o.parts === 1) lines.push(`The rider's training plan document, "${name}":`)
  else {
    lines.push(`Part ${o.part} of ${o.parts}${weeks} of the rider's training plan document, "${name}". Read only this part into items.`)
    if (o.part > 1 && o.context) lines.push('The start of the document, for context only (its plan name, race and dates, and how it writes sessions); its sessions were read with part 1:', '<context>', o.context, '</context>')
  }
  lines.push('<document>', o.chunk.text, '</document>')
  return lines.join('\n')
}
