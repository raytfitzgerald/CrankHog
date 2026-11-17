// Training plans: a named, ordered list of workouts plus the weekdays the
// rider rides and a start date. Laying a plan out turns it into calendar days:
// workouts with a date of their own (from a "YYYY-MM-DD_" file name, the plan
// builder, or a move on the calendar) keep it, and the rest fill the ride days
// in order. Days off and the event apply to both.
import { addDays, dateKey, dateKeyToMs, isDateKey, type DateKey } from './schedule'

export interface PlanItem {
  /** Stable within the plan, so its calendar entry can be found again after a reorder. */
  id: string
  /** A bike workout in the library, or, when `sport` is set, a run, swim or other session (src/core/multisport). */
  workoutId: string
  /** Set for a session that isn't a bike workout: it takes a plan day like a ride does, and is done by an activity of its sport. */
  sport?: 'run' | 'swim' | 'other'
  /** A fixed day, from a date-prefixed file name or the plan builder. Otherwise the plan's ride days decide. */
  date?: DateKey
  /** The rider moved it on the calendar: this day wins over the plan's. */
  movedTo?: DateKey
  /** The rider removed it from the calendar: it stays in the plan, off the calendar. */
  removed?: true
}

export type PlanGoal = 'ftp' | 'endurance' | 'event'
export type EventFocus = 'general' | 'climbing' | 'time-trial' | 'criterium'

/** The answers to "Build a plan for me". */
export interface PlanSurvey {
  hoursPerWeek: number
  /** Weekdays the rider can ride, 0 = Monday … 6 = Sunday. */
  rideDays: number[]
  /** The weekday for the long ride, if any. */
  longDay: number | null
  goal: PlanGoal
  focus: EventFocus
  startDate: DateKey
}

export interface TrainingPlan {
  id: string
  name: string
  description?: string
  items: PlanItem[]
  /** 0 = Monday … 6 = Sunday. */
  rideDays: number[]
  startDate: DateKey
  /** Laid out on the calendar; edits re-lay it. */
  onCalendar: boolean
  /** The event the plan builds to (a calendar day). */
  eventId?: string
  /**
   * What fixes the plan's dates: its start (the default), or its race, the
   * event, when it counts back so its last workout is the ride day before
   * (raceStart). A race-dated plan keeps startDate up to date with the race.
   */
  anchor?: 'start' | 'race'
  survey?: PlanSurvey
  source: 'files' | 'ai' | 'builtin' | 'manual'
  createdAt: number
  updatedAt: number
}

/** An event, or a day off, on the calendar. Plans skip rest, sick and travel days. */
export interface DayMark {
  id: string
  date: DateKey
  kind: 'event' | 'rest' | 'sick' | 'travel'
  /** Events: "Gran fondo". */
  name?: string
  /** Events: A is the one the plan builds to. */
  priority?: 'A' | 'B' | 'C'
  note?: string
}

export const isBlocking = (m: Pick<DayMark, 'kind'>): boolean => m.kind !== 'event'

export interface LayoutInput {
  items: readonly Pick<PlanItem, 'workoutId' | 'date' | 'movedTo' | 'removed'>[]
  rideDays: readonly number[]
  startDate: DateKey
  today: DateKey
  /** Rest, sick and travel days: no workout goes there. */
  blocked?: ReadonlySet<DateKey>
  /** The event day: the plan's workouts stop the day before it. */
  endDate?: DateKey
}

export interface Placement {
  date: DateKey
  workoutId: string
  /** The item's place in the plan. */
  index: number
}

export type PlanWarning =
  | { kind: 'no-ride-days' }
  | { kind: 'past-event'; count: number }
  | { kind: 'days-off'; count: number }
  | { kind: 'before-today'; count: number }

export interface Layout {
  placements: Placement[]
  /** Items that found no day (no ride days, the event came first, or a day off had no free ride day after it). Removed ones are not here. */
  unplaced: number[]
  warnings: PlanWarning[]
}

/** A plan never runs longer than this, so a bad input can't loop for ever. */
const MAX_PLAN_DAYS = 3 * 366
/** How far after a day off a workout on it may move. */
const DAY_OFF_REACH = 7

/** 0 = Monday … 6 = Sunday. */
export function weekdayOf(key: DateKey): number {
  return (new Date(dateKeyToMs(key)).getDay() + 6) % 7
}

/** The next Monday after today (or today, on a Monday): where a new plan starts. */
export function nextMonday(now = Date.now()): DateKey {
  const today = dateKey(now)
  return addDays(today, (7 - weekdayOf(today)) % 7)
}

/**
 * The latest start that still fits every workout without a day of its own on
 * the ride days before `endDate` (the race), around the plan's dated workouts
 * and days off: where layOutPlan, started there, ends the day before the race.
 * Null when there are no ride days to count back over, or nothing to place
 * (then the earliest dated workout, if any, is the start).
 */
export function raceStart(input: Pick<LayoutInput, 'items' | 'rideDays' | 'blocked'> & { endDate: DateKey }): DateKey | null {
  const blocked = input.blocked ?? new Set<DateKey>()
  const rideDays = new Set(input.rideDays)
  // the days layOutPlan keeps for dated workouts, which undated ones go around
  const fixed = new Set(input.items.filter((i) => i.date && !i.removed && i.movedTo === undefined && i.date < input.endDate && !blocked.has(i.date)).map((i) => i.date!))
  // every undated workout takes a turn, moved or removed ones too, as in layOutPlan
  const turns = input.items.filter((i) => !i.date).length
  if (turns === 0) return [...fixed].sort()[0] ?? null
  if (rideDays.size === 0) return null
  let found = 0
  for (let n = 1, day = addDays(input.endDate, -1); n <= MAX_PLAN_DAYS; n++, day = addDays(day, -1)) {
    if (!rideDays.has(weekdayOf(day)) || fixed.has(day) || blocked.has(day)) continue
    if (++found === turns) return day
  }
  return null
}

/** Where a plan's layout starts: its start date, or for a race-dated plan with its race on the calendar, counted back from the race. */
export function layoutStart(plan: Pick<LayoutInput, 'items' | 'rideDays' | 'startDate'> & Pick<TrainingPlan, 'anchor'>, raceDate: DateKey | undefined, blocked?: ReadonlySet<DateKey>): DateKey {
  if (plan.anchor !== 'race' || !raceDate) return plan.startDate
  return raceStart({ items: plan.items, rideDays: plan.rideDays, blocked, endDate: raceDate }) ?? plan.startDate
}

/**
 * Where each of the plan's workouts goes:
 * - one with a day of its own keeps it, unless that day is on or after the
 *   event (then it is left out; a day the rider moved it to always counts);
 * - the rest fill the ride days in order, around the dated ones. One the rider
 *   moved or removed on the calendar keeps its turn, so the others stay put;
 * - a workout that lands on a day off moves to the next free ride day within
 *   a week, or is left out.
 */
export function layOutPlan(input: LayoutInput): Layout {
  const blocked = input.blocked ?? new Set<DateKey>()
  const rideDays = new Set(input.rideDays)
  const afterEvent = (day: DateKey) => !!input.endDate && day >= input.endDate
  const placements: Placement[] = []
  const unplaced: number[] = []
  const warnings: PlanWarning[] = []
  let pastEvent = 0
  let offDays = 0
  const place = (date: DateKey, index: number) => placements.push({ date, workoutId: input.items[index]!.workoutId, index })

  const fixedDays = new Set<DateKey>()
  const displaced: { date: DateKey; index: number; moved: boolean }[] = []
  input.items.forEach((item, index) => {
    const day = item.movedTo ?? item.date
    if (item.removed || !day) return
    const moved = item.movedTo !== undefined
    if (!moved && afterEvent(day)) {
      unplaced.push(index)
      pastEvent++
    } else if (blocked.has(day)) {
      displaced.push({ date: day, index, moved })
    } else {
      place(day, index)
      // undated workouts go around the plan's own dates, not around the rider's moves
      if (!moved) fixedDays.add(day)
    }
  })

  const turns = input.items.map((item, index) => ({ item, index })).filter(({ item }) => !item.date)
  const waiting = (t: (typeof turns)[number]) => !t.item.movedTo && !t.item.removed
  if (turns.some(waiting) && rideDays.size === 0) {
    warnings.push({ kind: 'no-ride-days' })
    unplaced.push(...turns.filter(waiting).map(({ index }) => index))
  } else if (turns.some(waiting)) {
    let day = input.startDate
    let next = 0
    for (let n = 0; n < MAX_PLAN_DAYS && next < turns.length; n++, day = addDays(day, 1)) {
      if (afterEvent(day)) break
      if (!rideDays.has(weekdayOf(day)) || fixedDays.has(day) || blocked.has(day)) continue
      const turn = turns[next++]!
      if (waiting(turn)) place(day, turn.index)
    }
    const left = turns.slice(next).filter(waiting)
    unplaced.push(...left.map(({ index }) => index))
    pastEvent += left.length
  }

  // last, so they take only days nothing else wanted
  const used = new Set(placements.map((p) => p.date))
  displaced.sort((a, b) => a.date.localeCompare(b.date) || a.index - b.index)
  for (const d of displaced) {
    let to: DateKey | null = null
    for (let k = 1; k <= DAY_OFF_REACH && !to; k++) {
      const day = addDays(d.date, k)
      if (!d.moved && afterEvent(day)) break
      if (blocked.has(day) || used.has(day) || (rideDays.size > 0 && !rideDays.has(weekdayOf(day)))) continue
      to = day
    }
    if (to) {
      place(to, d.index)
      used.add(to)
    } else {
      unplaced.push(d.index)
      offDays++
    }
  }

  if (pastEvent > 0) warnings.push({ kind: 'past-event', count: pastEvent })
  if (offDays > 0) warnings.push({ kind: 'days-off', count: offDays })
  placements.sort((a, b) => a.date.localeCompare(b.date) || a.index - b.index)
  const early = placements.filter((p) => p.date < input.today).length
  if (early > 0) warnings.push({ kind: 'before-today', count: early })
  return { placements, unplaced: unplaced.sort((a, b) => a - b), warnings }
}

const DATED = /^(\d{4}-\d{2}-\d{2})_(.+)$/

/**
 * "2026-11-18_Threshold 2x20.zwo" → { date: "2026-11-18", rest: "Threshold 2x20" }.
 * The extension always goes; the date only when it is a real day.
 */
export function parseDatedFileName(fileName: string): { date: DateKey | null; rest: string } {
  const base = fileName.replace(/\.[^.]+$/, '')
  const m = DATED.exec(base)
  if (!m || !isRealDay(m[1]!)) return { date: null, rest: base }
  return { date: m[1]!, rest: m[2]! }
}

/** A real calendar day as YYYY-MM-DD (not 2027-02-30). */
export function isRealDay(key: string | null | undefined): key is DateKey {
  if (!key || !isDateKey(key)) return false
  const [y, mo, d] = key.split('-').map(Number) as [number, number, number]
  const date = new Date(y, mo - 1, d)
  return date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d
}

/** A run, swim or other session rather than a bike workout. */
export const isSessionItem = (i: Pick<PlanItem, 'sport'>): boolean => i.sport !== undefined
