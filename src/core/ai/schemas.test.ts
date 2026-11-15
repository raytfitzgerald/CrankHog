import { describe, expect, it } from 'vitest'
import { AI_SCHEMAS, PlanSkeletonSchema } from './schemas'

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
