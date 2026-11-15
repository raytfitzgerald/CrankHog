import { describe, expect, it } from 'vitest'
import { volumeBetween, type VolumeInput } from './volume'

const at = (y: number, m: number, d: number, h = 18) => new Date(y, m - 1, d, h).getTime()

const input: VolumeInput = {
  today: '2026-11-18',
  planned: [
    { date: '2026-11-16', durationS: 3600, load: 60, done: true },
    { date: '2026-11-17', durationS: 2700, load: 50, done: false },
    { date: '2026-11-19', durationS: 5400, load: 80, done: false },
    { date: '2026-11-19', durationS: null, load: null, done: false },
  ],
  rides: [
    { startedAt: at(2026, 11, 16), movingS: 3700, tss: 62, simulated: false },
    { startedAt: at(2026, 11, 18), movingS: 1800, tss: null, simulated: false },
    { startedAt: at(2026, 11, 18, 7), movingS: 9999, tss: 999, simulated: true },
    { startedAt: at(2026, 11, 23), movingS: 3600, tss: 50, simulated: false },
  ],
  activities: [{ startedAt: at(2026, 11, 17), movingS: 2400, hrLoad: 35.5 }],
}

describe('volumeBetween', () => {
  it('adds up planned and completed time, load and sessions for the days asked', () => {
    expect(volumeBetween('2026-11-16', '2026-11-22', input)).toEqual({
      planned: { sessions: 4, durationS: 3600 + 2700 + 5400, load: 60 + 50 + 80 },
      completed: { sessions: 3, durationS: 3700 + 1800 + 2400, load: 62 + 35.5 },
      // two planned workouts were due by today, and one was done
      compliance: 0.5,
    })
  })

  it('has no compliance before anything planned is due', () => {
    expect(volumeBetween('2026-11-19', '2026-11-22', input).compliance).toBeNull()
  })

  it('counts nothing outside the range, and never a simulated ride', () => {
    const v = volumeBetween('2026-11-23', '2026-11-29', input)
    expect(v.completed).toEqual({ sessions: 1, durationS: 3600, load: 50 })
    expect(v.planned).toEqual({ sessions: 0, durationS: 0, load: 0 })
  })
})
