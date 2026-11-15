import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { addDays, dateKey } from '@core/workout/schedule'
import { db } from '../db/db'
import { addMark, nextEvent, removeMark, updateMark } from './day-marks-repo'
import { addToPlan, createPlan, putOnCalendar } from './plans-repo'

const today = dateKey(Date.now())
const monday = (() => {
  let d = addDays(today, 1)
  while (new Date(`${d}T12:00:00`).getDay() !== 1) d = addDays(d, 1)
  return d
})()
const planned = async () => (await db().schedule.toArray()).map((e) => e.date).sort()

beforeEach(async () => {
  await db().delete()
  await db().open()
})

describe('events and days off', () => {
  it('moves a plan off a day marked travel, and back when the mark goes', async () => {
    const p = await createPlan({ name: 'P', rideDays: [1, 3], startDate: monday })
    await addToPlan(p.id, 'a')
    await putOnCalendar(p.id)
    expect(await planned()).toEqual([addDays(monday, 1)])
    const travel = await addMark({ date: addDays(monday, 1), kind: 'travel' })
    expect(await planned()).toEqual([addDays(monday, 3)])
    await removeMark(travel.id)
    expect(await planned()).toEqual([addDays(monday, 1)])
  })

  it('moves a built plan’s dated workouts off a sick day, and ends them before an event moved earlier', async () => {
    const event = await addMark({ date: addDays(monday, 13), kind: 'event', name: 'Race', priority: 'A' })
    const p = await createPlan({ name: 'P', rideDays: [1, 3], startDate: monday, eventId: event.id })
    for (const [w, day] of [['a', 1], ['b', 3], ['c', 10]] as const) await addToPlan(p.id, w, addDays(monday, day))
    await putOnCalendar(p.id)
    // sick on b's Thursday: b goes to the next free ride day, the Tuesday after
    await addMark({ date: addDays(monday, 3), kind: 'sick' })
    expect(await planned()).toEqual([addDays(monday, 1), addDays(monday, 8), addDays(monday, 10)])
    // the race moves to that Wednesday: nothing on or after it stays
    await updateMark(event.id, { date: addDays(monday, 9) })
    expect(await planned()).toEqual([addDays(monday, 1), addDays(monday, 8)])
  })

  it('an event does not block its day', async () => {
    const p = await createPlan({ name: 'P', rideDays: [1], startDate: monday })
    await addToPlan(p.id, 'a')
    await putOnCalendar(p.id)
    await addMark({ date: addDays(monday, 1), kind: 'event', name: 'Club race', priority: 'C' })
    expect(await planned()).toEqual([addDays(monday, 1)])
  })

  it('finds the next A event, today included, for the countdown on Home', async () => {
    await addMark({ date: addDays(today, -3), kind: 'event', name: 'Gone', priority: 'A' })
    await addMark({ date: addDays(today, 40), kind: 'event', name: 'Later', priority: 'A' })
    await addMark({ date: addDays(today, 10), kind: 'event', name: 'Smaller', priority: 'B' })
    await addMark({ date: addDays(today, 20), kind: 'event', name: 'Gran fondo', priority: 'A' })
    expect(await nextEvent(Date.now())).toMatchObject({ name: 'Gran fondo', days: 20 })
    expect(await nextEvent(Date.now(), 'B')).toMatchObject({ name: 'Smaller', days: 10 })
  })
})
