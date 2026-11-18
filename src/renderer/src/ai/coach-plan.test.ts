import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PlanOutlineOutput, PlanWeeksOutput } from '@core/ai/schemas'
import { addDays, dateKey } from '@core/workout/schedule'
import type { CrankHogBridge } from '@shared/ipc/contract'
import { db } from '../db/db'
import { acceptDraft, clearDrafts, currentDraft, draftForCoach, draftNote, loadDrafts, settled, startDraft, startRevision, undoAccept } from './coach-plan'

const today = dateKey(Date.now())
const monday = (() => {
  let d = addDays(today, 1)
  while (new Date(`${d}T12:00:00`).getDay() !== 1) d = addDays(d, 1)
  return d
})()
const race = addDays(monday, 20) // the Sunday of week 3

const brief = (over: Record<string, unknown> = {}) => ({
  name: 'Sprint tri',
  race: { name: 'Lakeside sprint', date: race, kind: 'sprint triathlon (750 m swim, 20 km bike, 5 km run)' },
  startDate: monday,
  sports: ['swim', 'bike', 'run', 'other'],
  hoursPerWeek: { start: 5, peak: 6 },
  days: [
    { weekday: 1, maxMinutes: 75 },
    { weekday: 3, maxMinutes: 60 },
    { weekday: 5, maxMinutes: 120 },
    { weekday: 6, maxMinutes: 90 },
  ],
  longRideDay: 5,
  longRunDay: 6,
  athlete: 'New to triathlon, runs well, swims in a 25 m pool.',
  ...over,
})

const outline = (weeks: number, swim = 1.5): PlanOutlineOutput => ({
  notes: 'Two build weeks, then race week.',
  weeks: Array.from({ length: weeks }, (_, i) => ({ week: i + 1, phase: i === weeks - 1 ? 'taper' : 'build', focus: 'Race fitness', hours: { swim, bike: 2, run: 1.5, other: 0.5 }, keySessions: ['Brick'] })),
})

/** A week's sessions, as the fake planner writes them: a swim, a ride, a run, strength, and on request a broken ride. */
const weekItems = (week: number, swimName = 'CSS 8x100', broken = false): PlanWeeksOutput['items'] => [
  { week, weekday: 1, sport: 'swim', name: swimName, steps: 'Main set 8x\n- 100mtr 1:50/100m Pace\n- 15s rest', minutes: null, effort: null, notes: null },
  { week, weekday: 3, sport: 'run', name: 'Tempo run', steps: '- 10m Z2 HR\n- 20m Z3 HR\n- 10m Z1 HR', minutes: null, effort: null, notes: 'Smooth, not hard.' },
  { week, weekday: 5, sport: 'bike', name: broken ? 'Broken ride' : 'Long ride', steps: broken ? '- ninety minutes steady' : '- 10m ramp 50-70%\n- 80m 68%\n- 10m 50%', minutes: null, effort: null, notes: null },
  { week, weekday: 6, sport: 'other', name: 'Core', steps: '', minutes: 20, effort: 'easy', notes: null },
]

const invoke = vi.fn()
const sent: { purpose: string; input: string }[] = []
/** The fake provider: outlines, then writes each block's weeks. `swim` names the swims; week 2's ride is broken once when `broken`. */
function planner(opts: { swim?: string; swimHours?: number; broken?: boolean } = {}) {
  let brokenOnce = opts.broken ?? false
  invoke.mockImplementation(async (channel: string, req: { purpose: string; input: string }) => {
    if (channel !== 'ai.structured') return { ok: true }
    sent.push(req)
    if (req.purpose === 'plan-outline') return { ok: true, value: outline(3, opts.swimHours) }
    if (req.input.includes("couldn't be read")) return { ok: true, value: { items: weekItems(2).filter((i) => i.sport === 'bike') } }
    const m = /Write every session of (?:week (\d+)|weeks (\d+) to (\d+))/.exec(req.input)!
    const [a, b] = m[1] ? [Number(m[1]), Number(m[1])] : [Number(m[2]), Number(m[3])]
    const items = []
    for (let w = a; w <= b; w++) {
      items.push(...weekItems(w, opts.swim, brokenOnce && w === 2))
    }
    brokenOnce = false
    return { ok: true, value: { items } }
  })
}

beforeEach(async () => {
  await db().delete()
  await db().open()
  await clearDrafts()
  invoke.mockReset()
  sent.length = 0
  window.crankhog = { invoke, on: () => () => undefined, send: () => undefined } as unknown as CrankHogBridge
})

describe('drafting a plan', () => {
  it('outlines it, writes the weeks, mends a session it could not read, and saves nothing', async () => {
    planner({ broken: true })
    const started = startDraft(brief())
    if ('error' in started) throw new Error(started.error)
    const r = await settled(started.id)
    expect(r.status).toBe('ready')
    expect(sent.map((s) => s.purpose)).toEqual(['plan-outline', 'plan-weeks', 'plan-weeks'])
    // the planner is told the race, the days and the week dates; the rider's name isn't anywhere
    expect(sent[0]!.input).toContain(`Race: Lakeside sprint, sprint triathlon (750 m swim, 20 km bike, 5 km run), on ${race} (Sunday), in week 3.`)
    expect(sent[1]!.input).toContain(`Write every session of weeks 1 to 3 (week 1 starts Monday ${monday};`)
    expect(sent[2]!.input).toContain('"name":"Broken ride"')
    expect(r.draft!.items.map((i) => i.name)).not.toContain('Broken ride')
    expect(r.draft!.items.filter((i) => i.week === 2).map((i) => i.name)).toEqual(['CSS 8x100', 'Tempo run', 'Long ride', 'Core'])
    expect(await db().plans.count()).toBe(0)
    expect(await db().schedule.count()).toBe(0)
    expect(draftNote(started.id)).toContain('is ready and shown to the rider')
    expect(draftForCoach()).toMatchObject({ name: 'Sprint tri', weeks: 3, outline: [{ week: 1, sessions: expect.stringContaining('Tue swim CSS 8x100') }, {}, {}] })
  })

  it('refuses a brief that is no plan, and fails plainly when the AI does', async () => {
    expect(startDraft(brief({ race: { name: 'x', date: '2020-01-01', kind: 'x' } }))).toMatchObject({ error: expect.stringContaining("isn't after today") })
    invoke.mockResolvedValue({ ok: false, error: 'Anthropic rejected the API key', code: 'auth' })
    const started = startDraft(brief()) as { id: string }
    expect(await settled(started.id)).toMatchObject({ status: 'failed', error: 'Anthropic rejected the API key' })
    expect(currentDraft()).toBeUndefined()
  })

  it('forgets a draft for good when the chat is cleared while it is being written', async () => {
    planner()
    const started = startDraft(brief()) as { id: string }
    await clearDrafts()
    await vi.waitFor(() => expect(sent.filter((x) => x.purpose === 'plan-weeks')).toHaveLength(1))
    await new Promise((resolve) => setTimeout(resolve, 30))
    expect(draftNote(started.id)).toBeNull()
    expect(currentDraft()).toBeUndefined()
  })

  it('marks a draft that was being written when CrankHog closed as stopped', async () => {
    await db().kv.put({ key: 'coach.plan-drafts', value: { d1: { id: 'd1', version: 1, name: 'Old', status: 'drafting', createdAt: 1 } } })
    await loadDrafts()
    expect(draftNote('d1')).toBe('Drafting the plan "Old" failed: Drafting stopped when CrankHog closed. Ask the coach to draft it again.')
  })
})

describe('revising a draft', () => {
  it('rewrites only the weeks whose outline changed, and replaces the draft once it is written', async () => {
    planner()
    const first = startDraft(brief()) as { id: string }
    await settled(first.id)
    // the rider is away in week 2: the outline changes only there
    invoke.mockImplementation(async (_c: string, req: { purpose: string; input: string }) => {
      sent.push(req)
      if (req.purpose === 'plan-outline') {
        const o = outline(3)
        o.weeks[1] = { ...o.weeks[1]!, focus: 'Away: easy running only', hours: { swim: 0, bike: 0, run: 2, other: 0 } }
        return { ok: true, value: o }
      }
      return { ok: true, value: { items: [{ week: 2, weekday: 3, sport: 'run', name: 'Hotel run', steps: '- 40m Z2 HR', minutes: null, effort: null, notes: null }] } }
    })
    sent.length = 0
    const second = startRevision({ feedback: "I'm away in week 2, running only", weeks: [2] }) as { id: string }
    const r = await settled(second.id)
    expect(r).toMatchObject({ status: 'ready', version: 2 })
    expect(sent.map((s) => s.purpose)).toEqual(['plan-outline', 'plan-weeks'])
    expect(sent[0]!.input).toContain("The rider's feedback: I'm away in week 2, running only")
    expect(sent[1]!.input).toContain('Write every session of week 2 (')
    expect(sent[1]!.input).toContain('"name":"Tempo run"')
    expect(r.draft!.items.filter((i) => i.week === 2).map((i) => i.name)).toEqual(['Hotel run'])
    expect(r.draft!.items.filter((i) => i.week === 1)).toHaveLength(4)
    expect(draftNote(first.id)).toContain('was replaced by a revision')
    expect(currentDraft()?.id).toBe(second.id)
  })

  it('rewrites every week when the feedback changes the whole plan, and keeps the old draft if the revision fails', async () => {
    planner()
    const first = startDraft(brief()) as { id: string }
    await settled(first.id)
    planner({ swim: 'Easy swim', swimHours: 0.75 })
    sent.length = 0
    const second = startRevision({ feedback: 'Less swimming', brief: brief({ longRideDay: 6, longRunDay: 5 }) }) as { id: string }
    const r = await settled(second.id)
    expect(sent.map((s) => s.purpose)).toEqual(['plan-outline', 'plan-weeks'])
    expect(r.draft!.items.filter((i) => i.sport === 'swim').every((i) => i.name === 'Easy swim')).toBe(true)
    invoke.mockResolvedValue({ ok: false, error: 'Could not reach Anthropic', code: 'network' })
    const third = startRevision({ feedback: 'More running' }) as { id: string }
    expect(await settled(third.id)).toMatchObject({ status: 'failed' })
    expect(currentDraft()?.id).toBe(second.id)
  })

  it('has nothing to revise before a draft', () => {
    expect(startRevision({ feedback: 'less swimming' })).toEqual({ error: 'There is no draft to revise. Ask the coach to draft the plan first.' })
  })
})

describe('accepting a draft', () => {
  it('saves it as a plan built to the race, every session on its day, and undo takes it all back', async () => {
    planner()
    const started = startDraft(brief()) as { id: string }
    await settled(started.id)
    const r = await acceptDraft(started.id)
    expect(r.status).toBe('accepted')
    const plan = (await db().plans.get(r.accepted!.planId))!
    expect(plan).toMatchObject({ name: 'Sprint tri', anchor: 'race', onCalendar: true, source: 'files' })
    const event = (await db().dayMarks.get(plan.eventId!))!
    expect(event).toMatchObject({ date: race, kind: 'event', name: 'Lakeside sprint', priority: 'A' })
    // every session on the day the draft has it: Tuesday swims, Thursday runs, Saturday rides, Sunday strength
    const entries = (await db().schedule.toArray()).sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt)
    expect(entries.map((e) => [e.date, e.sport ?? 'ride', e.name])).toEqual(
      [0, 7, 14].flatMap((w) => [
        [addDays(monday, w + 1), 'swim', 'CSS 8x100'],
        [addDays(monday, w + 3), 'run', 'Tempo run'],
        [addDays(monday, w + 5), 'ride', 'Long ride'],
        // race day is the race's: no strength on it
        ...(w < 14 ? [[addDays(monday, w + 6), 'other', 'Core']] : []),
      ]),
    )
    // the ride is a real ERG workout, filed in the plan; the rest are sessions with steps
    const ride = entries.find((e) => e.name === 'Long ride')!
    expect((await db().workouts.get(ride.workoutId!))?.json).toMatchObject({ folder: 'plan', planId: plan.id })
    expect(await db().sessionWorkouts.count()).toBe(3)
    expect(r.accepted).toMatchObject({ sessions: 11, first: addDays(monday, 1), last: addDays(monday, 19) })
    expect(draftNote(started.id)).toContain('accepted draft 1')
    expect(draftForCoach()).toBeUndefined()

    await undoAccept(started.id)
    expect(await db().plans.count()).toBe(0)
    expect(await db().schedule.count()).toBe(0)
    expect(await db().dayMarks.count()).toBe(0)
    expect(await db().workouts.count()).toBe(0)
    expect(await db().sessionWorkouts.count()).toBe(0)
    expect(currentDraft()?.id).toBe(started.id)
  })

  it('builds to the race already on the calendar rather than a copy, and keeps it on undo', async () => {
    planner()
    await db().dayMarks.put({ id: 'm1', date: race, kind: 'event', name: 'Lakeside sprint', priority: 'B' })
    const started = startDraft(brief()) as { id: string }
    await settled(started.id)
    const r = await acceptDraft(started.id)
    expect((await db().plans.get(r.accepted!.planId))!.eventId).toBe('m1')
    await undoAccept(started.id)
    expect(await db().dayMarks.get('m1')).toBeDefined()
  })

  it('keeps drafts across a restart', async () => {
    planner()
    const started = startDraft(brief()) as { id: string }
    await settled(started.id)
    await new Promise((resolve) => setTimeout(resolve, 20))
    const kept = (await db().kv.get('coach.plan-drafts'))?.value as Record<string, { status: string }>
    expect(kept[started.id]?.status).toBe('ready')
    await loadDrafts()
    expect(currentDraft()?.id).toBe(started.id)
  })
})
