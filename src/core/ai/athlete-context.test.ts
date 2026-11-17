import { describe, expect, it } from 'vitest'
import { normalizeRide } from '../ride/normalize'
import type { RideSummary } from '../ride/types'
import type { DayMark, TrainingPlan } from '../workout/plan'
import { dateKeyToMs, type ScheduledWorkout } from '../workout/schedule'
import { athleteContext, type AthleteContextInput, type AthleteContextJson, type ContextActivity, type ContextPlanned } from './athlete-context'

// Tuesday 17 November 2026, midday local time
const NOW = new Date(2026, 10, 17, 12).getTime()
const at = (key: string, hour = 9) => dateKeyToMs(key) + hour * 3_600_000

const ride = (id: string, key: string, extra: Partial<RideSummary> = {}): RideSummary =>
  normalizeRide({
    id,
    name: `Ride ${id}`,
    startedAt: at(key),
    movingS: 3600,
    distanceM: 30_000,
    tss: 60,
    np: 220,
    laps: Array.from({ length: 12 }, (_, i) => ({ index: i, startS: i * 300, durationS: 300, avgPower: 200 })),
    ...extra,
  } as unknown as RideSummary)

const entry = (id: string, date: string, extra: Partial<ScheduledWorkout> = {}): ScheduledWorkout => ({ id, date, workoutId: `w-${id}`, workout: null, name: `Workout ${id}`, source: 'manual', createdAt: 0, ...extra })

const activity = (id: string, key: string, extra: Partial<ContextActivity> = {}): ContextActivity => ({
  id,
  startedAt: at(key, 7),
  sport: 'running',
  subSport: null,
  name: `Run ${id}`,
  movingS: 1800,
  distanceM: 6000,
  avgHr: 150,
  maxHr: 170,
  hrLoad: 40,
  trainingEffect: null,
  ...extra,
})

const plan: TrainingPlan = {
  id: 'p1',
  name: 'Gran fondo build',
  description: 'Twelve weeks to the fondo.',
  items: [],
  rideDays: [1, 3, 5],
  startDate: '2026-11-02',
  onCalendar: true,
  eventId: 'race',
  source: 'files',
  createdAt: 0,
  updatedAt: 0,
}

const race: DayMark = { id: 'race', date: '2026-12-13', kind: 'event', name: 'Gran fondo', priority: 'A' }

function input(over: Partial<AthleteContextInput> = {}): AthleteContextInput {
  const schedule = [
    entry('a', '2026-11-03', { planId: 'p1', workoutId: 'w-done' }),
    entry('b', '2026-11-12', { planId: 'p1' }),
    entry('c', '2026-11-17', { planId: 'p1' }),
    entry('d', '2026-11-18', { planId: 'p1' }),
    entry('e', '2026-11-20', { sport: 'run', workoutId: null, name: 'Long run', session: { durationS: 5400, effort: 'easy', text: '- 90m Z2 HR' } }),
    entry('f', '2026-12-10', { planId: 'p1' }),
  ]
  const planned = new Map<string, ContextPlanned>(schedule.map((e) => [e.id, { durationS: 3600, load: 70, distanceM: null, steps: `- 10m ramp 50-75%\n- 40m 70%`, notes: `Notes for ${e.id}` }]))
  return {
    now: NOW,
    units: { distance: 'mi', weight: 'lb' },
    profile: { weightKg: 75, birthYear: 1980, lthr: 168, runThresholdPaceSPerKm: 270, swimCssSPer100m: 105 },
    ftpHistory: [
      { date: at('2026-09-01'), ftpW: 240, source: 'manual' },
      { date: at('2026-11-01'), ftpW: 255, source: 'test-ramp' },
    ],
    eftpW: 258,
    bestPower: { last90: [{ durationS: 300, watts: 320.4 }], last365: [{ durationS: 300, watts: 330 }] },
    weeks: [{ weekStart: at('2026-11-16', 0), tss: 120.4, hours: 2.04, rides: 1, others: 1 }],
    rides: [ride('done', '2026-11-03', { workoutId: 'w-done' }), ride('r2', '2026-11-15')],
    activities: [activity('run1', '2026-11-14'), activity('swim1', '2026-11-16', { sport: 'swimming', name: 'Pool', distanceM: 2000, movingS: 2400 })],
    loadHistory: [
      { date: '2026-11-03', tss: 60 },
      { date: '2026-11-15', tss: 60 },
    ],
    plans: [plan],
    schedule,
    planned,
    marks: [race, { id: 'sick', date: '2026-11-10', kind: 'sick', note: 'Head cold' }],
    workouts: [{ name: 'My threshold', sport: 'ride', durationS: 3600, load: 80, tags: ['threshold'], favorite: true }],
    ...over,
  }
}

const parse = (json: string) => JSON.parse(json) as AthleteContextJson

describe('athleteContext', () => {
  it('dates everything with its weekday, and says what the rider reads units in', () => {
    const c = parse(athleteContext(input()))
    expect(c.today).toBe('2026-11-17 Tue')
    expect(c.riderUnits).toEqual({ distance: 'mi', weight: 'lb' })
    expect(c.calendar[0]?.date).toBe('2026-11-03 Tue')
  })

  it('gives the athlete as of today', () => {
    const c = parse(athleteContext(input()))
    expect(c.athlete).toMatchObject({ ftpW: 255, eftpW: 258, weightKg: 75, wPerKg: 3.4, age: 46, lthr: 168, runThresholdPace: '4:30/km', swimCss: '1:45/100m' })
    expect(c.bestPower.last90d).toEqual({ '300s': 320 })
  })

  it('shows the calendar with what was done, missed and is coming, and steps only for the days ahead', () => {
    const c = parse(athleteContext(input()))
    const cal = (name: string) => c.calendar.find((e) => e.name === name)
    expect(cal('Workout a')).toMatchObject({ status: 'done', plan: 'Gran fondo build', min: 60, load: 70 })
    expect(cal('Workout a')?.steps).toBeUndefined()
    expect(cal('Workout b')?.status).toBe('missed')
    expect(cal('Workout c')).toMatchObject({ status: 'today', steps: '- 10m ramp 50-75%\n- 40m 70%', notes: 'Notes for c' })
    expect(cal('Workout d')).toMatchObject({ date: '2026-11-18 Wed', status: 'planned' })
    expect(cal('Long run')).toMatchObject({ sport: 'run', effort: 'easy', status: 'planned' })
    // more than two weeks ahead: on the calendar, without its steps
    expect(cal('Workout f')).toBeDefined()
    expect(cal('Workout f')?.steps).toBeUndefined()
  })

  it('says where each plan is and the race it builds to', () => {
    const c = parse(athleteContext(input()))
    expect(c.plans[0]).toMatchObject({
      name: 'Gran fondo build',
      onCalendar: true,
      trainingDays: ['Tue', 'Thu', 'Sat'],
      race: { name: 'Gran fondo', date: '2026-12-13 Sun', priority: 'A' },
      firstDay: '2026-11-03 Tue',
      lastDay: '2026-12-10 Thu',
      week: '3 of 6',
      done: 1,
      missed: 1,
      today: 1,
      planned: 2,
    })
  })

  it('projects form on race day from the planned load, and lists days off', () => {
    const c = parse(athleteContext(input()))
    expect(c.events[0]).toMatchObject({ name: 'Gran fondo', daysAway: 26 })
    expect(c.events[0]?.projectedForm?.ctl).toBeGreaterThan(0)
    expect(c.daysOff).toEqual([{ date: '2026-11-10 Tue', kind: 'sick', note: 'Head cold' }])
    expect(c.fitness.now?.ctl).toBeGreaterThan(0)
  })

  it('includes runs and swims with their pace', () => {
    const c = parse(athleteContext(input()))
    expect(c.otherActivities).toEqual([
      expect.objectContaining({ sport: 'run', km: 6, pace: '5:00/km', load: 40, from: 'fit' }),
      expect.objectContaining({ sport: 'swim', m: 2000, pace: '2:00/100m' }),
    ])
    expect(c.workouts).toEqual([{ name: 'My threshold', sport: 'ride', min: 60, load: 80, tags: ['threshold'], favorite: true }])
  })

  it('keeps laps for the latest rides only', () => {
    const rides = Array.from({ length: 15 }, (_, i) => ride(`r${i}`, `2026-11-${String(i + 1).padStart(2, '0')}`))
    const c = parse(athleteContext(input({ rides })))
    expect(c.rides).toHaveLength(15)
    expect(c.rides[14]?.laps).toHaveLength(12)
    expect(c.rides[5]?.laps).toHaveLength(12)
    expect(c.rides[4]?.laps).toBeUndefined()
  })

  it('drops detail before anything else to fit the budget', () => {
    const full = athleteContext(input())
    const tight = parse(athleteContext(input(), full.length - 1))
    expect(tight.calendar.length).toBeGreaterThan(0)
    expect(tight.plans).toHaveLength(1)
    expect(tight.calendar.filter((e) => e.steps).length).toBeLessThan(parse(full).calendar.filter((e) => e.steps).length)
  })

  it('stays inside the budget for a rider with a lot going on', () => {
    const long = 'x'.repeat(5000)
    const days = Array.from({ length: 200 }, (_, i) => new Date(2026, 9, 1 + i))
    const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const schedule = days.flatMap((d, i) => [0, 1, 2].map((n) => entry(`e${i}-${n}`, key(d), { name: long })))
    const json = athleteContext(
      input({
        rides: days.slice(0, 50).map((d, i) => ride(`r${i}`, key(d), { name: long, notes: long, laps: Array.from({ length: 60 }, (_, j) => ({ index: j, label: long, durationS: 60 })) as RideSummary['laps'] })),
        activities: days.slice(0, 50).map((d, i) => activity(`a${i}`, key(d), { name: long, notes: long })),
        schedule,
        planned: new Map(schedule.map((e) => [e.id, { durationS: 3600, load: 50, distanceM: null, steps: long, notes: long }])),
        plans: Array.from({ length: 30 }, (_, i) => ({ ...plan, id: `p${i}`, name: long, description: long })),
        marks: days.map((d, i) => ({ id: `m${i}`, date: key(d), kind: i % 2 ? 'event' : 'rest', name: long, note: long }) as DayMark),
        workouts: Array.from({ length: 200 }, () => ({ name: long, sport: 'ride' as const, durationS: 3600, load: 50, tags: [long], favorite: false })),
      }),
    )
    expect(json.length).toBeLessThanOrEqual(40_000)
  })
})
