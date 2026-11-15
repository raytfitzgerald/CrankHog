import { describe, expect, it } from 'vitest'
import type { Workout } from '@core/workout/model'
import type { ScheduledWorkout } from '@core/workout/schedule'
import { BUILTINS } from '../../workouts/library'
import { hoursMinutes, previewsFor, workoutPreview } from './preview'

const steady = (id: string, minutes: number, frac: number): Workout => ({
  id,
  name: id,
  tags: ['endurance'],
  sportType: 'bike',
  source: 'user',
  segments: [{ kind: 'steady', durationS: minutes * 60, power: { unit: 'ftp', value: frac } }],
})

describe('workoutPreview', () => {
  it('gives the shape, the length and the average planned watts at the FTP', () => {
    const w: Workout = {
      ...steady('w', 0, 0),
      segments: [
        { kind: 'steady', durationS: 1200, power: { unit: 'ftp', value: 0.5 } },
        { kind: 'steady', durationS: 1200, power: { unit: 'ftp', value: 0.9 } },
        { kind: 'steady', durationS: 1200, power: { unit: 'ftp', value: 0.7 } },
      ],
    }
    const p = workoutPreview(w, 250)
    expect(p.durationS).toBe(3600)
    expect(p.plannedS).toBe(3600)
    // (125 + 225 + 175) / 3
    expect(p.avgW).toBe(175)
    expect(p.blocks.map((b) => [b.startS, b.endS, b.from])).toEqual([
      [0, 1200, 0.5],
      [1200, 2400, 0.9],
      [2400, 3600, 0.7],
    ])
    // watts follow the FTP
    expect(workoutPreview(w, 300).avgW).toBe(210)
  })

  it('plans a ramp test at its typical length, with no average', () => {
    const ramp = BUILTINS.find((w) => w.id === 'builtin:ramp-test')!
    const p = workoutPreview(ramp, 250)
    expect(p).toMatchObject({ ramp: true, avgW: null, plannedS: 25 * 60 })
    expect(p.blocks.length).toBeGreaterThan(5)
  })
})

describe('previewsFor', () => {
  it('covers the planned library workouts and the workouts entries carry, and nothing else', () => {
    const entry = (id: string, workoutId: string | null, workout: Workout | null): ScheduledWorkout => ({ id, date: '2026-11-20', workoutId, workout, name: id, source: 'manual', createdAt: 1 })
    const carried = steady('icu:1', 45, 0.6)
    const map = previewsFor([{ workout: steady('mine', 60, 0.7) }, { workout: steady('unplanned', 30, 0.5) }], [entry('a', 'mine', null), entry('b', null, carried)], 200)
    expect([...map.keys()].sort()).toEqual(['icu:1', 'mine'])
    expect(map.get('mine')?.avgW).toBe(140)
    expect(map.get('icu:1')?.plannedS).toBe(2700)
  })
})

describe('hoursMinutes', () => {
  it('writes hours and minutes', () => {
    expect(hoursMinutes(3600)).toBe('1:00')
    expect(hoursMinutes(2700)).toBe('0:45')
    expect(hoursMinutes(10_800)).toBe('3:00')
    expect(hoursMinutes(4710)).toBe('1:19')
  })
})
