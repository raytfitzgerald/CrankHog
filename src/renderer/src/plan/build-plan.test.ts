import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PlanSurvey } from '@core/workout/plan'
import { addDays, dateKey } from '@core/workout/schedule'
import type { CrankHogBridge } from '@shared/ipc/contract'
import { db } from '../db/db'
import { draftAiPlan, draftBuiltinPlan, PlanAiError, savePlanDraft } from './build-plan'

const today = dateKey(Date.now())
const monday = (() => {
  let d = addDays(today, 1)
  while (new Date(`${d}T12:00:00`).getDay() !== 1) d = addDays(d, 1)
  return d
})()
const survey: PlanSurvey = { hoursPerWeek: 6, rideDays: [1, 3, 5, 6], longDay: 6, goal: 'event', focus: 'general', startDate: monday }
const invoke = vi.fn()

beforeEach(async () => {
  await db().delete()
  await db().open()
  invoke.mockReset()
  window.crankhog = { invoke, on: () => () => undefined, send: () => undefined } as unknown as CrankHogBridge
})

describe('draftBuiltinPlan and savePlanDraft', () => {
  it('builds a plan to the event from CrankHog workouts, and puts it on the calendar with the event', async () => {
    const event = addDays(monday, 69)
    const draft = await draftBuiltinPlan({ survey, weeks: 10, toEvent: true })
    expect(draft.source).toBe('builtin')
    expect(draft.picks.flat().every((p) => p !== null)).toBe(true)
    const plan = await savePlanDraft(draft, { name: 'Gran fondo plan', survey, event: { name: 'Gran fondo', date: event, priority: 'A' } })
    expect(plan).toMatchObject({ name: 'Gran fondo plan', onCalendar: true, source: 'builtin', rideDays: [1, 3, 5, 6] })
    const marks = await db().dayMarks.toArray()
    expect(marks).toEqual([expect.objectContaining({ kind: 'event', name: 'Gran fondo', date: event })])
    expect(plan.eventId).toBe(marks[0]!.id)
    const entries = await db().schedule.toArray()
    // ten weeks of four rides, less the Sunday long ride that would fall on race day
    expect(draft.picks.flat()).toHaveLength(40)
    expect(entries).toHaveLength(39)
    expect(entries.every((e) => e.date >= monday && e.date < event)).toBe(true)
    // the first workout is the ramp test
    expect(entries.sort((a, b) => a.date.localeCompare(b.date))[0]!.workoutId).toBe('builtin:ramp-test')
  })
})

describe('savePlanDraft when something fails', () => {
  it('takes back the plan and the event, so trying again makes only one', async () => {
    const draft = await draftBuiltinPlan({ survey, weeks: 4, toEvent: true })
    // a built-in can't be saved as the rider's own: the save fails after the plan and event are made
    const broken = { ...draft, written: [{ id: 'builtin:x', name: 'x', tags: [], sportType: 'bike', source: 'builtin', segments: [] } as never] }
    const event = { name: 'Race', date: addDays(monday, 27), priority: 'A' as const }
    await expect(savePlanDraft(broken, { name: 'P', survey, event })).rejects.toThrow(/read-only/)
    expect([await db().plans.count(), await db().dayMarks.count(), await db().schedule.count()]).toEqual([0, 0, 0])
    await savePlanDraft(draft, { name: 'P', survey, event })
    expect([await db().plans.count(), await db().dayMarks.count()]).toEqual([1, 1])
  })
})

const generated = {
  name: 'Big gear sprints',
  description: 'Short sprints in a big gear.',
  tags: ['anaerobic'],
  segments: [
    { kind: 'ramp', role: 'warmup', durationS: 600, from: 0.5, to: 0.75 },
    { kind: 'intervals', repeat: 10, onS: 20, onPower: 1.8, offS: 160, offPower: 0.55 },
    { kind: 'steady', durationS: 9000, power: 0.65 },
    { kind: 'ramp', role: 'cooldown', durationS: 600, from: 0.6, to: 0.4 },
  ],
  cues: [],
}

describe('draftAiPlan', () => {
  it('asks the AI for the outline, fills it from the library, and has the AI write what nothing fits', async () => {
    invoke.mockImplementation(async (channel: string, req: { purpose: string; input: string }) => {
      if (channel !== 'ai.structured') throw new Error(channel)
      if (req.purpose === 'training-plan') {
        // the survey and the week count reach the AI
        expect(req.input).toContain('"hoursPerWeek":6')
        expect(req.input).toContain('"weeks":2')
        return {
          ok: true,
          value: {
            weeks: [
              { phase: 'build', sessions: [{ day: 1, type: 'threshold', minutes: 60, intent: 'FTP intervals' }, { day: 2, type: 'endurance', minutes: 60, intent: 'not a ride day' }] },
              { phase: 'build', sessions: [{ day: 3, type: 'anaerobic', minutes: 210, intent: 'Long sprint session' }] },
              { phase: 'base', sessions: [{ day: 1, type: 'endurance', minutes: 60, intent: 'one week too many' }] },
            ],
          },
        }
      }
      return { ok: true, value: generated }
    })
    const draft = await draftAiPlan({ survey, weeks: 2, toEvent: false })
    expect(draft.source).toBe('ai')
    // trimmed to the weeks asked for, and to the rider's ride days
    expect(draft.skeleton.weeks.map((w) => w.sessions.map((s) => s.day))).toEqual([[1], [3]])
    expect(draft.written.map((w) => w.name)).toEqual(['Big gear sprints'])
    expect(draft.picks[1]![0]).toBe(draft.written[0]!.id)
    const plan = await savePlanDraft(draft, { name: 'AI plan', survey })
    expect((await db().workouts.get(draft.written[0]!.id))?.json).toMatchObject({ source: 'ai', folder: 'plan', planId: plan.id })
  })

  it('plans an event more than 26 weeks off: base by CrankHog’s rules first, then the AI’s weeks ending at the event', async () => {
    const aiWeek = (phase: string) => ({ phase, sessions: [{ day: 1, type: phase === 'taper' ? 'vo2max' : 'threshold', minutes: 60, intent: 'Work' }] })
    invoke.mockImplementation(async (_channel: string, req: { purpose: string; input: string }) => {
      if (req.purpose !== 'training-plan') return { ok: false, error: 'no workouts in this test' }
      // the AI plans the last 26 weeks, knowing about the 13 before them
      expect(req.input).toContain('"weeks":26')
      expect(req.input).toContain('"baseWeeksBefore":13')
      return { ok: true, value: { weeks: [...Array.from({ length: 25 }, () => aiWeek('build')), aiWeek('taper')] } }
    })
    const draft = await draftAiPlan({ survey, weeks: 39, toEvent: true })
    expect(draft.skeleton.weeks).toHaveLength(39)
    expect(draft.skeleton.weeks.slice(0, 13).every((w) => w.phase === 'base' || w.phase === 'recovery')).toBe(true)
    expect(draft.skeleton.weeks[0]!.sessions[0]!.type).toBe('test')
    expect(draft.skeleton.weeks.at(-1)!.phase).toBe('taper')

    // an AI that answers short still ends at the event: more base before it
    invoke.mockImplementation(async (_channel: string, req: { purpose: string }) => (req.purpose === 'training-plan' ? { ok: true, value: { weeks: [aiWeek('build'), aiWeek('taper')] } } : { ok: false }))
    const short = await draftAiPlan({ survey, weeks: 10, toEvent: true })
    expect(short.skeleton.weeks.map((w) => w.phase).slice(-4)).toEqual(['base', 'recovery', 'build', 'taper'])
    expect(short.skeleton.weeks).toHaveLength(10)
  })

  it('says what went wrong when the AI fails or answers with nonsense', async () => {
    invoke.mockResolvedValueOnce({ ok: false, error: 'No AI provider is set up', code: 'not-configured' })
    await expect(draftAiPlan({ survey, weeks: 4, toEvent: false })).rejects.toThrow(PlanAiError)
    invoke.mockResolvedValueOnce({ ok: true, value: { weeks: [{ phase: 'base', sessions: [{ day: 9, type: 'yoga' }] }] } })
    await expect(draftAiPlan({ survey, weeks: 4, toEvent: false })).rejects.toThrow(/didn't make sense/)
  })
})
