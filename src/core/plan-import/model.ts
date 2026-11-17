// A plan document read into sessions, before CrankHog checks them: from the
// AI (one ImportDoc per part, merged) or from the CSV template. Sessions are
// dated by the document, or by week and weekday counted from the plan's
// first Monday, which the rider can move in the review.
import type { PlanImportOutput } from '../ai/schemas'
import { nextMonday, weekdayOf } from '../workout/plan'
import { addDays, dateKey, dateKeyToMs, isDateKey, type DateKey } from '../workout/schedule'

export type ImportSport = 'bike' | 'run' | 'swim' | 'other'
export type ImportEffort = 'easy' | 'moderate' | 'hard' | 'max'

export interface ImportItem {
  /** Where it is in the document, for the review: "Week 3, Tue", "Row 7". */
  where: string
  date?: DateKey
  /** The document's week, 1 = its first. */
  week?: number
  /** 0 = Monday … 6 = Sunday. */
  weekday?: number
  sport: ImportSport
  name: string
  /** Bike: intervals.icu text. Run, swim, other: session steps (docs/WORKOUT-FORMAT.md). */
  steps: string
  /** A session with no steps: how long, and how hard. */
  minutes?: number
  effort?: ImportEffort
  notes?: string
}

export interface ImportDoc {
  name?: string
  race?: { name: string; date: DateKey }
  startDate?: DateKey
  items: ImportItem[]
  /** What the reader left out, and why. */
  skipped: { text: string; reason: string }[]
}

/** The most weeks a document's week numbers may run to. */
export const MAX_IMPORT_WEEKS = 104

export const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

/** A real calendar day as YYYY-MM-DD (not 2027-02-30). */
export function isRealDate(s: string | null | undefined): s is DateKey {
  return !!s && isDateKey(s) && dateKey(dateKeyToMs(s)) === s
}

/** The Monday of the day's week. */
export function mondayOf(day: DateKey): DateKey {
  return addDays(day, -weekdayOf(day))
}

/** Where a session sits in the document, for the review. */
export function whereOf(i: Pick<ImportItem, 'date' | 'week' | 'weekday'>): string {
  if (i.date) return i.date
  if (i.week !== undefined) return `Week ${i.week}${i.weekday !== undefined ? `, ${WEEKDAY_SHORT[i.weekday]}` : ''}`
  return 'No day given'
}

const text = (s: string | null | undefined) => {
  const t = s?.trim()
  return t ? t : undefined
}

/** One part's AI output as an ImportDoc: dates that aren't real days and weeks out of range are dropped, the session kept. */
export function fromAiOutput(out: PlanImportOutput): ImportDoc {
  const items = out.items.map((i): ImportItem => {
    const date = isRealDate(i.date?.trim()) ? i.date!.trim() : undefined
    const week = !date && i.week !== null && i.week >= 1 && i.week <= MAX_IMPORT_WEEKS ? i.week : undefined
    const weekday = week !== undefined && i.weekday !== null ? i.weekday : undefined
    const minutes = i.minutes !== null && i.minutes > 0 ? Math.round(i.minutes) : undefined
    const at = { ...(date ? { date } : {}), ...(week !== undefined ? { week } : {}), ...(weekday !== undefined ? { weekday } : {}) }
    return {
      where: whereOf(at),
      ...at,
      sport: i.sport,
      name: i.name.trim().slice(0, 80),
      steps: i.steps.trim(),
      ...(minutes ? { minutes } : {}),
      ...(i.effort ? { effort: i.effort } : {}),
      ...(text(i.notes) ? { notes: text(i.notes) } : {}),
    }
  })
  const raceDate = text(out.raceDate)
  const startDate = text(out.startDate)
  return {
    ...(text(out.planName) ? { name: text(out.planName)!.slice(0, 80) } : {}),
    ...(isRealDate(raceDate) ? { race: { name: text(out.raceName)?.slice(0, 80) ?? 'Race', date: raceDate } } : {}),
    ...(isRealDate(startDate) ? { startDate } : {}),
    items,
    skipped: out.skipped.map((s) => ({ text: s.text.trim(), reason: s.reason.trim() })).filter((s) => s.text !== ''),
  }
}

const itemKey = (i: ImportItem) => JSON.stringify([i.date, i.week, i.weekday, i.sport, i.name, i.steps])

/** The parts as one document: the first name, race and start any part gives, every session once, in order. */
export function mergeDocs(parts: readonly ImportDoc[]): ImportDoc {
  const seen = new Set<string>()
  const items: ImportItem[] = []
  for (const i of parts.flatMap((p) => p.items)) {
    // a part may read a session again from the context it was given
    const key = itemKey(i)
    if (seen.has(key)) continue
    seen.add(key)
    items.push(i)
  }
  const name = parts.find((p) => p.name)?.name
  const race = parts.find((p) => p.race)?.race
  const startDate = parts.find((p) => p.startDate)?.startDate
  return { ...(name ? { name } : {}), ...(race ? { race } : {}), ...(startDate ? { startDate } : {}), items, skipped: parts.flatMap((p) => p.skipped) }
}

/**
 * The plan's first Monday, before the rider changes it: the Monday of the
 * document's start, or for a week-numbered plan to a race, the Monday that
 * makes its last week the race's week, or else next Monday.
 */
export function defaultStart(doc: Pick<ImportDoc, 'startDate' | 'race' | 'items'>, raceDate: DateKey | undefined, now = Date.now()): DateKey {
  if (doc.startDate) return mondayOf(doc.startDate)
  const lastWeek = Math.max(0, ...doc.items.map((i) => (i.date ? 0 : (i.week ?? 0))))
  if (raceDate && lastWeek > 0) return addDays(mondayOf(raceDate), -7 * (lastWeek - 1))
  return nextMonday(now)
}

/** Weekdays for sessions a week gives no day: spread over the week as a coach would, by how many there are. */
const SPREAD: Record<number, readonly number[]> = { 1: [5], 2: [1, 5], 3: [1, 3, 5], 4: [1, 3, 5, 6], 5: [0, 1, 3, 5, 6], 6: [0, 1, 2, 3, 5, 6], 7: [0, 1, 2, 3, 4, 5, 6] }

/**
 * Each session's day: its own date, or its week and weekday counted from
 * `start` (a Monday). Sessions with a week but no weekday are spread over
 * their week; ones with neither stay undated, for the plan's ride days.
 */
export function placeItems(items: readonly ImportItem[], start: DateKey): (DateKey | undefined)[] {
  const dayless = new Map<number, number[]>()
  items.forEach((i, at) => {
    if (!i.date && i.week !== undefined && i.weekday === undefined) dayless.set(i.week, [...(dayless.get(i.week) ?? []), at])
  })
  const spread = new Map<number, number>()
  for (const ats of dayless.values()) ats.forEach((at, k) => spread.set(at, SPREAD[Math.min(ats.length, 7)]![k % 7]!))
  return items.map((i, at) => {
    if (i.date) return i.date
    if (i.week === undefined) return undefined
    return addDays(start, 7 * (i.week - 1) + (i.weekday ?? spread.get(at) ?? 0))
  })
}
