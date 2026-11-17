import { describe, expect, it } from 'vitest'
import { htmlToText, pdfPageText, tidyLines, type PdfTextItem } from './text'

describe('htmlToText (mammoth’s HTML from a .docx)', () => {
  it('keeps headings, paragraphs and list items a line each', () => {
    const html = '<h1>Base &amp; build</h1><p>Ride easy.</p><ul><li>Hydrate</li><li>Sleep &gt; 8h</li></ul><p>&#8220;Go&#8221;&nbsp;now</p>'
    expect(htmlToText(html)).toBe('Base & build\nRide easy.\n- Hydrate\n- Sleep > 8h\n“Go” now')
  })

  it('reads a table a row a line, cells joined by " | ", paragraphs in a cell by " / "', () => {
    const html =
      '<p>Week 1</p><table><tr><th><p>Day</p></th><th><p>Session</p></th></tr><tr><td><p>Tue</p></td><td><p>Sweet spot 3x12</p><p>10 min warm-up</p></td></tr><tr><td><p>Wed</p></td><td></td></tr></table><p>Week 2</p>'
    expect(htmlToText(html)).toBe('Week 1\nDay | Session\nTue | Sweet spot 3x12 / 10 min warm-up\nWed\nWeek 2')
  })

  it('reads a table inside a table without losing its rows', () => {
    const html = '<table><tr><td><p>Outer</p><table><tr><td><p>a</p></td><td><p>b</p></td></tr></table></td></tr></table>'
    expect(htmlToText(html)).toContain('a | b')
    expect(htmlToText(html)).toContain('Outer')
  })

  it('drops images and every other tag', () => {
    expect(htmlToText('<p>Plan <img src="" /> <strong>now</strong> <a href="x">link</a></p>')).toBe('Plan now link')
  })
})

describe('tidyLines', () => {
  it('trims lines, joins spaces and keeps at most one blank line', () => {
    expect(tidyLines('  a   b \r\n\r\n\r\n\n c\t ')).toBe('a b\n\nc')
  })
})

describe('pdfPageText', () => {
  const run = (str: string, x: number, y: number, width = str.length * 6): PdfTextItem => ({ str, x, y, width, height: 12 })

  it('reads runs top to bottom and left to right, one line per baseline', () => {
    const items = [run('Tue', 72, 700), run('Week 1', 72, 720), run('Sat', 72, 680)]
    expect(pdfPageText(items)).toBe('Week 1\nTue\nSat')
  })

  it('joins runs on a line: a narrow gap a space, a table column " | ", touching runs as they are', () => {
    const items = [run('Sweet', 72, 700, 30), run('spot', 105, 700, 24), run('3x12', 300, 700), run('Tu', 72, 680, 12), run('e', 84, 680, 6)]
    expect(pdfPageText(items)).toBe('Sweet spot | 3x12\nTue')
  })

  it('keeps runs whose baselines differ a little on one line, and skips empty runs', () => {
    const items = [run('Week 3', 72, 700), run('Threshold', 250, 701.5), run(' ', 400, 700)]
    expect(pdfPageText(items)).toBe('Week 3 | Threshold')
  })
})
