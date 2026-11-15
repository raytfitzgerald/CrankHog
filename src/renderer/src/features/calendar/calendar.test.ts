import { describe, expect, it } from 'vitest'
import type { RideSummary } from '@core/ride/types'
import type { ScheduledWorkout } from '@core/workout/schedule'
import type { DayMark } from '@core/workout/plan'
import type { OtherActivity } from '../../db/db'
import { calendarMonth, loadBand, shiftMonth } from './calendar'

const ride = (id: string, startedAt: number, tss: number, movingS = 3600) => ({ id, startedAt, tss, movingS, name: id }) as unknown as RideSummary

describe('calendarMonth', () => {
  it('lays out September 2026 Monday to Sunday, with the edges from the months around it', () => {
    const m = calendarMonth(2026, 8, { rides: [], now: new Date(2026, 8, 30, 12).getTime() })
    // 1 Sep 2026 is a Tuesday, so the grid starts on Monday 31 Aug
    expect(m.weeks[0]!.days[0]).toMatchObject({ day: 31, inMonth: false })
    expect(m.weeks[0]!.days[1]).toMatchObject({ day: 1, inMonth: true })
    expect(m.weeks).toHaveLength(5)
    expect(m.weeks.flatMap((w) => w.days).find((d) => d.isToday)?.day).toBe(30)
  })

  it('puts rides on their local day, and totals the weeks and the month', () => {
    const rides = [ride('a', new Date(2026, 8, 2, 7).getTime(), 60), ride('b', new Date(2026, 8, 2, 18).getTime(), 40), ride('c', new Date(2026, 7, 31, 9).getTime(), 80)]
    const m = calendarMonth(2026, 8, { rides })
    const sep2 = m.weeks[0]!.days[2]!
    expect(sep2.rides.map((r) => r.id)).toEqual(['a', 'b'])
    expect(sep2.tss).toBe(100)
    expect(m.weeks[0]).toMatchObject({ rides: 3, tss: 180 })
    // 31 Aug shows in the grid but not in September's totals
    expect(m).toMatchObject({ rides: 2, tss: 100, movingS: 7200 })
  })

  it('shows a simulated ride on its day but leaves it out of the totals', () => {
    const sim = { ...ride('sim', new Date(2026, 8, 3, 7).getTime(), 90), simulated: true } as RideSummary
    const m = calendarMonth(2026, 8, { rides: [ride('a', new Date(2026, 8, 2, 7).getTime(), 60), sim] })
    expect(m.weeks[0]!.days[3]!.rides.map((r) => r.id)).toEqual(['sim'])
    expect(m).toMatchObject({ rides: 1, tss: 60, movingS: 3600 })
    expect(m.weeks[0]).toMatchObject({ rides: 1, tss: 60 })
  })

  it('bands the load and steps months over year ends', () => {
    expect([0, 20, 70, 150].map(loadBand)).toEqual([0, 1, 2, 3])
    expect(shiftMonth(2026, 0, -1)).toEqual([2025, 11])
    expect(shiftMonth(2026, 11, 1)).toEqual([2027, 0])
  })
})

describe('calendarMonth with a schedule', () => {
  const planned = (id: string, date: string, workoutId: string): ScheduledWorkout => ({ id, date, workoutId, workout: null, name: id, source: 'manual', createdAt: 0 })
  const workoutRide = (id: string, startedAt: number, workoutId: string) => ({ ...ride(id, startedAt, 50), workoutId, simulated: false }) as unknown as RideSummary

  it('puts planned workouts on their day, with whether they are coming, today, missed or done', () => {
    const schedule = [planned('past', '2026-09-08', 'w1'), planned('ridden', '2026-09-09', 'w2'), planned('today', '2026-09-10', 'w3'), planned('next', '2026-09-12', 'w4')]
    const rides = [workoutRide('r', new Date(2026, 8, 9, 18).getTime(), 'w2')]
    const m = calendarMonth(2026, 8, { rides, now: new Date(2026, 8, 10, 12).getTime(), schedule })
    const day = (n: number) => m.weeks.flatMap((w) => w.days).find((d) => d.inMonth && d.day === n)!
    expect(day(8).planned.map((p) => [p.entry.id, p.status])).toEqual([['past', 'missed']])
    expect(day(10).planned.map((p) => p.status)).toEqual(['today'])
    expect(day(12).planned.map((p) => p.status)).toEqual(['planned'])
    // a done workout shows as its ride, marked as the one planned
    expect(day(9).planned).toEqual([])
    expect(day(9).plannedRideIds).toEqual(['r'])
    expect(m.planned).toBe(4)
  })
})

describe('calendarMonth: the days around today', () => {
  it('marks the days before today as past, and today as today', () => {
    const m = calendarMonth(2026, 8, { rides: [], now: new Date(2026, 8, 10, 9).getTime() })
    const days = m.weeks.flatMap((w) => w.days).filter((d) => d.inMonth)
    expect(days.filter((d) => d.isPast).map((d) => d.day)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
    expect(days.find((d) => d.isToday)?.day).toBe(10)
    expect(days.find((d) => d.isToday)?.isPast).toBe(false)
  })

  it('gives each week its first and last day, for its volume', () => {
    const m = calendarMonth(2026, 8, { rides: [] })
    expect([m.weeks[0]!.startKey, m.weeks[0]!.endKey]).toEqual(['2026-08-31', '2026-09-06'])
    expect(m.weeks.at(-1)!.endKey).toBe('2026-10-04')
  })
})

describe('calendarMonth: other sports and day marks', () => {
  const run = (id: string, startedAt: number): OtherActivity => ({ id, startedAt, sport: 'running', subSport: null, name: id, movingS: 1800, distanceM: 5000, avgHr: 150, maxHr: 170, hrLoad: 40, trainingEffect: null, garminLoad: null, device: null, fileName: `${id}.fit` })

  it('puts runs, swims and strength sessions on their local day', () => {
    const m = calendarMonth(2026, 8, { rides: [], activities: [run('a', new Date(2026, 8, 3, 7).getTime()), run('b', new Date(2026, 8, 3, 19).getTime())] })
    const sep3 = m.weeks.flatMap((w) => w.days).find((d) => d.inMonth && d.day === 3)!
    expect(sep3.activities.map((a) => a.id)).toEqual(['a', 'b'])
  })

  it('puts events and days off on their day', () => {
    const marks: DayMark[] = [{ id: 'e', date: '2026-09-20', kind: 'event', name: 'Gran fondo', priority: 'A' }, { id: 't', date: '2026-09-21', kind: 'travel' }]
    const m = calendarMonth(2026, 8, { rides: [], marks })
    const day = (n: number) => m.weeks.flatMap((w) => w.days).find((d) => d.inMonth && d.day === n)!
    expect(day(20).marks.map((x) => x.name)).toEqual(['Gran fondo'])
    expect(day(21).marks.map((x) => x.kind)).toEqual(['travel'])
  })
})
