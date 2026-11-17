// The plan template: a spreadsheet (CSV or .xlsx) with a session a row, read
// without AI. Columns, in any order, by their header:
//   date   YYYY-MM-DD (or a spreadsheet's   or  week (1, 2 …) and day (Mon … Sun, or 1-7)
//          own 1/4/2027, when it's clear)
//   sport  bike, run, swim or other (bike when left out)
//   name   what the session is called
//   steps  bike: intervals.icu text; run, swim, other: session steps
//          (docs/WORKOUT-FORMAT.md). A line a step: a line break in the
//          cell, or a semicolon.
//   notes  optional
import { isRealDay } from '../workout/plan'
import type { DateKey } from '../workout/schedule'
import { MAX_IMPORT_WEEKS, sportFrom, whereOf, type ImportDoc, type ImportItem } from './model'

const COLUMNS = ['date', 'week', 'day', 'sport', 'name', 'steps', 'notes'] as const
type Column = (typeof COLUMNS)[number]

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

export const TEMPLATE_FILE_NAME = 'CrankHog plan template.csv'

/** The example the rider downloads: a week of a plan with every sport, and both ways of writing steps. */
export const TEMPLATE_CSV = `date,sport,name,steps,notes
2027-01-04,bike,Endurance 60,"Warmup
- 10m ramp 50-70%
- 40m 68%
Cooldown
- 10m ramp 65-45%",Easy enough to talk.
2027-01-05,run,Easy run,- 40m Z2 HR,
2027-01-06,bike,Sweet spot 3x12,Warmup; - 10m ramp 50-75%; Main set 3x; - 12m 90%; - 5m 55%; Cooldown; - 10m 50%,
2027-01-07,swim,CSS 10x100,"Warmup
- 400mtr easy
Main set 10x
- 100mtr 1:40/100m Pace
- 15s rest
Cooldown
- 200mtr easy",
2027-01-08,other,Strength,- 45m,"Squats, lunges, core."
2027-01-09,bike,Threshold 4x8,Warmup; - 15m ramp 50-80%; Main set 4x; - 8m 100%; - 4m 55%; Cooldown; - 10m 50%,
2027-01-10,run,Long run,- 1h30m Z2 HR,Fuel every 30 minutes.
`

const header = (cell: string): Column | null => {
  const c = cell.trim().toLowerCase()
  return (COLUMNS as readonly string[]).includes(c) ? (c as Column) : null
}

/** Where each template column is, or null when the first row isn't the template's header (it needs name, steps, and a date or a week). */
export function templateColumns(rows: readonly (readonly string[])[]): Partial<Record<Column, number>> | null {
  const first = rows[0]
  if (!first) return null
  const at: Partial<Record<Column, number>> = {}
  first.forEach((cell, i) => {
    const c = header(cell)
    if (c && at[c] === undefined) at[c] = i
  })
  return at.name !== undefined && at.steps !== undefined && (at.date !== undefined || at.week !== undefined) ? at : null
}

export function isPlanTemplate(rows: readonly (readonly string[])[]): boolean {
  return templateColumns(rows) !== null
}

/** A cell's steps as lines: line breaks, or semicolons for a one-line cell. */
export function templateSteps(cell: string): string {
  return cell
    .split(/\r?\n|;/)
    .map((l) => l.trim())
    .join('\n')
    .trim()
}

function dayOf(cell: string): number | null {
  const c = cell.trim().toLowerCase()
  if (/^[1-7]$/.test(c)) return Number(c) - 1
  const i = DAYS.indexOf(c.slice(0, 3))
  return i >= 0 ? i : null
}

const pad = (n: number) => String(n).padStart(2, '0')
const isoOf = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`

/** "1/4/2027", "04.01.27", "1-4-2027": two short numbers and a year, in an order the cell doesn't say. */
const SHORT_DATE = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})$/
/** "2027/1/4", "2027.01.04": the year first is always year, month, day. */
const YEAR_FIRST = /^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})$/

const UNREADABLE = 'Write dates as YYYY-MM-DD, such as 2027-01-04. If a spreadsheet app changed them, set the date column to text and type them again.'

/**
 * The date column's own word on its short dates: day first when one of them
 * can only be ("13/1/2027"), month first likewise ("1/13/2027"), else null.
 */
function columnOrder(cells: readonly string[]): boolean | null {
  let dayFirst = false
  let monthFirst = false
  for (const c of cells) {
    const m = SHORT_DATE.exec(c)
    if (!m) continue
    if (Number(m[1]) > 12) dayFirst = true
    if (Number(m[2]) > 12) monthFirst = true
  }
  return dayFirst === monthFirst ? null : dayFirst
}

/** A date cell as a day, or why it isn't one. `dayFirst` settles a short date that could be either. */
function dateOf(cell: string, dayFirst: boolean | null): DateKey | { reason: string } {
  if (isRealDay(cell)) return cell
  const y = YEAR_FIRST.exec(cell)
  if (y) {
    const day = isoOf(Number(y[1]), Number(y[2]), Number(y[3]))
    return isRealDay(day) ? day : { reason: `the date "${cell}" isn't a real day.` }
  }
  const m = SHORT_DATE.exec(cell)
  if (!m) return { reason: `the date "${cell}" isn't one CrankHog can read. ${UNREADABLE}` }
  const [a, b] = [Number(m[1]), Number(m[2])]
  const year = m[3]!.length === 2 ? 2000 + Number(m[3]) : Number(m[3])
  const asDayFirst = isoOf(year, b, a)
  const asMonthFirst = isoOf(year, a, b)
  const real = [isRealDay(asDayFirst) ? asDayFirst : null, isRealDay(asMonthFirst) ? asMonthFirst : null]
  if (!real[0] && !real[1]) return { reason: `the date "${cell}" isn't a real day.` }
  if (!real[0] || !real[1] || real[0] === real[1]) return (real[0] ?? real[1])!
  if (dayFirst === null) return { reason: `the date "${cell}" could be ${asMonthFirst} or ${asDayFirst}. Write it as YYYY-MM-DD.` }
  return dayFirst ? asDayFirst : asMonthFirst
}

export interface TemplateOptions {
  /**
   * Whether this computer writes a short date day first (1/4/2027 is 1 April),
   * as a spreadsheet app re-saving the template does. Used only for a date
   * the column itself leaves open; without it, such a date is a problem.
   */
  dayFirst?: boolean
}

export interface TemplateRead {
  doc: ImportDoc
  /** Rows that couldn't become a session, and why. */
  problems: { where: string; reason: string }[]
}

/** Reads the template's rows (the header first). Never throws: a bad row is a problem, the rest still read. */
export function readTemplate(rows: readonly (readonly string[])[], opts: TemplateOptions = {}): TemplateRead {
  const at = templateColumns(rows)
  if (!at) return { doc: { items: [], skipped: [] }, problems: [{ where: 'Row 1', reason: 'The first row needs the columns name, steps, and date (or week and day).' }] }
  const cell = (row: readonly string[], c: Column) => (at[c] !== undefined ? (row[at[c]!] ?? '').trim() : '')
  const items: ImportItem[] = []
  const problems: TemplateRead['problems'] = []
  const dayFirst = columnOrder(rows.slice(1).map((r) => cell(r, 'date'))) ?? opts.dayFirst ?? null
  rows.slice(1).forEach((row, i) => {
    const where = `Row ${i + 2}`
    if (row.every((c) => c.trim() === '')) return
    const name = cell(row, 'name')
    const fail = (reason: string) => problems.push({ where, reason: name ? `${name}: ${reason}` : reason })
    const sportCell = cell(row, 'sport')
    const sport = sportCell === '' ? 'bike' : sportFrom(sportCell)
    if (!sport) return fail(`sport "${cell(row, 'sport')}" isn't bike, run, swim or other.`)
    if (!name) return fail('it has no name.')
    const dateCell = cell(row, 'date')
    const weekCell = cell(row, 'week')
    const dayCell = cell(row, 'day')
    let when: Pick<ImportItem, 'date' | 'week' | 'weekday'> = {}
    if (dateCell) {
      const date = dateOf(dateCell, dayFirst)
      if (typeof date !== 'string') return fail(date.reason)
      when = { date }
    } else if (weekCell) {
      const week = Number(weekCell)
      if (!Number.isInteger(week) || week < 1 || week > MAX_IMPORT_WEEKS) return fail(`the week "${weekCell}" isn't a number from 1 to ${MAX_IMPORT_WEEKS}.`)
      const weekday = dayCell ? dayOf(dayCell) : null
      if (dayCell && weekday === null) return fail(`the day "${dayCell}" isn't Mon to Sun, or 1 to 7.`)
      when = { week, ...(weekday !== null ? { weekday } : {}) }
    }
    const notes = cell(row, 'notes')
    items.push({ where: `${where} · ${whereOf(when)}`, ...when, sport, name: name.slice(0, 80), steps: templateSteps(cell(row, 'steps')), ...(notes ? { notes } : {}) })
  })
  return { doc: { items, skipped: [] }, problems }
}
