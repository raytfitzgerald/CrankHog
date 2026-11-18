import { describe, expect, it } from 'vitest'
import { planDoc, type McpPlan } from './plan'

const TODAY = '2026-11-18'
const bike = (date: string, name = 'Endurance'): McpPlan['sessions'][number] => ({ date, sport: 'bike', name, steps: '- 10m ramp 50-70%\n- 40m 65%\n- 10m ramp 65-45%' })

describe('a plan Claude writes', () => {
  it('becomes a dated document that starts on its first Monday', () => {
    const r = planDoc({ name: 'Base', sessions: [bike('2026-11-26'), { date: '2026-11-24', sport: 'run', name: 'Easy run', minutes: 40, effort: 'easy' }] }, TODAY)
    expect(r.problems).toEqual([])
    expect(r.start).toBe('2026-11-23')
    expect(r.raceDate).toBeUndefined()
    expect(r.doc.items.map((i) => [i.date, i.sport, i.name])).toEqual([
      ['2026-11-26', 'bike', 'Endurance'],
      ['2026-11-24', 'run', 'Easy run'],
    ])
    expect(r.doc.items[1]).toMatchObject({ steps: '', minutes: 40, effort: 'easy' })
  })

  it('carries the race', () => {
    const r = planDoc({ name: 'IM', race: { name: 'Ironman Barcelona', date: '2027-07-25' }, sessions: [bike('2026-11-30')] }, TODAY)
    expect(r.problems).toEqual([])
    expect(r.raceDate).toBe('2027-07-25')
    expect(r.doc.race).toEqual({ name: 'Ironman Barcelona', date: '2027-07-25' })
  })

  it("refuses days that aren't days, have passed, and sessions with nothing in them", () => {
    const r = planDoc(
      {
        name: 'Bad',
        race: { name: 'Old race', date: '2026-11-01' },
        sessions: [bike('2026-02-30'), bike('2026-11-10'), { date: '2026-11-20', sport: 'other', name: 'Gym' }],
      },
      TODAY,
    )
    expect(r.problems).toHaveLength(4)
    expect(r.problems.join(' ')).toMatch(/isn't after today/)
    expect(r.problems.join(' ')).toMatch(/"2026-02-30" isn't a day/)
    expect(r.problems.join(' ')).toMatch(/that day has passed/)
    expect(r.problems.join(' ')).toMatch(/give it steps, or minutes and an effort/)
  })

  it('refuses a plan longer than the import takes', () => {
    const r = planDoc({ name: 'Forever', sessions: [bike('2026-11-23'), bike('2029-01-01')] }, TODAY)
    expect(r.problems.join(' ')).toMatch(/at most 104 weeks/)
  })
})
