// Events and days off on the calendar. Plans on the calendar skip rest, sick
// and travel days and stop before their event, so every change re-lays them.
import type { DayMark } from '@core/workout/plan'
import { dateKey, dateKeyToMs } from '@core/workout/schedule'
import { db } from '../db/db'
import { relayAllPlans } from './plans-repo'

const newId = () => `m${Date.now().toString(36)}${crypto.randomUUID().slice(0, 8)}`
const DAY_MS = 86_400_000

export async function addMark(mark: Omit<DayMark, 'id'>): Promise<DayMark> {
  const m: DayMark = { ...mark, id: newId(), ...(mark.name !== undefined ? { name: mark.name.trim() } : {}) }
  await db().dayMarks.put(m)
  await relayAllPlans()
  return m
}

/** Several marks at once (a week of travel), with one re-lay. */
export async function addMarks(marks: readonly Omit<DayMark, 'id'>[]): Promise<DayMark[]> {
  const rows = marks.map((mark): DayMark => ({ ...mark, id: newId(), ...(mark.name !== undefined ? { name: mark.name.trim() } : {}) }))
  await db().dayMarks.bulkPut(rows)
  await relayAllPlans()
  return rows
}

/** Puts back a mark as it was (an undo), with its id. */
export async function restoreMark(mark: DayMark): Promise<void> {
  await db().dayMarks.put(mark)
  await relayAllPlans()
}

/** Takes several marks off at once, with one re-lay. */
export async function removeMarks(ids: readonly string[]): Promise<void> {
  await db().dayMarks.bulkDelete([...ids])
  await relayAllPlans()
}

export async function updateMark(id: string, patch: Partial<Omit<DayMark, 'id'>>): Promise<void> {
  await db().dayMarks.update(id, patch)
  await relayAllPlans()
}

export async function removeMark(id: string): Promise<void> {
  await db().dayMarks.delete(id)
  // a plan built to this event keeps running, just without an end
  await relayAllPlans()
}

/** The next event of this priority, today included, with how many days away it is. */
export async function nextEvent(now: number, priority: DayMark['priority'] = 'A'): Promise<(DayMark & { days: number }) | null> {
  const today = dateKey(now)
  const events = (await db().dayMarks.where('date').aboveOrEqual(today).toArray()).filter((m) => m.kind === 'event' && (m.priority ?? 'A') === priority).sort((a, b) => a.date.localeCompare(b.date))
  const e = events[0]
  return e ? { ...e, days: Math.round((dateKeyToMs(e.date) - dateKeyToMs(today)) / DAY_MS) } : null
}
