import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import type { RideSummary } from '@core/ride/types'
import { addDays, dateKey } from '@core/workout/schedule'
import type { Workout } from '@core/workout/model'
import { db } from '../db/db'
import { saveWorkout } from '../workouts/library'
import { addMark } from './day-marks-repo'
import {
  addToPlan,
  createPlan,
  deletePlan,
  getPlan,
  importIntoPlan,
  moveItem,
  putOnCalendar,
  removeItem,
  resetPlanWorkout,
  saveAndFile,
  takeOffCalendar,
  takeOutOfPlan,
  updatePlan,
} from './plans-repo'
import { moveScheduled, removeScheduled } from './schedule-repo'

const today = dateKey(Date.now())
/** The next Monday after today, so ride days land at known offsets. */
const nextMonday = (() => {
  let d = addDays(today, 1)
  while (new Date(`${d}T12:00:00`).getDay() !== 1) d = addDays(d, 1)
  return d
})()
const planned = () => db().schedule.toArray().then((l) => l.sort((a, b) => a.date.localeCompare(b.date)).map((e) => [e.date, e.workoutId]))

beforeEach(async () => {
  await db().delete()
  await db().open()
})

describe('plans', () => {
  it('creates a named plan, adds workouts in order, and puts them on the ride days', async () => {
    const p = await createPlan({ name: 'Base 1', rideDays: [1, 3], startDate: nextMonday })
    await addToPlan(p.id, 'builtin:endurance-60')
    await addToPlan(p.id, 'builtin:sweet-spot-3x12')
    await addToPlan(p.id, 'builtin:vo2max-5x4')
    await putOnCalendar(p.id)
    expect(await planned()).toEqual([
      [addDays(nextMonday, 1), 'builtin:endurance-60'],
      [addDays(nextMonday, 3), 'builtin:sweet-spot-3x12'],
      [addDays(nextMonday, 8), 'builtin:vo2max-5x4'],
    ])
    const names = (await db().schedule.toArray()).map((e) => e.name)
    expect(names).toContain('Endurance 60')
    expect((await getPlan(p.id))!.onCalendar).toBe(true)
  })

  it('re-lays the calendar when a plan on it is edited, and leaves it alone when it is not on it', async () => {
    const p = await createPlan({ name: 'Base 1', rideDays: [1, 3], startDate: nextMonday })
    await addToPlan(p.id, 'builtin:endurance-60')
    expect(await planned()).toEqual([])
    await putOnCalendar(p.id)
    await updatePlan(p.id, { rideDays: [5] })
    expect(await planned()).toEqual([[addDays(nextMonday, 5), 'builtin:endurance-60']])
  })

  it('reorders and removes workouts', async () => {
    const p = await createPlan({ name: 'P', rideDays: [0], startDate: nextMonday })
    await addToPlan(p.id, 'a')
    await addToPlan(p.id, 'b')
    await addToPlan(p.id, 'c')
    const ids = (await getPlan(p.id))!.items.map((i) => i.id)
    await moveItem(p.id, ids[2]!, -1)
    expect((await getPlan(p.id))!.items.map((i) => i.workoutId)).toEqual(['a', 'c', 'b'])
    await removeItem(p.id, ids[0]!)
    expect((await getPlan(p.id))!.items.map((i) => i.workoutId)).toEqual(['c', 'b'])
  })

  it('keeps a workout already ridden where it was, and re-lays only the rest', async () => {
    // started last week, so its first workout is in the past and was ridden
    const start = addDays(nextMonday, -7)
    const p = await createPlan({ name: 'P', rideDays: [0], startDate: start })
    await addToPlan(p.id, 'builtin:endurance-60')
    await addToPlan(p.id, 'builtin:sweet-spot-3x12')
    await putOnCalendar(p.id)
    await db().rides.put({ id: 'r', name: 'r', kind: 'workout', simulated: false, startedAt: new Date(`${start}T18:00:00`).getTime(), movingS: 3600, tss: 50, workoutId: 'builtin:endurance-60' } as unknown as RideSummary)
    // moving the ride day to Wednesday moves what is left, but not what was ridden
    await updatePlan(p.id, { rideDays: [2] })
    expect(await planned()).toEqual([
      [start, 'builtin:endurance-60'],
      [addDays(start, 9), 'builtin:sweet-spot-3x12'],
    ])
  })

  it('takes a plan off the calendar, and deleting it does too', async () => {
    const p = await createPlan({ name: 'P', rideDays: [0], startDate: nextMonday })
    await addToPlan(p.id, 'a')
    await putOnCalendar(p.id)
    await takeOffCalendar(p.id)
    expect(await planned()).toEqual([])
    await putOnCalendar(p.id)
    await deletePlan(p.id)
    expect(await planned()).toEqual([])
    expect(await getPlan(p.id)).toBeUndefined()
  })

  it('skips rest, sick and travel days, and stops before the plan’s event', async () => {
    await db().dayMarks.bulkPut([
      { id: 't', date: addDays(nextMonday, 1), kind: 'travel' },
      { id: 'e', date: addDays(nextMonday, 7), kind: 'event', name: 'Race', priority: 'A' },
    ])
    const p = await createPlan({ name: 'P', rideDays: [0, 1, 2], startDate: nextMonday, eventId: 'e' })
    for (const w of ['a', 'b', 'c', 'd']) await addToPlan(p.id, w)
    await putOnCalendar(p.id)
    expect(await planned()).toEqual([
      [nextMonday, 'a'],
      [addDays(nextMonday, 2), 'b'],
    ])
  })
})

describe('importIntoPlan', () => {
  const zwo = (name: string) => `<workout_file><name>${name}</name><sportType>bike</sportType><workout><SteadyState Duration="1800" Power="0.7"/></workout></workout_file>`

  it('adds files in file-name order, keeping the day of a "YYYY-MM-DD_" file', async () => {
    const p = await createPlan({ name: 'From files', rideDays: [1], startDate: nextMonday })
    const dated = addDays(nextMonday, 4)
    const r = await importIntoPlan(p.id, [
      { name: '02 Second.txt', text: '- 20m 70%' },
      { name: `${dated}_Threshold.zwo`, text: zwo('Threshold 2x20') },
      { name: '01 First.txt', text: '- 10m 60%' },
    ])
    expect(r.failed).toEqual([])
    const plan = (await getPlan(p.id))!
    const names = await Promise.all(plan.items.map(async (i) => (await db().workouts.get(i.workoutId))!.name))
    expect(names).toEqual(['01 First', '02 Second', 'Threshold 2x20'])
    expect(plan.items.map((i) => i.date)).toEqual([undefined, undefined, dated])
    // filed in the plan, and shown in the library as such
    const w = (await db().workouts.get(plan.items[2]!.workoutId))!.json
    expect([w.folder, w.planId]).toEqual(['plan', p.id])
  })

  it('names a plain-text file after the rest of its file name, without the date', async () => {
    const p = await createPlan({ name: 'P', rideDays: [1], startDate: nextMonday })
    await importIntoPlan(p.id, [{ name: `${nextMonday}_Openers.txt`, text: '- 30m 65%' }])
    const plan = (await getPlan(p.id))!
    expect((await db().workouts.get(plan.items[0]!.workoutId))!.name).toBe('Openers')
  })

  it('reports files it cannot read and keeps the rest', async () => {
    const p = await createPlan({ name: 'P', rideDays: [1], startDate: nextMonday })
    const r = await importIntoPlan(p.id, [{ name: 'bad.zwo', text: 'not xml' }, { name: 'ok.txt', text: '- 10m 60%' }])
    expect(r.added).toBe(1)
    expect(r.failed.map((f) => f.name)).toEqual(['bad.zwo'])
  })
})

describe('changes made on the calendar', () => {
  const entryOf = async (workoutId: string) => (await db().schedule.toArray()).find((e) => e.workoutId === workoutId)!

  it('keeps a workout moved on the calendar where it was put, through a day off and other edits', async () => {
    const p = await createPlan({ name: 'P', rideDays: [1, 3], startDate: nextMonday })
    for (const w of ['a', 'b', 'c']) await addToPlan(p.id, w)
    await putOnCalendar(p.id)
    // b from the first Thursday to the first Friday
    await moveScheduled((await entryOf('b')).id, addDays(nextMonday, 4))
    // a sick day on c's Tuesday: c moves on to Thursday, b stays where it was put
    await addMark({ date: addDays(nextMonday, 8), kind: 'sick' })
    await updatePlan(p.id, { name: 'Renamed' })
    expect(await planned()).toEqual([
      [addDays(nextMonday, 1), 'a'],
      [addDays(nextMonday, 4), 'b'],
      [addDays(nextMonday, 10), 'c'],
    ])
  })

  it('keeps a workout removed from the calendar off it, and in the plan, until it is put back', async () => {
    const p = await createPlan({ name: 'P', rideDays: [1, 3], startDate: nextMonday })
    for (const w of ['a', 'b', 'c']) await addToPlan(p.id, w)
    await putOnCalendar(p.id)
    await removeScheduled((await entryOf('b')).id)
    await addMark({ date: addDays(nextMonday, 14), kind: 'rest' })
    expect(await planned()).toEqual([
      [addDays(nextMonday, 1), 'a'],
      [addDays(nextMonday, 8), 'c'],
    ])
    const item = (await getPlan(p.id))!.items[1]!
    expect(item).toMatchObject({ workoutId: 'b', removed: true })
    await resetPlanWorkout(p.id, item.id)
    expect((await planned()).map(([, w]) => w)).toEqual(['a', 'b', 'c'])
  })

  it('moves an entry of a plan no longer on the calendar like any other', async () => {
    const p = await createPlan({ name: 'P', rideDays: [1], startDate: nextMonday })
    await addToPlan(p.id, 'a')
    await putOnCalendar(p.id)
    const e = await entryOf('a')
    await db().plans.update(p.id, { onCalendar: false })
    await moveScheduled(e.id, addDays(nextMonday, 2))
    expect((await db().schedule.get(e.id))!.date).toBe(addDays(nextMonday, 2))
    expect((await getPlan(p.id))!.items[0]!.movedTo).toBeUndefined()
  })
})

describe('filing', () => {
  const mine = (over: Partial<Workout> = {}): Workout => ({ id: 'w1', name: 'Mine', tags: [], sportType: 'bike', segments: [{ kind: 'steady', durationS: 600, power: { unit: 'ftp', value: 0.6 } }] as never, source: 'user', ...over })
  const filing = async (id = 'w1') => {
    const w = (await db().workouts.get(id))!.json
    return [w.folder, w.planId]
  }

  it('files a workout saved in the builder in the plan picked, once', async () => {
    const p = await createPlan({ name: 'Base 1' })
    await saveAndFile(mine({ folder: 'plan', planId: p.id }), 250)
    await saveAndFile(mine({ folder: 'plan', planId: p.id }), 250)
    expect((await getPlan(p.id))!.items.map((i) => i.workoutId)).toEqual(['w1'])
  })

  it('makes a plan called Training plan when none was picked', async () => {
    const filed = await saveAndFile(mine({ folder: 'plan' }), 250)
    const [plan] = await db().plans.toArray()
    expect(plan!.name).toBe('Training plan')
    expect(filed.planId).toBe(plan!.id)
    expect(await filing()).toEqual(['plan', plan!.id])
  })

  it('moves a workout filed in another plan in the builder out of the first one', async () => {
    const a = await createPlan({ name: 'A' })
    const b = await createPlan({ name: 'B' })
    await saveAndFile(mine({ folder: 'plan', planId: a.id }), 250)
    const saved = await saveAndFile(mine({ folder: 'plan', planId: b.id }), 250)
    expect((await getPlan(a.id))!.items).toEqual([])
    expect((await getPlan(b.id))!.items.map((i) => i.workoutId)).toEqual(['w1'])
    expect(saved.planId).toBe(b.id)
  })

  it('takes a workout moved to Custom workouts in the builder out of its plan, unless another plan has it too', async () => {
    const a = await createPlan({ name: 'A' })
    const c = await createPlan({ name: 'C' })
    await saveAndFile(mine({ folder: 'plan', planId: a.id }), 250)
    const custom = await saveAndFile(mine(), 250)
    expect((await getPlan(a.id))!.items).toEqual([])
    expect(custom.folder).toBeUndefined()
    // in two plans: leaving one files it in the other
    await saveAndFile(mine({ folder: 'plan', planId: a.id }), 250)
    await addToPlan(c.id, 'w1')
    const left = await saveAndFile(mine(), 250)
    expect([left.folder, left.planId]).toEqual(['plan', c.id])
  })

  it('files a workout added to a plan from the library, and refiles it when its plan is deleted', async () => {
    await saveWorkout(mine(), 250)
    const a = await createPlan({ name: 'A' })
    await addToPlan(a.id, 'w1')
    expect(await filing()).toEqual(['plan', a.id])
    // a built-in is never filed, and adding one changes nothing in the library
    await addToPlan(a.id, 'builtin:endurance-60')
    await deletePlan(a.id)
    expect(await filing()).toEqual([undefined, undefined])
    // in two plans: deleting the one it is filed in files it in the other
    const b = await createPlan({ name: 'B' })
    const c = await createPlan({ name: 'C' })
    await addToPlan(b.id, 'w1')
    await addToPlan(c.id, 'w1')
    expect(await filing()).toEqual(['plan', b.id])
    await deletePlan(b.id)
    expect(await filing()).toEqual(['plan', c.id])
  })

  it('sends a workout taken out of its only plan back to Custom workouts, and refiles one still in another', async () => {
    const p = await createPlan({ name: 'Base 1' })
    const q = await createPlan({ name: 'Base 2' })
    await saveAndFile(mine({ folder: 'plan', planId: p.id }), 250)
    await addToPlan(q.id, 'w1')
    await takeOutOfPlan(p.id, (await getPlan(p.id))!.items[0]!.id)
    expect(await filing()).toEqual(['plan', q.id])
    await takeOutOfPlan(q.id, (await getPlan(q.id))!.items[0]!.id)
    expect((await getPlan(q.id))!.items).toEqual([])
    expect(await filing()).toEqual([undefined, undefined])
  })
})
