// A plan document read into sessions, before CrankHog checks them: from the
// AI (one ImportDoc per part, merged) or from the CSV template. Sessions are
// dated by the document, or by week and weekday counted from the plan's
// first Monday, which the rider can move in the review.
import type { PlanImportOutput } from '../ai/schemas'
import { isRealDay, nextMonday, weekdayOf } from '../workout/plan'
import { addDays, type DateKey } from '../workout/schedule'

export type ImportSport = 'bike' | 'run' | 'swim' | 'other'
export type ImportEffort = 'easy' | 'moderate' | 'hard' | 'max'

export interface ImportItem {
  /** Where it is in the document, for the review: "Week 3, Tue", "Row 7". */
  where: string
  date?: DateKey
  /** The plan's week, 1 = its first (after mergeDocs; before it, the document's own number). */
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
  /** One part's word on its weeks counting down to the race; mergeDocs turns them round. */
  countdown?: boolean
  items: ImportItem[]
  /** What the reader left out, and why. */
  skipped: { text: string; reason: string }[]
}

/** The most weeks a document's week numbers may run to. */
export const MAX_IMPORT_WEEKS = 104

export const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

const SPORTS: Record<string, ImportSport> = {
  bike: 'bike',
  ride: 'bike',
  cycling: 'bike',
  run: 'run',
  running: 'run',
  swim: 'swim',
  swimming: 'swim',
  other: 'other',
}

/** A sport as a document or the AI writes it ("Cycling", "run"), or null. */
export function sportFrom(s: string): ImportSport | null {
  return SPORTS[s.trim().toLowerCase()] ?? null
}

const EFFORTS: readonly string[] = ['easy', 'moderate', 'hard', 'max'] satisfies ImportEffort[]

/** Most sessions one part may hold: a part is at most 12,000 characters, so more is a runaway answer. */
export const MAX_PART_ITEMS = 400
const MAX_PART_SKIPPED = 100

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

/**
 * One part's AI output as an ImportDoc, each session checked on its own so
 * one odd value never costs the others: a date that isn't a real day, a week
 * or weekday out of range, are dropped and the session kept; a sport CrankHog
 * doesn't have is other. Weeks keep the document's numbers (0, or counting
 * down) until mergeDocs has every part.
 */
export function fromAiOutput(out: PlanImportOutput): ImportDoc {
  const whole = (n: number | null, lo: number, hi: number) => (n !== null && Number.isInteger(n) && n >= lo && n <= hi ? n : undefined)
  const items = out.items.slice(0, MAX_PART_ITEMS).map((i): ImportItem => {
    const date = isRealDay(i.date?.trim()) ? i.date!.trim() : undefined
    const week = date ? undefined : whole(i.week, -MAX_IMPORT_WEEKS, MAX_IMPORT_WEEKS)
    const weekday = week !== undefined ? whole(i.weekday, 0, 6) : undefined
    const minutes = i.minutes !== null && i.minutes > 0 ? Math.round(i.minutes) : undefined
    const effort = i.effort?.trim().toLowerCase()
    const at = { ...(date ? { date } : {}), ...(week !== undefined ? { week } : {}), ...(weekday !== undefined ? { weekday } : {}) }
    return {
      where: whereOf(at),
      ...at,
      // the prompt's catch-all for strength, yoga, rowing…
      sport: sportFrom(i.sport) ?? 'other',
      name: i.name.trim().slice(0, 80),
      steps: i.steps.trim(),
      ...(minutes ? { minutes } : {}),
      ...(effort && EFFORTS.includes(effort) ? { effort: effort as ImportEffort } : {}),
      ...(text(i.notes) ? { notes: text(i.notes)!.slice(0, 600) } : {}),
    }
  })
  const over = out.items.length - items.length
  const raceDate = text(out.raceDate)
  const startDate = text(out.startDate)
  return {
    ...(text(out.planName) ? { name: text(out.planName)!.slice(0, 80) } : {}),
    ...(isRealDay(raceDate) ? { race: { name: text(out.raceName)?.slice(0, 80) ?? 'Race', date: raceDate } } : {}),
    ...(isRealDay(startDate) ? { startDate } : {}),
    ...(out.countdown !== null ? { countdown: out.countdown } : {}),
    items,
    skipped: [
      ...out.skipped
        .slice(0, MAX_PART_SKIPPED)
        .map((s) => ({ text: s.text.trim().slice(0, 300), reason: s.reason.trim().slice(0, 300) }))
        .filter((s) => s.text !== ''),
      ...(over > 0 ? [{ text: `${over} more session${over === 1 ? '' : 's'} in one part`, reason: `A part holds at most ${MAX_PART_ITEMS} sessions, so the AI's answer ran away. Split the document and import it again.` }] : []),
    ],
  }
}

const itemKey = (i: ImportItem) => JSON.stringify([i.date, i.week, i.weekday, i.sport, i.name, i.steps])
const squash = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()

/**
 * The parts as one document: the first name, race and start any part gives,
 * and every session in order. A session repeated within a part ("3 × easy
 * run", an AM/PM double) is the plan's, and stays. Each later part is sent
 * the document's start as `context`, so it may read a session from it again:
 * a session the first part has, named in that start, is dropped from a later
 * part as many times as the first part has it, and no more.
 *
 * Weeks become the plan's, 1 = its first: a document numbered from 0 moves
 * up a week, and one that counts down to the race (as most parts say) is
 * turned round, so its highest number is week 1.
 */
export function mergeDocs(parts: readonly ImportDoc[], context = ''): ImportDoc {
  const start = squash(context)
  const first = parts[0]?.items ?? []
  const inFirst = new Map<string, number>()
  for (const i of first) inFirst.set(itemKey(i), (inFirst.get(itemKey(i)) ?? 0) + 1)
  const read = [...first]
  for (const p of parts.slice(1)) {
    const left = new Map(inFirst)
    for (const i of p.items) {
      const key = itemKey(i)
      const n = left.get(key) ?? 0
      if (n > 0 && i.name !== '' && start.includes(squash(i.name))) left.set(key, n - 1)
      else read.push(i)
    }
  }
  const down = parts.filter((p) => p.countdown === true).length > parts.filter((p) => p.countdown === false).length
  const weeks = read.flatMap((i) => (i.week !== undefined ? [i.week] : []))
  const lo = Math.min(...weeks)
  const hi = Math.max(...weeks)
  const planWeek = (w: number) => (down ? hi - w + 1 : lo < 1 ? w + 1 - lo : w)
  const items = read.map((i) => {
    if (i.week === undefined) return i
    const week = planWeek(i.week)
    if (week <= MAX_IMPORT_WEEKS) return { ...i, week }
    const { week: _w, weekday: _d, ...rest } = i
    return rest
  })
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
