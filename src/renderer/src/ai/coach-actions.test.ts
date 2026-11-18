import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readProposal, type Proposal } from '@core/coach-actions/actions'
import { refOf } from '@core/coach-actions/refs'
import { addDays, dateKey } from '@core/workout/schedule'
import { currentFtp, currentProfile, recordFtp } from '../db/athlete-repo'
import type { CrankHogBridge } from '@shared/ipc/contract'
import { db } from '../db/db'
import * as marks from '../plan/day-marks-repo'
import { addMark } from '../plan/day-marks-repo'
import { addToPlan, createPlan, getPlan, putOnCalendar } from '../plan/plans-repo'
import { scheduleSession } from '../plan/schedule-repo'
import { applyProposal, checkProposal, undoSteps } from './coach-actions'

const today = dateKey(Date.now())
/** The next Monday after today, so plan days land at known offsets. */
const monday = (() => {
  let d = addDays(today, 1)
  while (new Date(`${d}T12:00:00`).getDay() !== 1) d = addDays(d, 1)
  return d
})()
const c = (id: string) => refOf('c', id)
const proposal = (...actions: unknown[]): Proposal => {
  const r = readProposal({ summary: 'Test', actions })
  if (!r.ok) throw new Error(r.error)
  return r.proposal
}
const calendar = async () => (await db().schedule.toArray()).sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name)).map((e) => [e.date, e.name])

/** A plan on the calendar: two built-in workouts on Tuesday and Thursday of next week. */
async function planOnCalendar() {
  const p = await createPlan({ name: 'Base', rideDays: [1, 3], startDate: monday })
  await addToPlan(p.id, 'builtin:endurance-60')
  await addToPlan(p.id, 'builtin:sweet-spot-3x12')
  await putOnCalendar(p.id)
  const entries = (await db().schedule.toArray()).sort((a, b) => a.date.localeCompare(b.date))
  return { plan: p, tue: entries[0]!, thu: entries[1]! }
}

beforeEach(async () => {
  await db().delete()
  await db().open()
})

describe('moving, swapping and removing', () => {
  it("moves a plan's session through the plan, and undo puts it back as it was", async () => {
    const { plan, tue, thu } = await planOnCalendar()
    const before = await calendar()
    const applied = await applyProposal(proposal({ type: 'move', ref: c(tue.id), to: addDays(monday, 5) }))
    expect((await getPlan(plan.id))!.items[0]!.movedTo).toBe(addDays(monday, 5))
    expect(await calendar()).toEqual([
      [thu.date, thu.name],
      [addDays(monday, 5), tue.name],
    ])
    await undoSteps(applied.undo)
    expect((await getPlan(plan.id))!.items[0]!.movedTo).toBeUndefined()
    expect(await calendar()).toEqual(before)
  })

  it('swaps two sessions, and removes one that stays in its plan', async () => {
    const { plan, tue, thu } = await planOnCalendar()
    const swap = await applyProposal(proposal({ type: 'swap', ref: c(tue.id), with: c(thu.id) }))
    expect(await calendar()).toEqual([
      [tue.date, thu.name],
      [thu.date, tue.name],
    ])
    await undoSteps(swap.undo)
    const removed = await applyProposal(proposal({ type: 'remove', ref: c(thu.id) }))
    expect((await getPlan(plan.id))!.items[1]!.removed).toBe(true)
    expect(await calendar()).toEqual([[tue.date, tue.name]])
    await undoSteps(removed.undo)
    expect(await calendar()).toEqual([
      [tue.date, tue.name],
      [thu.date, thu.name],
    ])
  })

  it('moves and removes a session planned by hand, and puts it back', async () => {
    const e = await scheduleSession(addDays(today, 2), 'other', 'Squash', { durationS: 3600, effort: 'hard' })
    const moved = await applyProposal(proposal({ type: 'move', ref: c(e.id), to: addDays(today, 3) }))
    expect(await calendar()).toEqual([[addDays(today, 3), 'Squash']])
    await undoSteps(moved.undo)
    const removed = await applyProposal(proposal({ type: 'remove', ref: c(e.id) }))
    expect(await calendar()).toEqual([])
    await undoSteps(removed.undo)
    expect(await db().schedule.get(e.id)).toMatchObject({ date: addDays(today, 2), name: 'Squash', session: { effort: 'hard' } })
  })
})

describe('making workouts and sessions', () => {
  it('makes a bike workout in Custom workouts and plans it, and undo takes both away', async () => {
    const day = addDays(today, 2)
    const applied = await applyProposal(proposal({ type: 'create_workout', date: day, sport: 'bike', name: 'VO2 5x4', steps: 'Warmup\n- 10m ramp 50-75%\nMain set 5x\n- 4m 115%\n- 4m 50%\nCooldown\n- 10m 50%' }))
    expect(applied.workouts).toEqual([{ id: expect.stringMatching(/^coach:/), name: 'VO2 5x4', sport: 'ride' }])
    const row = await db().workouts.get(applied.workouts[0]!.id)
    expect(row?.json).toMatchObject({ name: 'VO2 5x4', source: 'ai' })
    expect(row?.json.folder).toBeUndefined()
    expect(await db().schedule.toArray()).toMatchObject([{ date: day, workoutId: applied.workouts[0]!.id, name: 'VO2 5x4' }])
    await undoSteps(applied.undo)
    expect(await db().workouts.count()).toBe(0)
    expect(await db().schedule.count()).toBe(0)
  })

  it('keeps a run in the sessions without a day, and plans a session with no steps', async () => {
    const run = await applyProposal(proposal({ type: 'create_workout', sport: 'run', name: 'Hill repeats', steps: '- 15m Z2 HR\n6x\n- 90s Z5 HR\n- 2m rest\n- 10m Z1 HR' }))
    expect(run.workouts).toMatchObject([{ name: 'Hill repeats', sport: 'run' }])
    expect(await db().sessionWorkouts.count()).toBe(1)
    expect(await db().schedule.count()).toBe(0)
    const squash = await applyProposal(proposal({ type: 'add_session', date: addDays(today, 1), sport: 'other', name: 'Squash', minutes: 60, effort: 'hard' }))
    expect(await db().schedule.toArray()).toMatchObject([{ name: 'Squash', sport: 'other', session: { durationS: 3600, effort: 'hard', load: 80 } }])
    await undoSteps(squash.undo)
    expect(await db().schedule.count()).toBe(0)
  })

  it("plans a library workout by name, and won't apply steps CrankHog can't read", async () => {
    const applied = await applyProposal(proposal({ type: 'schedule_workout', date: addDays(today, 1), workout: 'Sweet spot 3×12' }))
    expect(await db().schedule.toArray()).toMatchObject([{ workoutId: 'builtin:sweet-spot-3x12' }])
    await undoSteps(applied.undo)
    const bad = proposal({ type: 'create_workout', date: addDays(today, 1), sport: 'bike', name: 'Mystery', steps: '- twenty minutes hard' })
    expect((await checkProposal(bad, (d) => d)).problems[0]).toMatch(/^Mystery: /)
    await expect(applyProposal(bad)).rejects.toThrow(/Mystery/)
    expect(await db().workouts.count()).toBe(0)
  })

  it("changes a plan's session in the plan, and undo brings back the one it had", async () => {
    const { plan, thu } = await planOnCalendar()
    const applied = await applyProposal(proposal({ type: 'replace', ref: c(thu.id), sport: 'bike', name: 'Easy spin', steps: '', minutes: 45, effort: 'easy' }))
    const item = (await getPlan(plan.id))!.items[1]!
    expect(item.workoutId).toMatch(/^coach:/)
    expect((await db().workouts.get(item.workoutId))?.json).toMatchObject({ name: 'Easy spin', folder: 'plan', planId: plan.id })
    expect((await calendar()).at(-1)).toEqual([thu.date, 'Easy spin'])
    await undoSteps(applied.undo)
    expect((await getPlan(plan.id))!.items[1]!.workoutId).toBe('builtin:sweet-spot-3x12')
    expect((await calendar()).at(-1)).toEqual([thu.date, thu.name])
    expect(await db().workouts.count()).toBe(0)
  })

  it('swaps a ride planned by hand for a run on the same day', async () => {
    const e = await scheduleSession(addDays(today, 2), 'ride', 'Spin', { durationS: 3600, effort: 'easy' })
    const applied = await applyProposal(proposal({ type: 'replace', ref: c(e.id), sport: 'run', name: 'Easy run', steps: '- 40m Z2 HR' }))
    expect(await db().schedule.toArray()).toMatchObject([{ date: addDays(today, 2), name: 'Easy run', sport: 'run' }])
    await undoSteps(applied.undo)
    expect(await db().schedule.toArray()).toMatchObject([{ id: e.id, name: 'Spin' }])
    expect(await db().sessionWorkouts.count()).toBe(0)
  })
})

describe('days off, events, history and thresholds', () => {
  it('marks days off, which plans skip, and undo clears them', async () => {
    const { tue } = await planOnCalendar()
    const applied = await applyProposal(proposal({ type: 'days_off', kind: 'sick', from: tue.date, to: addDays(tue.date, 1), note: 'Head cold' }))
    expect((await db().dayMarks.orderBy('date').toArray()).map((m) => [m.date, m.kind])).toEqual([
      [tue.date, 'sick'],
      [addDays(tue.date, 1), 'sick'],
    ])
    // Tuesday's ride moves off the sick day
    expect((await calendar()).map(([d]) => d)).not.toContain(tue.date)
    await undoSteps(applied.undo)
    expect(await db().dayMarks.count()).toBe(0)
    expect((await calendar())[0]).toEqual([tue.date, tue.name])
  })

  it('moves a race, and a plan built to it follows; undo moves both back', async () => {
    const race = await addMark({ date: addDays(monday, 27), kind: 'event', name: 'Gran fondo', priority: 'A' })
    const p = await createPlan({ name: 'To the race', rideDays: [1, 3], startDate: monday, eventId: race.id, anchor: 'race' })
    await addToPlan(p.id, 'builtin:endurance-60')
    await putOnCalendar(p.id)
    const [first] = await calendar()
    const applied = await applyProposal(proposal({ type: 'change_event', ref: refOf('m', race.id), date: addDays(monday, 34) }))
    expect((await db().dayMarks.get(race.id))!.date).toBe(addDays(monday, 34))
    expect((await calendar())[0]![0]).toBe(addDays(first![0]!, 7))
    await undoSteps(applied.undo)
    expect((await db().dayMarks.get(race.id))!.date).toBe(addDays(monday, 27))
    expect((await calendar())[0]).toEqual(first)
  })

  it('logs an activity, and sets FTP and thresholds from today; undo takes them back', async () => {
    await recordFtp({ date: Date.now() - 86_400_000, ftpW: 250, source: 'manual' })
    const applied = await applyProposal(
      proposal(
        { type: 'log_activity', date: today, sport: 'other', name: 'Squash', minutes: 60, effort: 'hard' },
        { type: 'set_thresholds', ftpW: 262, lthr: 168, runThresholdPace: '4:30' },
      ),
    )
    expect(await db().activities.toArray()).toMatchObject([{ label: 'Squash', group: 'other', movingS: 3600, effort: 'hard', source: 'manual' }])
    expect((await currentFtp())?.ftpW).toBe(262)
    expect(await currentProfile()).toMatchObject({ lthr: 168, runThresholdPaceSPerKm: 270 })
    await undoSteps(applied.undo)
    expect(await db().activities.count()).toBe(0)
    expect((await currentFtp())?.ftpW).toBe(250)
    expect(await currentProfile()).toBeNull()
  })
})

describe('all or nothing', () => {
  it('undoes what it did when a later change fails', async () => {
    const { tue } = await planOnCalendar()
    const spy = vi.spyOn(marks, 'addMarks').mockRejectedValueOnce(new Error('The disk is full.'))
    const p = proposal({ type: 'add_session', date: addDays(today, 1), sport: 'other', name: 'Yoga', minutes: 30, effort: 'easy' }, { type: 'move', ref: c(tue.id), to: addDays(tue.date, 1) }, { type: 'days_off', kind: 'rest', from: today, to: today })
    await expect(applyProposal(p)).rejects.toThrow('The disk is full.')
    spy.mockRestore()
    expect(await calendar()).not.toContainEqual([addDays(today, 1), 'Yoga'])
    expect((await db().schedule.get(tue.id))?.date).toBe(tue.date)
  })

  it('checks again on Apply, and changes nothing when the calendar moved on', async () => {
    const { tue } = await planOnCalendar()
    const p = proposal({ type: 'add_session', date: addDays(today, 1), sport: 'other', name: 'Yoga', minutes: 30, effort: 'easy' }, { type: 'remove', ref: c(tue.id) })
    // the session is gone by the time the rider presses Apply
    await db().schedule.delete(tue.id)
    await expect(applyProposal(p)).rejects.toThrow(/no session/)
    expect((await db().schedule.toArray()).map((e) => e.name)).not.toContain('Yoga')
  })
})

describe('what the card shows', () => {
  it("each change's reason and its session before and after, with length and load, and warnings", async () => {
    await recordFtp({ date: 0, ftpW: 250, source: 'manual' })
    const e = await scheduleSession(addDays(today, 2), 'run', 'Run-walk 40', { durationS: 2400, load: 30, text: '8x\n- 4m Z2 HR\n- 1m Z1 HR walk' })
    const icu = await db().schedule.put({ id: 'icu-1', date: addDays(today, 3), workoutId: null, workout: null, name: 'Club run', source: 'intervals', sport: 'run', session: { durationS: 3600 }, createdAt: 1 })
    const checked = await checkProposal(
      proposal(
        { type: 'replace', ref: c(e.id), sport: 'bike', name: 'Spin instead', steps: '- 45m 60%', why: 'Your knee needs a break from running.' },
        { type: 'move', ref: c(icu), to: addDays(today, 4) },
      ),
      (d) => d,
    )
    expect(checked.problems).toEqual([])
    expect(checked.items[0]).toMatchObject({
      why: 'Your knee needs a break from running.',
      before: { name: 'Run-walk 40', sport: 'run', durationS: 2400, load: 30 },
      after: { name: 'Spin instead', sport: 'ride', durationS: 2700, load: expect.any(Number) },
    })
    expect(checked.items[1]).toMatchObject({ before: { name: 'Club run', durationS: 3600 } })
    expect(checked.items[1]!.after).toBeUndefined()
    expect(checked.warnings).toEqual(['Club run came from intervals.icu, and the next import puts it back as it is there. Change it on intervals.icu.'])
  })

  it('tags what the coach makes, so the rider can find it in the library', async () => {
    const bike = await applyProposal(proposal({ type: 'create_workout', sport: 'bike', name: 'Tempo', steps: '- 20m 80%' }))
    expect((await db().workouts.get(bike.workouts[0]!.id))?.json.tags).toContain('coach')
    const run = await applyProposal(proposal({ type: 'create_workout', sport: 'run', name: 'Strides', steps: '- 20m Z2 HR' }))
    expect((await db().sessionWorkouts.get(run.workouts[0]!.id))?.tags).toContain('coach')
  })
})

describe('intervals.icu follows', () => {
  const invoke = vi.fn()
  const puts = () => invoke.mock.calls.filter(([ch]) => ch === 'intervals.putWorkout').map(([, req]) => req as { eventId?: string; workout: { name: string; description: string } })
  const deletes = () => invoke.mock.calls.filter(([ch]) => ch === 'intervals.deleteWorkout').map(([, req]) => (req as { eventId: string }).eventId)
  beforeEach(() => {
    invoke.mockReset()
    // an update keeps its event; a new one gets a new id
    invoke.mockImplementation(async (ch: string, req: { eventId?: string }) => (ch === 'intervals.putWorkout' ? { eventId: req.eventId ?? 'ev-new' } : { ok: true }))
    window.crankhog = { invoke, on: () => () => undefined, send: () => undefined } as unknown as CrankHogBridge
  })

  it('sends a changed session again, and the old one after Undo', async () => {
    const e = await scheduleSession(addDays(today, 2), 'run', 'Run-walk 40', { durationS: 2400, text: '8x\n- 4m Z2 HR\n- 1m Z1 HR walk' })
    await db().schedule.update(e.id, { pushedEventId: 'ev-1' })
    const applied = await applyProposal(proposal({ type: 'replace', ref: c(e.id), sport: 'run', name: 'Easy run 40', steps: '- 40m Z2 HR' }))
    // the same entry, changed in place
    expect(await db().schedule.get(e.id)).toMatchObject({ name: 'Easy run 40', pushedEventId: 'ev-1' })
    expect(puts().at(-1)).toMatchObject({ eventId: 'ev-1', workout: { name: 'Easy run 40', description: '- 40m Z2 HR' } })
    await undoSteps(applied.undo)
    expect(puts().at(-1)).toMatchObject({ eventId: 'ev-1', workout: { name: 'Run-walk 40', description: expect.stringContaining('1m Z1 HR walk') } })
  })

  it('takes a removed session off there, and sends it anew after Undo', async () => {
    const e = await scheduleSession(addDays(today, 2), 'swim', 'Swim', { durationS: 1800, text: '- 1500mtr easy' })
    await db().schedule.update(e.id, { pushedEventId: 'ev-2' })
    const applied = await applyProposal(proposal({ type: 'remove', ref: c(e.id) }))
    await vi.waitFor(() => expect(deletes()).toEqual(['ev-2']))
    await undoSteps(applied.undo)
    expect(puts().at(-1)).toMatchObject({ workout: { name: 'Swim' } })
    expect(puts().at(-1)!.eventId).toBeUndefined()
    expect((await db().schedule.get(e.id))?.pushedEventId).toBe('ev-new')
  })

  it('takes a run that becomes a ride off there, and sends it anew after Undo', async () => {
    const e = await scheduleSession(addDays(today, 2), 'run', 'Easy run', { durationS: 2400, text: '- 40m Z2 HR' })
    await db().schedule.update(e.id, { pushedEventId: 'ev-4' })
    const applied = await applyProposal(proposal({ type: 'replace', ref: c(e.id), sport: 'bike', name: 'Spin', steps: '- 40m 60%' }))
    expect(deletes()).toEqual(['ev-4'])
    expect((await db().schedule.get(e.id))?.pushedEventId).toBeUndefined()
    await undoSteps(applied.undo)
    expect(puts().at(-1)!.eventId).toBeUndefined()
    expect(await db().schedule.get(e.id)).toMatchObject({ name: 'Easy run', pushedEventId: 'ev-new' })
  })

  it("sends nothing for a session that was never sent", async () => {
    const { thu } = await planOnCalendar()
    const applied = await applyProposal(proposal({ type: 'replace', ref: c(thu.id), sport: 'run', name: 'Easy run', steps: '- 30m Z2 HR' }))
    await undoSteps(applied.undo)
    expect(puts()).toEqual([])
  })

  it("sends a plan's changed session again", async () => {
    const { thu } = await planOnCalendar()
    // a run in the plan, sent to intervals.icu
    const swapped = await applyProposal(proposal({ type: 'replace', ref: c(thu.id), sport: 'run', name: 'Easy run', steps: '- 30m Z2 HR' }))
    await db().schedule.update(thu.id, { pushedEventId: 'ev-3' })
    invoke.mockClear()
    await applyProposal(proposal({ type: 'replace', ref: c(thu.id), sport: 'run', name: 'Steady run', steps: '- 40m Z3 HR' }))
    expect(puts().at(-1)).toMatchObject({ eventId: 'ev-3', workout: { name: 'Steady run', description: '- 40m Z3 HR' } })
    expect(swapped.undo.length).toBeGreaterThan(0)
  })
})
