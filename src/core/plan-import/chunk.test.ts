import { describe, expect, it } from 'vitest'
import { chunkDocument, CHUNK_MAX, CONTEXT_MAX, planImportInput, weekHeading } from './chunk'

/** A plan document: a preamble, then `weeks` weeks of `perWeek` sessions, each line about 60 characters. */
function plan(weeks: number, perWeek = 5): string {
  const out = ['Ironman 70.3 plan', 'Race: 2027-06-06. All power as % of FTP.', '']
  for (let w = 1; w <= weeks; w++) {
    out.push(`Week ${w}`)
    for (let s = 0; s < perWeek; s++) out.push(`Day ${s + 1}: 10 min warm-up, ${w}x8 min at 95 %, 4 min easy between. ${'.'.repeat(8)}`)
    out.push('')
  }
  return out.join('\n')
}

describe('weekHeading', () => {
  it.each([
    ['Week 3', 3],
    ['WEEK 12: build', 12],
    ['## Week 4 (recovery)', 4],
    ['**Week 5**', 5],
    ['Wk. 6', 6],
    ['Week 3 | Tue | Sweet spot', 3],
    ['- Week 2', 2],
  ])('reads %s as week %i', (line, n) => {
    expect(weekHeading(line)).toBe(n)
  })

  it.each(['Weekly volume: 8h', 'This week is easy', 'Tue | Week 3 recap', 'Weekend: long ride'])('doesn’t read "%s" as a heading', (line) => {
    expect(weekHeading(line)).toBeNull()
  })
})

describe('chunkDocument', () => {
  it('keeps a short document in one part, with its preamble as context', () => {
    const { chunks, context } = chunkDocument(plan(3))
    expect(chunks).toHaveLength(1)
    expect(chunks[0]!.weeks).toEqual([1, 3])
    expect(chunks[0]!.text).toContain('Ironman 70.3 plan')
    expect(context).toBe('Ironman 70.3 plan\nRace: 2027-06-06. All power as % of FTP.')
  })

  it('breaks a long plan at week headings: every part fits, no week is split, and nothing is lost', () => {
    const text = plan(30)
    const { chunks } = chunkDocument(text, 3000)
    expect(chunks.length).toBeGreaterThan(3)
    for (const c of chunks) expect(c.text.length).toBeLessThanOrEqual(3000)
    // each part starts at a week (after the first, which starts with the preamble)
    for (const c of chunks.slice(1)) expect(weekHeading(c.text.split('\n')[0]!)).toBe(c.weeks![0])
    // the weeks run on from part to part, each in exactly one
    const ranges = chunks.map((c) => c.weeks!)
    expect(ranges[0]![0]).toBe(1)
    expect(ranges.at(-1)![1]).toBe(30)
    for (let i = 1; i < ranges.length; i++) expect(ranges[i]![0]).toBe(ranges[i - 1]![1] + 1)
    const squash = (s: string) => s.replace(/\s+/g, ' ').trim()
    expect(squash(chunks.map((c) => c.text).join('\n'))).toBe(squash(text))
  })

  it('reads a table with a row per day, each starting "Week N", as one block per week', () => {
    const rows = ['Week | Day | Session']
    for (let w = 1; w <= 6; w++) for (const d of ['Tue', 'Thu', 'Sat']) rows.push(`Week ${w} | ${d} | ${'x'.repeat(40)}`)
    const { chunks, context } = chunkDocument(rows.join('\n'), 400)
    expect(context).toBe('Week | Day | Session')
    for (const c of chunks) {
      const weeks = new Set(c.text.split('\n').map(weekHeading).filter((n) => n !== null))
      expect(weeks.size).toBe(c.weeks![1] - c.weeks![0] + 1)
    }
    // a week's three rows are never split across parts
    const seen = chunks.flatMap((c) => [...new Set(c.text.split('\n').map(weekHeading).filter((n) => n !== null))])
    expect(seen).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('splits a document without week headings at line ends, its first line the context', () => {
    const lines = Array.from({ length: 200 }, (_, i) => `Session ${i + 1}: 45 minutes steady at tempo, cadence 90.`)
    const { chunks, context } = chunkDocument(lines.join('\n'), 2000)
    expect(context).toBe(lines[0])
    expect(chunks.every((c) => c.weeks === null && c.text.length <= 2000)).toBe(true)
    expect(chunks.flatMap((c) => c.text.split('\n'))).toEqual(lines)
  })

  it('splits a week too long for one part, and a line too long for one part', () => {
    const long = `Week 1\n${'a'.repeat(250)}\n${'b'.repeat(90)}`
    const { chunks } = chunkDocument(long, 100)
    expect(chunks.every((c) => c.text.length <= 100)).toBe(true)
    expect(chunks.map((c) => c.text).join('').replace(/\n/g, '')).toBe(long.replace(/\n/g, ''))
    expect(chunks.every((c) => c.weeks?.[0] === 1)).toBe(true)
  })

  it('caps the context', () => {
    const { context } = chunkDocument(`${'intro '.repeat(1000)}\nWeek 1\nride`)
    expect(context.length).toBeLessThanOrEqual(CONTEXT_MAX)
  })
})

describe('planImportInput', () => {
  it('sends a single part with today’s date and the document, and nothing about the rider', () => {
    const { chunks, context } = chunkDocument(plan(2))
    const input = planImportInput({ fileName: 'Plan.docx', today: '2026-11-16', chunk: chunks[0]!, part: 1, parts: 1, context })
    expect(input).toContain('Today is 2026-11-16.')
    expect(input).toContain('"Plan.docx"')
    expect(input).toContain(`<document>\n${chunks[0]!.text}\n</document>`)
    expect(input).not.toContain('<context>')
    expect(input).not.toMatch(/ftp ?[:=]|weight|heart rate/i)
  })

  it('gives later parts the start of the document as context, and says which weeks they hold', () => {
    const { chunks, context } = chunkDocument(plan(30), 3000)
    const first = planImportInput({ fileName: 'p.pdf', today: '2026-11-16', chunk: chunks[0]!, part: 1, parts: chunks.length, context })
    const second = planImportInput({ fileName: 'p.pdf', today: '2026-11-16', chunk: chunks[1]!, part: 2, parts: chunks.length, context })
    expect(first).not.toContain('<context>')
    expect(second).toContain(`Part 2 of ${chunks.length} (weeks ${chunks[1]!.weeks![0]}-${chunks[1]!.weeks![1]})`)
    expect(second).toContain(`<context>\n${context}\n</context>`)
  })

  it('stays within ai.structured’s 40,000 characters at the largest part, context and file name', () => {
    const chunk = { text: 'x'.repeat(CHUNK_MAX), weeks: [1, 104] as [number, number] }
    const input = planImportInput({ fileName: `${'n'.repeat(300)}.pdf`, today: '2026-11-16', chunk, part: 2, parts: 17, context: 'c'.repeat(CONTEXT_MAX) })
    expect(input.length).toBeLessThan(40_000)
  })
})
