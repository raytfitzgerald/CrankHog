import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { strToU8, zipSync } from 'fflate'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Workout } from '@core/workout/model'
import { addToPlan, createPlan, saveAndFile } from '../plan/plans-repo'
import { BACKUP_FORMAT, BACKUP_VERSION, createBackup, restoreBackup } from './backup'
import { CrankHogDb, db, type OtherActivity, type StoredWorkout } from './db'
import type { DayMark, TrainingPlan } from '@core/workout/plan'

// the schema 0.6.4 shipped with
const V3 = { rides: 'id, startedAt, kind, simulated, workoutId', rideStreams: 'rideId', workouts: 'id, name, source, updatedAt, favorite, *tags', ftpHistory: '++id, date, source', profile: '++id, from', kv: 'key', routes: 'id, name, importedAt', routeRides: 'rideId, routeId, startedAt', journeys: 'id, courseId, updatedAt' }

/** A workout in 0.6.4's Training plan folder: folder 'plan' and a place in it, no plan id. */
const legacy = (id: string, name: string, planOrder?: number): StoredWorkout => {
  const json: Workout = { id, name, tags: [], sportType: 'bike', segments: [{ kind: 'steady', durationS: 600, power: { unit: 'ftp', value: 0.6 } }] as never, source: 'user', ...(planOrder ? { folder: 'plan' } : {}) }
  return { id, name, source: 'user', tags: [], durationS: 600, tss: 10, favorite: false, planOrder, json, createdAt: 1, updatedAt: 1 }
}
const OLD_PLAN = [legacy('w3', 'Three', 3), legacy('w1', 'One', 1), legacy('w2', 'Two', 2), legacy('c', 'Custom')]

/** Writes a 0.6.4 database under `name`, with the old Training plan folder in it. */
async function v3Database(name: string): Promise<void> {
  await Dexie.delete(name)
  const v3 = new Dexie(name)
  v3.version(3).stores(V3)
  await v3.open()
  await v3.table('workouts').bulkPut(OLD_PLAN)
  v3.close()
}

const planShape = async (d: CrankHogDb) => (await d.plans.toArray()).map((p) => [p.name, p.items.map((i) => i.workoutId), p.onCalendar])

const plan: TrainingPlan = { id: 'p1', name: 'Base 1', items: [{ id: 'i1', workoutId: 'w' }], rideDays: [1, 3], startDate: '2026-11-16', onCalendar: false, source: 'manual', createdAt: 1, updatedAt: 1 }
const run: OtherActivity = { id: 'a1', startedAt: 1, sport: 'running', subSport: null, name: 'Morning run', movingS: 1800, distanceM: 5000, avgHr: 150, maxHr: 170, hrLoad: 40, trainingEffect: { aerobic: 3, anaerobic: 1 }, garminLoad: 80, device: null, fileName: 'run.fit' }
const mark: DayMark = { id: 'd1', date: '2026-12-06', kind: 'event', name: 'Gran fondo', priority: 'A' }

beforeEach(async () => {
  await db().delete()
  await db().open()
})

describe('database version 5', () => {
  it('opens a version 4 database, keeping its schedule, and adds plans, activities and day marks', async () => {
    const name = 'v5-upgrade-test'
    await Dexie.delete(name)
    const v4 = new Dexie(name)
    v4.version(4).stores({ rides: 'id, startedAt, kind, simulated, workoutId', rideStreams: 'rideId', workouts: 'id, name, source, updatedAt, favorite, *tags', ftpHistory: '++id, date, source', profile: '++id, from', kv: 'key', routes: 'id, name, importedAt', routeRides: 'rideId, routeId, startedAt', journeys: 'id, courseId, updatedAt', schedule: 'id, date, source' })
    await v4.open()
    await v4.table('schedule').put({ id: 's1', date: '2026-11-18', workoutId: 'w', workout: null, name: 'Kept', source: 'manual', createdAt: 1 })
    v4.close()
    const upgraded = new CrankHogDb(name)
    await upgraded.open()
    expect(await upgraded.schedule.get('s1')).toMatchObject({ name: 'Kept' })
    expect([await upgraded.plans.count(), await upgraded.activities.count(), await upgraded.dayMarks.count()]).toEqual([0, 0, 0])
    upgraded.close()
  })

  it('turns a 0.6.4 database’s Training plan folder into a plan as it upgrades, in the old order, once', async () => {
    const name = 'v3-legacy-plan-test'
    await v3Database(name)
    const upgraded = new CrankHogDb(name)
    await upgraded.open()
    expect(await planShape(upgraded)).toEqual([['Training plan', ['w1', 'w2', 'w3'], false]])
    const [plan] = await upgraded.plans.toArray()
    expect((await upgraded.workouts.get('w2'))!.json).toMatchObject({ folder: 'plan', planId: plan!.id })
    expect((await upgraded.workouts.get('c'))!.json.planId).toBeUndefined()
    upgraded.close()
    const again = new CrankHogDb(name)
    await again.open()
    expect(await again.plans.count()).toBe(1)
    again.close()
  })

  it('keeps every old plan workout when the first thing the rider does is save one in the builder, or add one to a new plan', async () => {
    db().close()
    await v3Database('freegaz')
    await db().open()
    const w2 = (await db().workouts.get('w2'))!.json
    await saveAndFile({ ...w2, name: 'Two, harder' }, 250)
    const fresh = await createPlan({ name: 'Training plan' })
    await addToPlan(fresh.id, 'w1')
    const plans = await db().plans.toArray()
    const old = plans.find((p) => p.id !== fresh.id)!
    expect(old.items.map((i) => i.workoutId)).toEqual(['w1', 'w2', 'w3'])
    expect(plans).toHaveLength(2)
  })

  it('files the old Training plan folder from a 0.6.4 backup in a plan, and restoring it again adds none', async () => {
    const zip = zipSync({
      'manifest.json': strToU8(JSON.stringify({ format: BACKUP_FORMAT, version: 1, createdAt: 1 })),
      'workouts.json': strToU8(JSON.stringify(OLD_PLAN)),
    })
    await restoreBackup(zip)
    await restoreBackup(zip)
    expect(await planShape(db())).toEqual([['Training plan', ['w1', 'w2', 'w3'], false]])
    const [plan] = await db().plans.toArray()
    expect((await db().workouts.get('w3'))!.json.planId).toBe(plan!.id)
    // and a backup made since restores without making another
    await restoreBackup(await createBackup())
    expect(await db().plans.count()).toBe(1)
  })

  it('writes backups an older app refuses rather than half-restores', async () => {
    const zip = await createBackup()
    const { unzipSync, strFromU8 } = await import('fflate')
    const manifest = JSON.parse(strFromU8(unzipSync(zip)['manifest.json']!)) as { version: number }
    // 0.6.4 knows version 1 and refuses anything newer
    expect(manifest.version).toBe(BACKUP_VERSION)
    expect(BACKUP_VERSION).toBeGreaterThan(1)
  })

  it('backs up plans, activities and day marks, and restores them', async () => {
    await db().plans.put(plan)
    await db().activities.put(run)
    await db().dayMarks.put(mark)
    const zip = await createBackup()
    await Promise.all([db().plans.clear(), db().activities.clear(), db().dayMarks.clear()])
    await restoreBackup(zip)
    expect(await db().plans.get('p1')).toEqual(plan)
    expect(await db().activities.get('a1')).toEqual(run)
    expect(await db().dayMarks.get('d1')).toEqual(mark)
  })
})
