// Workouts scheduled on calendar days: what is planned, what was ridden, and
// what was missed. A scheduled workout is done when a real (not simulated)
// ride of that workout starts on its day; nothing has to be ticked off.
//
// Days are local calendar dates ("2026-11-14"), never instants, so a plan
// stays on its day across clock changes and when travelling.
import type { Workout } from './model'
import { parseIntervalsText } from './io/intervals-text'
import { parseZwo } from './io/zwo'

/** A local calendar day, "YYYY-MM-DD". */
export type DateKey = string

export interface ScheduledWorkout {
  id: string
  date: DateKey
  /** A workout in the library (built-in or the rider's own)… */
  workoutId: string | null
  /** …or the workout itself, for one imported from a calendar elsewhere. */
  workout: Workout | null
  /** Shown on the calendar, so it reads right even if the library workout is renamed or deleted. */
  name: string
  source: 'manual' | 'intervals'
  /** The intervals.icu event id, for workouts imported from there. */
  externalId?: string
  /** The training plan that put it here, and which of its items. */
  planId?: string
  planItemId?: string
  createdAt: number
}

export type ScheduleStatus = 'planned' | 'today' | 'done' | 'missed'

/** What scheduling needs to know about a recorded ride. */
export interface ScheduleRide {
  id: string
  startedAt: number
  workoutId?: string
  simulated: boolean
}

const pad = (n: number) => String(n).padStart(2, '0')
const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/

/** The local calendar day of an instant. */
export function dateKey(ms: number): DateKey {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Local midnight at the start of a day. */
export function dateKeyToMs(key: DateKey): number {
  const m = DATE_KEY.exec(key)
  if (!m) throw new Error(`Not a date: ${key}`)
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime()
}

export function isDateKey(s: string): s is DateKey {
  return DATE_KEY.test(s)
}

/** The day `n` days after `key` (before, for negative n). */
export function addDays(key: DateKey, n: number): DateKey {
  const d = new Date(dateKeyToMs(key))
  d.setDate(d.getDate() + n)
  return dateKey(d.getTime())
}

/** The workout an entry plays: its library id, or the id of the workout it carries. */
export const plannedWorkoutId = (e: ScheduledWorkout): string | null => e.workoutId ?? e.workout?.id ?? null

/**
 * Which ride completed each scheduled workout: a real ride of the same
 * workout on the same day. One ride completes one entry, earliest planned first.
 */
export function completions(entries: readonly ScheduledWorkout[], rides: readonly ScheduleRide[]): Map<string, string> {
  const byDayAndWorkout = new Map<string, ScheduleRide[]>()
  for (const r of rides) {
    if (r.simulated || !r.workoutId) continue
    const k = `${dateKey(r.startedAt)}|${r.workoutId}`
    const list = byDayAndWorkout.get(k)
    if (list) list.push(r)
    else byDayAndWorkout.set(k, [r])
  }
  for (const list of byDayAndWorkout.values()) list.sort((a, b) => a.startedAt - b.startedAt)
  const done = new Map<string, string>()
  const ordered = [...entries].sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))
  for (const e of ordered) {
    const w = plannedWorkoutId(e)
    const ride = w ? byDayAndWorkout.get(`${e.date}|${w}`)?.shift() : undefined
    if (ride) done.set(e.id, ride.id)
  }
  return done
}

export function scheduleStatus(e: ScheduledWorkout, done: boolean, today: DateKey): ScheduleStatus {
  if (done) return 'done'
  if (e.date === today) return 'today'
  return e.date > today ? 'planned' : 'missed'
}

/** The first of today's workouts not ridden yet, or null. */
export function todaysWorkout(entries: readonly ScheduledWorkout[], rides: readonly ScheduleRide[], now: number): ScheduledWorkout | null {
  const today = dateKey(now)
  const done = completions(entries, rides)
  return (
    entries
      .filter((e) => e.date === today && !done.has(e.id))
      .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))[0] ?? null
  )
}

/** A planned workout from intervals.icu's calendar, as main passes it on. */
export interface IntervalsPlannedEvent {
  id: number | string
  /** "2026-11-18T00:00:00", local to the athlete. */
  start_date_local: string
  name?: string
  /** "Ride", "VirtualRide", "Run"… */
  type?: string
  /** The workout in intervals.icu's text format. */
  description?: string
  /** The workout as a Zwift file, when intervals.icu could make one. */
  zwo?: string | null
}

export type IntervalsImport = { kind: 'ok'; entry: ScheduledWorkout } | { kind: 'skip'; reason: 'not a ride' | 'no date' | 'no workout steps' }

const RIDE_TYPES = new Set(['Ride', 'VirtualRide'])

/**
 * One intervals.icu calendar event as a scheduled workout carrying its own
 * workout. The Zwift file is preferred (intervals.icu writes it from the
 * structured workout); the text description is the fallback.
 */
export function fromIntervalsEvent(ev: IntervalsPlannedEvent, now: number): IntervalsImport {
  if (ev.type && !RIDE_TYPES.has(ev.type)) return { kind: 'skip', reason: 'not a ride' }
  const date = ev.start_date_local.slice(0, 10)
  if (!isDateKey(date)) return { kind: 'skip', reason: 'no date' }
  const id = `intervals:${ev.id}`
  const name = ev.name?.trim() || 'intervals.icu workout'
  let workout: Workout | null = null
  if (ev.zwo) {
    try {
      workout = parseZwo(ev.zwo, { source: 'import', newId: () => id })
    } catch {
      workout = null
    }
  }
  if ((!workout || workout.segments.length === 0) && ev.description) {
    workout = parseIntervalsText(ev.description, { id, name, source: 'import' }).workout
  }
  if (!workout || workout.segments.length === 0) return { kind: 'skip', reason: 'no workout steps' }
  workout = { ...workout, id, name, source: 'import' }
  return { kind: 'ok', entry: { id, date, workoutId: null, workout, name, source: 'intervals', externalId: String(ev.id), createdAt: now } }
}
