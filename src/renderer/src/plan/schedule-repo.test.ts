import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { beforeEach, describe, expect, it } from 'vitest'
import type { ScheduledWorkout } from '@core/workout/schedule'
import { createBackup, restoreBackup } from '../db/backup'
import { CrankHogDb, db } from '../db/db'
import { listScheduled, moveScheduled, removeScheduled, replaceIntervalsImports, scheduleWorkout } from './schedule-repo'

const imported = (eventId: number, date: string, name = `Event ${eventId}`): ScheduledWorkout => ({
  id: `intervals:${eventId}`,
  date,
  workoutId: null,
  workout: { id: `intervals:${eventId}`, name, tags: [], sportType: 'bike', segments: [{ kind: 'steady', durationS: 600, power: { unit: 'ftp', value: 0.6 } }] as never, source: 'import' },
  name,
  source: 'intervals',
  externalId: String(eventId),
  createdAt: 1,
})

beforeEach(async () => {
  await db().delete()
  await db().open()
})

describe('schedule repo', () => {
  it('schedules a library workout on a day, moves it, and removes it', async () => {
    const e = await scheduleWorkout('2026-11-18', { id: 'builtin:sweet-spot-3x12', name: 'Sweet spot 3×12' })
    expect(await listScheduled('2026-11-01', '2026-11-30')).toEqual([expect.objectContaining({ id: e.id, date: '2026-11-18', workoutId: 'builtin:sweet-spot-3x12', name: 'Sweet spot 3×12', source: 'manual' })])
    await moveScheduled(e.id, '2026-11-20')
    expect((await listScheduled('2026-11-01', '2026-11-30'))[0]!.date).toBe('2026-11-20')
    await removeScheduled(e.id)
    expect(await listScheduled('2026-11-01', '2026-11-30')).toEqual([])
  })

  it('lists only the days asked for, in date order', async () => {
    await scheduleWorkout('2026-12-02', { id: 'w', name: 'Later' })
    await scheduleWorkout('2026-11-03', { id: 'w', name: 'Earlier' })
    await scheduleWorkout('2026-10-31', { id: 'w', name: 'Before' })
    expect((await listScheduled('2026-11-01', '2026-12-31')).map((e) => e.name)).toEqual(['Earlier', 'Later'])
  })

  it('an intervals.icu import replaces what it imported before in that range, and leaves the rider’s own alone', async () => {
    const mine = await scheduleWorkout('2026-11-18', { id: 'w', name: 'Mine' })
    await replaceIntervalsImports('2026-11-14', '2026-11-27', [imported(1, '2026-11-15'), imported(2, '2026-11-16')])
    // event 1 moved on intervals.icu, event 2 was deleted there, event 3 is new
    const r = await replaceIntervalsImports('2026-11-14', '2026-11-27', [imported(1, '2026-11-17', 'Moved'), imported(3, '2026-11-20')])
    expect(r).toEqual({ added: 1, updated: 1, removed: 1 })
    const all = await listScheduled('2026-11-01', '2026-11-30')
    expect(all.map((e) => [e.id, e.date])).toEqual([
      ['intervals:1', '2026-11-17'],
      [mine.id, '2026-11-18'],
      ['intervals:3', '2026-11-20'],
    ])
  })

  it('an import keeps imported workouts outside its range', async () => {
    await replaceIntervalsImports('2026-11-01', '2026-11-30', [imported(9, '2026-11-02')])
    await replaceIntervalsImports('2026-11-14', '2026-11-27', [])
    expect((await listScheduled('2026-11-01', '2026-11-30')).map((e) => e.id)).toEqual(['intervals:9'])
  })

  it('is part of a backup, and comes back on restore', async () => {
    await scheduleWorkout('2026-11-18', { id: 'w', name: 'Planned' })
    const zip = await createBackup()
    await db().schedule.clear()
    await restoreBackup(zip)
    expect((await listScheduled('2026-11-01', '2026-11-30')).map((e) => e.name)).toEqual(['Planned'])
  })
})

describe('database upgrade', () => {
  it('opens a version 3 database, keeping its workouts, and adds the schedule', async () => {
    const name = 'schedule-upgrade-test'
    await Dexie.delete(name)
    const v3 = new Dexie(name)
    v3.version(3).stores({ rides: 'id, startedAt, kind, simulated, workoutId', rideStreams: 'rideId', workouts: 'id, name, source, updatedAt, favorite, *tags', ftpHistory: '++id, date, source', profile: '++id, from', kv: 'key', routes: 'id, name, importedAt', routeRides: 'rideId, routeId, startedAt', journeys: 'id, courseId, updatedAt' })
    await v3.open()
    await v3.table('workouts').put({ id: 'mine', name: 'Mine', source: 'user', tags: [], durationS: 1, tss: null, favorite: false, json: {}, createdAt: 1, updatedAt: 1 })
    v3.close()
    const upgraded = new CrankHogDb(name)
    await upgraded.open()
    expect(await upgraded.workouts.get('mine')).toMatchObject({ name: 'Mine' })
    expect(await upgraded.schedule.count()).toBe(0)
    upgraded.close()
  })
})
