import { describe, expect, it } from 'vitest'
import type { ScheduledWorkout } from '@core/workout/schedule'
import { FTP_TESTS } from '@core/workout/ftp-tests'
import { plannedStats } from './use-calendar-data'

describe('plannedStats', () => {
  it('counts a planned ramp test as a typical test, not every step of the ramp', () => {
    const ramp = FTP_TESTS.find((w) => w.ftpTest?.protocol === 'ramp')!
    const entry: ScheduledWorkout = { id: 'e', date: '2026-11-18', workoutId: null, workout: ramp, name: ramp.name, source: 'manual', createdAt: 0 }
    expect(plannedStats([entry], new Map(), 250).get('e')).toEqual({ durationS: 1500, tss: 35 })
  })

  it('uses the library’s length and TSS for a library workout, and nothing for one it no longer has', () => {
    const entry = (id: string, workoutId: string): ScheduledWorkout => ({ id, date: '2026-11-18', workoutId, workout: null, name: id, source: 'manual', createdAt: 0 })
    const lib = new Map([['w', { durationS: 3600, tss: 60 }]])
    const s = plannedStats([entry('a', 'w'), entry('b', 'gone')], lib, 250)
    expect([s.get('a'), s.get('b')]).toEqual([{ durationS: 3600, tss: 60 }, { durationS: null, tss: null }])
  })
})
