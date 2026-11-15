import { describe, expect, it } from 'vitest'
import { layOutPlan, parseDatedFileName, weekdayOf } from './plan'

// 16 Nov 2026 is a Monday.
const MON = '2026-11-16'
const TUE = 1
const THU = 3
const SAT = 5

describe('weekdayOf', () => {
  it('counts Monday as 0 and Sunday as 6', () => {
    expect(weekdayOf('2026-11-16')).toBe(0)
    expect(weekdayOf('2026-11-22')).toBe(6)
  })
})

describe('layOutPlan', () => {
  it('puts the workouts on the ride days in order, from the start date', () => {
    const r = layOutPlan({ items: [{ workoutId: 'a' }, { workoutId: 'b' }, { workoutId: 'c' }, { workoutId: 'd' }], rideDays: [TUE, THU, SAT], startDate: MON, today: MON })
    expect(r.placements.map((p) => [p.date, p.workoutId])).toEqual([
      ['2026-11-17', 'a'],
      ['2026-11-19', 'b'],
      ['2026-11-21', 'c'],
      ['2026-11-24', 'd'],
    ])
    expect(r.warnings).toEqual([])
  })

  it('starts on the start date itself when it is a ride day', () => {
    const r = layOutPlan({ items: [{ workoutId: 'a' }], rideDays: [0], startDate: MON, today: MON })
    expect(r.placements[0]!.date).toBe(MON)
  })

  it('keeps dated workouts on their date, and fills the ride days around them', () => {
    const r = layOutPlan({
      items: [{ workoutId: 'a' }, { workoutId: 'dated', date: '2026-11-19' }, { workoutId: 'b' }],
      rideDays: [TUE, THU, SAT],
      startDate: MON,
      today: MON,
    })
    expect(r.placements.map((p) => [p.date, p.workoutId])).toEqual([
      ['2026-11-17', 'a'],
      ['2026-11-19', 'dated'],
      ['2026-11-21', 'b'],
    ])
  })

  it('skips blocked days', () => {
    const r = layOutPlan({ items: [{ workoutId: 'a' }, { workoutId: 'b' }], rideDays: [TUE, THU], startDate: MON, today: MON, blocked: new Set(['2026-11-17']) })
    expect(r.placements.map((p) => p.date)).toEqual(['2026-11-19', '2026-11-24'])
  })

  it('stops before the event, and says how many did not fit', () => {
    const r = layOutPlan({ items: [{ workoutId: 'a' }, { workoutId: 'b' }, { workoutId: 'c' }], rideDays: [TUE, THU], startDate: MON, today: MON, endDate: '2026-11-21' })
    expect(r.placements.map((p) => p.workoutId)).toEqual(['a', 'b'])
    expect(r.unplaced).toEqual([2])
    expect(r.warnings).toEqual([{ kind: 'past-event', count: 1 }])
  })

  it('warns when there are workouts to place but no ride days', () => {
    const r = layOutPlan({ items: [{ workoutId: 'a' }, { workoutId: 'b', date: '2026-11-20' }], rideDays: [], startDate: MON, today: MON })
    expect(r.placements.map((p) => p.workoutId)).toEqual(['b'])
    expect(r.unplaced).toEqual([0])
    expect(r.warnings).toEqual([{ kind: 'no-ride-days' }])
  })

  it('moves a dated workout off a day off to the next free ride day', () => {
    // a built plan: every workout dated, Tue/Thu/Sat; Thursday the 19th is a sick day, Saturday is taken
    const r = layOutPlan({
      items: [{ workoutId: 'a', date: '2026-11-17' }, { workoutId: 'b', date: '2026-11-19' }, { workoutId: 'c', date: '2026-11-21' }],
      rideDays: [TUE, THU, SAT],
      startDate: MON,
      today: MON,
      blocked: new Set(['2026-11-19']),
    })
    expect(r.placements.map((p) => [p.date, p.workoutId])).toEqual([
      ['2026-11-17', 'a'],
      ['2026-11-21', 'c'],
      ['2026-11-24', 'b'],
    ])
    expect(r.warnings).toEqual([])
  })

  it('leaves out a dated workout on a day off when no ride day is free within a week', () => {
    const items = ['2026-11-17', '2026-11-19', '2026-11-24', '2026-11-26'].map((date, i) => ({ workoutId: `w${i}`, date }))
    const r = layOutPlan({ items, rideDays: [TUE, THU], startDate: MON, today: MON, blocked: new Set(['2026-11-19']) })
    expect(r.placements.map((p) => p.workoutId)).toEqual(['w0', 'w2', 'w3'])
    expect(r.unplaced).toEqual([1])
    expect(r.warnings).toEqual([{ kind: 'days-off', count: 1 }])
  })

  it('leaves out dated workouts on or after the event, so moving the event earlier ends the plan there', () => {
    const r = layOutPlan({
      items: [{ workoutId: 'a', date: '2026-11-17' }, { workoutId: 'b', date: '2026-11-21' }, { workoutId: 'c', date: '2026-11-24' }],
      rideDays: [TUE, SAT],
      startDate: MON,
      today: MON,
      endDate: '2026-11-21',
    })
    expect(r.placements.map((p) => p.workoutId)).toEqual(['a'])
    expect(r.unplaced).toEqual([1, 2])
    expect(r.warnings).toEqual([{ kind: 'past-event', count: 2 }])
  })

  it('keeps a workout where the rider moved it, and the others where they were', () => {
    const items = [{ workoutId: 'a' }, { workoutId: 'b', movedTo: '2026-11-20' }, { workoutId: 'c' }, { workoutId: 'd', date: '2026-11-26', movedTo: '2026-11-27' }]
    const r = layOutPlan({ items, rideDays: [TUE, THU, SAT], startDate: MON, today: MON })
    expect(r.placements.map((p) => [p.date, p.workoutId])).toEqual([
      ['2026-11-17', 'a'],
      // b's own turn, Thursday the 19th, stays empty
      ['2026-11-20', 'b'],
      ['2026-11-21', 'c'],
      ['2026-11-27', 'd'],
    ])
  })

  it('keeps a removed workout off, without moving the rest up', () => {
    const r = layOutPlan({ items: [{ workoutId: 'a' }, { workoutId: 'b', removed: true }, { workoutId: 'c' }], rideDays: [TUE, THU, SAT], startDate: MON, today: MON })
    expect(r.placements.map((p) => [p.date, p.workoutId])).toEqual([
      ['2026-11-17', 'a'],
      ['2026-11-21', 'c'],
    ])
    expect(r.unplaced).toEqual([])
    expect(r.warnings).toEqual([])
  })

  it('moves a moved workout off a later day off too, but lets the rider put one after the event', () => {
    const r = layOutPlan({
      items: [{ workoutId: 'a', movedTo: '2026-11-18' }, { workoutId: 'b', movedTo: '2026-11-29' }],
      rideDays: [TUE, THU],
      startDate: MON,
      today: MON,
      blocked: new Set(['2026-11-18']),
      endDate: '2026-11-28',
    })
    expect(r.placements.map((p) => [p.date, p.workoutId])).toEqual([
      ['2026-11-19', 'a'],
      ['2026-11-29', 'b'],
    ])
  })

  it('warns about workouts that land before today, which will show as missed', () => {
    const r = layOutPlan({ items: [{ workoutId: 'a', date: '2026-11-10' }, { workoutId: 'b' }], rideDays: [TUE], startDate: '2026-11-09', today: MON })
    expect(r.placements.map((p) => p.date)).toEqual(['2026-11-10', '2026-11-17'])
    expect(r.warnings).toEqual([{ kind: 'before-today', count: 1 }])
  })
})

describe('parseDatedFileName', () => {
  it('reads the date at the front of a file name and drops it, with the extension', () => {
    expect(parseDatedFileName('2026-11-18_Threshold 2x20.zwo')).toEqual({ date: '2026-11-18', rest: 'Threshold 2x20' })
    expect(parseDatedFileName('2027-01-02_week1_day2.erg')).toEqual({ date: '2027-01-02', rest: 'week1_day2' })
  })

  it('leaves names without a valid date alone', () => {
    expect(parseDatedFileName('Threshold 2x20.zwo')).toEqual({ date: null, rest: 'Threshold 2x20' })
    expect(parseDatedFileName('2026-13-40_Nope.zwo')).toEqual({ date: null, rest: '2026-13-40_Nope' })
    expect(parseDatedFileName('2026-02-30_Nope.zwo')).toEqual({ date: null, rest: '2026-02-30_Nope' })
    expect(parseDatedFileName('01 Sweet spot.zwo')).toEqual({ date: null, rest: '01 Sweet spot' })
  })
})
