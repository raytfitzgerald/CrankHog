import { describe, expect, it } from 'vitest'
import { AI_SCHEMAS, PlanImportSchema, PlanSkeletonSchema } from './schemas'

const ok = { weeks: [{ phase: 'base', sessions: [{ day: 1, type: 'sweet-spot', minutes: 75, intent: 'Sweet spot 3x15' }] }] }

describe('PlanSkeletonSchema', () => {
  it('accepts a plan outline: weeks of typed sessions', () => {
    expect(PlanSkeletonSchema.parse(ok)).toEqual(ok)
    expect(AI_SCHEMAS['training-plan']).toBe(PlanSkeletonSchema)
  })

  it.each([
    ['an unknown session type', { weeks: [{ phase: 'base', sessions: [{ day: 1, type: 'crossfit', minutes: 60, intent: '' }] }] }],
    ['a weekday past Sunday', { weeks: [{ phase: 'base', sessions: [{ day: 7, type: 'endurance', minutes: 60, intent: '' }] }] }],
    ['a session of 8 hours', { weeks: [{ phase: 'base', sessions: [{ day: 1, type: 'endurance', minutes: 480, intent: '' }] }] }],
    ['no weeks', { weeks: [] }],
    ['a year of weeks', { weeks: Array.from({ length: 53 }, () => ok.weeks[0]) }],
    ['eight sessions in a week', { weeks: [{ phase: 'build', sessions: Array.from({ length: 8 }, () => ok.weeks[0]!.sessions[0]) }] }],
  ])('rejects %s', (_label, value) => {
    expect(PlanSkeletonSchema.safeParse(value).success).toBe(false)
  })
})

const planDoc = {
  planName: '70.3 plan',
  raceName: null,
  raceDate: '2027-04-03',
  startDate: null,
  countdown: null,
  items: [{ date: null, week: 1, weekday: 1, sport: 'run', name: 'Easy run', steps: '- 40m Z2 HR', minutes: null, effort: null, notes: null }],
  skipped: [],
}

describe('PlanImportSchema', () => {
  it('accepts a plan document read into sessions, and is the plan-import purpose’s schema', () => {
    expect(PlanImportSchema.parse(planDoc)).toEqual(planDoc)
    expect(AI_SCHEMAS['plan-import']).toBe(PlanImportSchema)
  })

  it('takes values it can’t use as they come, so one odd session never fails a part: CrankHog checks each session itself', () => {
    const odd = {
      ...planDoc,
      planName: 'x'.repeat(500),
      raceDate: 'next spring',
      items: [
        { ...planDoc.items[0]!, date: 'Tuesday', week: 400 },
        { ...planDoc.items[0]!, sport: 'rowing', weekday: 7, effort: 'tempo', name: 'x'.repeat(500), steps: '- 1m\n'.repeat(2000) },
        ...Array.from({ length: 450 }, () => planDoc.items[0]!),
      ],
      skipped: Array.from({ length: 150 }, () => ({ text: 'x', reason: 'y' })),
    }
    expect(PlanImportSchema.safeParse(odd).success).toBe(true)
  })

  it.each([
    ['a field left out rather than null', { ...planDoc, items: [{ ...planDoc.items[0]!, notes: undefined }] }],
    ['no skipped list', { ...planDoc, skipped: undefined }],
  ])('rejects %s', (_label, value) => {
    expect(PlanImportSchema.safeParse(value).success).toBe(false)
  })
})
