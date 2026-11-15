// The month grid for the Calendar: weeks Monday to Sunday covering the whole
// month, each day with its rides, other sports, planned workouts and marks
// (events and days off), and each week with its totals. Local calendar days
// throughout, so a clock change never moves anything.
import type { RideSummary } from '@core/ride/types'
import type { DayMark } from '@core/workout/plan'
import { completions, dateKey, scheduleStatus, type DateKey, type ScheduleStatus, type ScheduledWorkout } from '@core/workout/schedule'
import type { OtherActivity } from '../../db/db'

/** A planned workout on the calendar. Done ones show as their ride instead (see plannedRideIds). */
export interface PlannedOnDay {
  entry: ScheduledWorkout
  status: Exclude<ScheduleStatus, 'done'>
}

export interface CalendarDay {
  /** Local midnight, epoch ms. */
  date: number
  key: DateKey
  day: number
  inMonth: boolean
  isToday: boolean
  isPast: boolean
  rides: RideSummary[]
  /** Runs, swims and strength sessions from FIT files. */
  activities: OtherActivity[]
  tss: number
  planned: PlannedOnDay[]
  /** Rides that completed a planned workout. */
  plannedRideIds: string[]
  marks: DayMark[]
}

export interface CalendarWeek {
  days: CalendarDay[]
  startKey: DateKey
  endKey: DateKey
  /** Totals of real rides: simulated ones show on their day but don't count. */
  rides: number
  movingS: number
  tss: number
}

export interface CalendarMonth {
  year: number
  /** 0-11. */
  month: number
  weeks: CalendarWeek[]
  rides: number
  movingS: number
  tss: number
  /** Workouts planned in the month, done or not. */
  planned: number
}

export interface CalendarInput {
  rides: readonly RideSummary[]
  schedule?: readonly ScheduledWorkout[]
  activities?: readonly OtherActivity[]
  marks?: readonly DayMark[]
  now?: number
}

function groupBy<T>(items: readonly T[], key: (t: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>()
  for (const it of items) {
    const k = key(it)
    const list = m.get(k)
    if (list) list.push(it)
    else m.set(k, [it])
  }
  return m
}

/** The grid for one month. */
export function calendarMonth(year: number, month: number, input: CalendarInput): CalendarMonth {
  const { rides, schedule = [], activities = [], marks = [], now = Date.now() } = input
  const first = new Date(year, month, 1)
  const lead = (first.getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const weeksCount = Math.ceil((lead + daysInMonth) / 7)
  const ridesByDay = groupBy(rides, (r) => dateKey(r.startedAt))
  const activitiesByDay = groupBy(activities, (a) => dateKey(a.startedAt))
  const marksByDay = groupBy(marks, (m) => m.date)
  const today = dateKey(now)
  const done = completions(
    schedule,
    rides.map((r) => ({ id: r.id, startedAt: r.startedAt, workoutId: r.workoutId, simulated: r.simulated })),
  )
  const doneRides = new Set(done.values())
  const plannedByDay = groupBy(
    schedule.filter((e) => !done.has(e.id)).map((entry) => ({ entry, status: scheduleStatus(entry, false, today) as PlannedOnDay['status'] })),
    (p) => p.entry.date,
  )
  let planned = 0
  const weeks: CalendarWeek[] = []
  let total = { rides: 0, movingS: 0, tss: 0 }
  for (let w = 0; w < weeksCount; w++) {
    const days: CalendarDay[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(year, month, 1 - lead + w * 7 + i)
      const key = dateKey(d.getTime())
      const list = (ridesByDay.get(key) ?? []).slice().sort((a, b) => a.startedAt - b.startedAt)
      const onDay = plannedByDay.get(key) ?? []
      const plannedRideIds = list.filter((r) => doneRides.has(r.id)).map((r) => r.id)
      const inMonth = d.getMonth() === month
      if (inMonth) planned += onDay.length + plannedRideIds.length
      days.push({
        date: d.getTime(),
        key,
        day: d.getDate(),
        inMonth,
        isToday: key === today,
        isPast: key < today,
        rides: list,
        activities: (activitiesByDay.get(key) ?? []).slice().sort((a, b) => a.startedAt - b.startedAt),
        tss: list.reduce((s, r) => s + (r.tss ?? 0), 0),
        planned: onDay,
        plannedRideIds,
        marks: marksByDay.get(key) ?? [],
      })
    }
    // totals count real riding only, as the volume beside them does
    const inWeek = days.flatMap((d) => d.rides).filter((r) => !r.simulated)
    weeks.push({
      days,
      startKey: days[0]!.key,
      endKey: days[6]!.key,
      rides: inWeek.length,
      movingS: inWeek.reduce((s, r) => s + r.movingS, 0),
      tss: inWeek.reduce((s, r) => s + (r.tss ?? 0), 0),
    })
    const inMonth = days.filter((d) => d.inMonth).flatMap((d) => d.rides).filter((r) => !r.simulated)
    total = { rides: total.rides + inMonth.length, movingS: total.movingS + inMonth.reduce((s, r) => s + r.movingS, 0), tss: total.tss + inMonth.reduce((s, r) => s + (r.tss ?? 0), 0) }
  }
  return { year, month, weeks, ...total, planned }
}

export const MARK_NAME: Record<DayMark['kind'], string> = { event: 'Event', rest: 'Rest day', sick: 'Sick', travel: 'Travel' }

/** How strongly to shade a day: 0 (no load) to 3 (a big day), by TSS. */
export function loadBand(tss: number): 0 | 1 | 2 | 3 {
  if (tss <= 0) return 0
  if (tss < 50) return 1
  if (tss < 100) return 2
  return 3
}

/** The month before or after, as [year, month]. */
export function shiftMonth(year: number, month: number, by: number): [number, number] {
  const d = new Date(year, month + by, 1)
  return [d.getFullYear(), d.getMonth()]
}
