import { describe, expect, it } from 'vitest'
import { TEMPLATE_CSV } from '@core/plan-import/template'
import { makeDocx, makeXlsx } from '../../../../tests/fixtures/plan-docs'
import { DocumentReadError, docxText, extractDocument, isDayFormat, sheetText } from './doc-extract'

const file = (name: string, content: string | Uint8Array) => new File([typeof content === 'string' ? content : content.slice()], name)
const buffer = (u: Uint8Array) => u.slice().buffer

describe('extractDocument', () => {
  it('reads a CSV into rows, and into a row a line for the AI', async () => {
    const doc = await extractDocument(file('plan.csv', 'Week,Day,Session\n1,Tue,"Sweet spot, 3x12"\n'))
    expect(doc).toEqual({ fileName: 'plan.csv', kind: 'csv', text: 'Week | Day | Session\n1 | Tue | Sweet spot, 3x12', rows: [['Week', 'Day', 'Session'], ['1', 'Tue', 'Sweet spot, 3x12']] })
  })

  it('reads the plan template as rows the template reader takes', async () => {
    const doc = await extractDocument(file('CrankHog plan template.csv', TEMPLATE_CSV))
    expect(doc.rows?.[0]).toEqual(['date', 'sport', 'name', 'steps', 'notes'])
    expect(doc.rows).toHaveLength(8)
  })

  it('reads Markdown and text as they are, lines tidied', async () => {
    expect((await extractDocument(file('plan.md', '# Week 1  \r\n\r\n\r\n- Tue: **easy** 1h\n'))).text).toBe('# Week 1\n\n- Tue: **easy** 1h')
    expect((await extractDocument(file('PLAN.TXT', 'Week 1\nride'))).kind).toBe('text')
  })

  it('reads a Word document, its tables a row a line', async () => {
    const docx = makeDocx(['12-week plan', 'Week 1', [['Day', 'Session'], ['Tue', 'Sweet spot 3x12 & spin']], 'Week 2'])
    const doc = await extractDocument(file('plan.docx', docx))
    expect(doc.kind).toBe('docx')
    expect(doc.text).toBe('12-week plan\nWeek 1\nDay | Session\nTue | Sweet spot 3x12 & spin\nWeek 2')
  })

  it('reads every sheet of a spreadsheet, dates as YYYY-MM-DD, and keeps the template sheet’s rows', async () => {
    const xlsx = makeXlsx({
      Notes: [['Coach notes'], ['Fuel every ride']],
      Plan: [
        ['date', 'sport', 'name', 'steps'],
        [new Date(2027, 0, 4), 'bike', 'Endurance', '- 1h 65%'],
        [new Date(2027, 0, 5), 'run', 'Easy run', '- 40m Z2 HR'],
      ],
    })
    const doc = await extractDocument(file('plan.xlsx', xlsx))
    expect(doc.kind).toBe('sheet')
    expect(doc.rows).toEqual([
      ['date', 'sport', 'name', 'steps'],
      ['2027-01-04', 'bike', 'Endurance', '- 1h 65%'],
      ['2027-01-05', 'run', 'Easy run', '- 40m Z2 HR'],
    ])
    expect(doc.text).toBe('## Notes\nCoach notes\nFuel every ride\n\n## Plan\ndate | sport | name | steps\n2027-01-04 | bike | Endurance | - 1h 65%\n2027-01-05 | run | Easy run | - 40m Z2 HR')
  })

  it('keeps a time or a duration as the sheet shows it, next to a date', async () => {
    const xlsx = makeXlsx({ Plan: [['Date', 'Duration', 'Session'], [new Date(2027, 0, 4), { v: 0.0625, z: 'h:mm' }, 'Endurance'], [new Date(2027, 0, 5), { v: 1.0625, z: '[h]:mm' }, 'Long ride']] })
    const doc = await extractDocument(file('plan.xlsx', xlsx))
    expect(doc.rows).toEqual([
      ['Date', 'Duration', 'Session'],
      ['2027-01-04', '1:30', 'Endurance'],
      ['2027-01-05', '25:30', 'Long ride'],
    ])
  })

  it('tells a date format from a time’s or a duration’s', () => {
    const isDate = (f: string) => /[dmyhs]/i.test(f.replace(/"[^"]*"|\[[^\]]*\]/g, ''))
    expect(['yyyy-mm-dd', 'm/d/yy', 'd-mmm', '[$-409]dddd, mmmm d, yyyy', 'yyyy-mm-dd h:mm'].map((f) => isDayFormat(f, isDate))).toEqual([true, true, true, true, true])
    expect(['h:mm', '[h]:mm:ss', 'mm:ss', '[$-409]h:mm AM/PM', 'h "hours"'].map((f) => isDayFormat(f, isDate))).toEqual([false, false, false, false, false])
  })

  it('reads a .tsv by its tabs, commas and all', async () => {
    const doc = await extractDocument(file('plan.tsv', 'Week\tSession\n1\tSweet spot, 3x12; then spin\n'))
    expect(doc.rows).toEqual([
      ['Week', 'Session'],
      ['1', 'Sweet spot, 3x12; then spin'],
    ])
  })

  it('says why it can’t read a file', async () => {
    await expect(extractDocument(file('plan.pages', 'x'))).rejects.toThrow(/can't read .pages files/)
    await expect(extractDocument(file('empty.txt', ' \n\n '))).rejects.toThrow("There's no text in empty.txt.")
    await expect(extractDocument(file('huge.txt', 'x'.repeat(200_001)))).rejects.toThrow(/too long to read/)
    await expect(extractDocument(file('broken.docx', 'not a zip'))).rejects.toBeInstanceOf(DocumentReadError)
    await expect(extractDocument(file('broken.docx', 'not a zip'))).rejects.toThrow(/^Couldn't read broken.docx/)
  })
})

describe('the readers on their own', () => {
  it('sheetText takes the first sheet’s rows when none is the template', async () => {
    const r = await sheetText(buffer(makeXlsx({ A: [['Week', 'Mon'], ['1', 'Rest']], B: [['x']] })))
    expect(r.rows).toEqual([
      ['Week', 'Mon'],
      ['1', 'Rest'],
    ])
  })

  it('docxText drops images and never follows links to other files', async () => {
    expect(await docxText(buffer(makeDocx(['Only text'])))).toBe('Only text')
  })
})
