import { describe, expect, it } from 'vitest'
import type { PlanSurvey } from './plan'
import { baseSkeleton, builtinSkeleton, closestAnyLength, fillSkeleton, fromStart, planWeeks, skeletonDates, type LibraryCandidate, type PlanSkeleton } from './plan-builder'

// 16 Nov 2026 is a Monday.
const survey = (over: Partial<PlanSurvey> = {}): PlanSurvey => ({
  hoursPerWeek: 6,
  rideDays: [1, 3, 5, 6],
  longDay: 6,
  goal: 'event',
  focus: 'general',
  startDate: '2026-11-16',
  ...over,
})

describe('planWeeks', () => {
  it('counts the weeks from the start to the event, a part week included', () => {
    expect(planWeeks('2026-11-16', '2027-01-24')).toBe(10)
    expect(planWeeks('2026-11-16', '2027-01-25')).toBe(10)
    expect(planWeeks('2026-11-16', '2027-01-26')).toBe(11)
    expect(planWeeks('2026-11-16', '2026-11-18')).toBe(1)
  })
})

describe('builtinSkeleton', () => {
  it('builds a 10-week plan to an event: base, a recovery week, build, specialty, then a taper', () => {
    const s = builtinSkeleton(survey(), 10, true)
    expect(s.weeks.map((w) => w.phase)).toEqual(['base', 'base', 'base', 'recovery', 'build', 'build', 'specialty', 'specialty', 'specialty', 'taper'])
  })

  it('spreads the weekly hours over the ride days, with the long ride on its day', () => {
    const [week1, week2] = builtinSkeleton(survey(), 10, true).weeks
    // 6 h: the long ride gets about a third, the other three days share the rest (rounded to 15 min)
    expect(week2!.sessions.map((x) => [x.day, x.type, x.minutes])).toEqual([
      [1, 'sweet-spot', 75],
      [3, 'endurance', 75],
      [5, 'tempo', 75],
      [6, 'long', 120],
    ])
    // the plan opens with a ramp test, to size every workout after it
    expect(week1!.sessions[0]).toMatchObject({ day: 1, type: 'test' })
  })

  it('starts a mid-week plan on its start day, still with the ramp test first', () => {
    // a Wednesday start: Tuesday's ride is not in the plan, and the test moves to Thursday
    const s = builtinSkeleton(survey({ startDate: '2026-11-18' }), 10, true)
    expect(s.weeks[0]!.sessions.map((x) => [x.day, x.type])).toEqual([
      [3, 'test'],
      [5, 'tempo'],
      [6, 'long'],
    ])
    expect(skeletonDates(s, '2026-11-18')[0]).toEqual({ date: '2026-11-19', week: 0, session: 0 })
  })

  it('makes recovery weeks lighter and easy, and the taper lighter still with one sharp session', () => {
    const s = builtinSkeleton(survey(), 10, true)
    const recovery = s.weeks[3]!
    expect(recovery.sessions.map((x) => x.type)).toEqual(['recovery', 'recovery', 'recovery', 'endurance'])
    expect(recovery.sessions.reduce((t, x) => t + x.minutes, 0)).toBe(210)
    const taper = s.weeks[9]!
    expect(taper.sessions.filter((x) => x.type === 'vo2max')).toHaveLength(1)
    expect(taper.sessions.reduce((t, x) => t + x.minutes, 0)).toBeLessThan(200)
  })

  it('follows the goal: threshold and VO2 work to raise FTP, steadier work for endurance', () => {
    const ftp = builtinSkeleton(survey({ goal: 'ftp' }), 8, false)
    expect(ftp.weeks.map((w) => w.phase)).toEqual(['base', 'base', 'base', 'recovery', 'build', 'build', 'build', 'recovery'])
    expect(ftp.weeks[4]!.sessions.filter((x) => x.type !== 'endurance' && x.type !== 'long').map((x) => x.type)).toEqual(['threshold', 'vo2max'])
    const endurance = builtinSkeleton(survey({ goal: 'endurance' }), 8, false)
    expect(endurance.weeks.every((w) => w.phase === 'base' || w.phase === 'recovery')).toBe(true)
    expect(endurance.weeks[1]!.sessions.map((x) => x.type)).toEqual(['tempo', 'endurance', 'endurance', 'long'])
  })

  it('tilts the specialty block to the event', () => {
    const crit = builtinSkeleton(survey({ focus: 'criterium' }), 10, true)
    expect(crit.weeks[6]!.sessions.map((x) => x.type)).toEqual(['anaerobic', 'endurance', 'vo2max', 'long'])
    const climb = builtinSkeleton(survey({ focus: 'climbing' }), 10, true)
    expect(climb.weeks[6]!.sessions.map((x) => x.type)).toEqual(['threshold', 'endurance', 'sweet-spot', 'long'])
  })

  it('copes with an event a week away, and with one ride day', () => {
    expect(builtinSkeleton(survey(), 1, true).weeks.map((w) => w.phase)).toEqual(['taper'])
    const one = builtinSkeleton(survey({ rideDays: [2], longDay: null, goal: 'ftp' }), 4, false)
    expect(one.weeks[1]!.sessions).toEqual([expect.objectContaining({ day: 2, type: 'sweet-spot', minutes: 300 })])
  })

  it('has no sessions without ride days', () => {
    expect(builtinSkeleton(survey({ rideDays: [] }), 4, false).weeks.every((w) => w.sessions.length === 0)).toBe(true)
  })
})

describe('skeletonDates', () => {
  it('turns week and weekday into calendar days from the start, dropping days before it', () => {
    const s: PlanSkeleton = { weeks: [{ phase: 'base', sessions: [{ day: 0, type: 'endurance', minutes: 60, intent: '' }, { day: 3, type: 'tempo', minutes: 60, intent: '' }] }, { phase: 'base', sessions: [{ day: 0, type: 'endurance', minutes: 60, intent: '' }] }] }
    expect(skeletonDates(s, '2026-11-16').map((x) => x.date)).toEqual(['2026-11-16', '2026-11-19', '2026-11-23'])
    // starting on a Wednesday: that week's Monday is already gone
    expect(skeletonDates(s, '2026-11-18').map((x) => x.date)).toEqual(['2026-11-19', '2026-11-23'])
  })
})

describe('fillSkeleton', () => {
  const lib: LibraryCandidate[] = [
    { id: 'end-60', tags: ['endurance'], durationS: 3600 },
    { id: 'end-120', tags: ['endurance'], durationS: 7200 },
    { id: 'ss-60', tags: ['sweet-spot'], durationS: 3700 },
    { id: 'ss-75', tags: ['sweet-spot'], durationS: 4500 },
    { id: 'bird', tags: ['vo2max', 'fun'], durationS: 3600 },
    { id: 'vo2-60', tags: ['vo2max'], durationS: 3600 },
    { id: 'ramp', tags: ['test', 'ftp'], durationS: 1800, ftpTest: 'ramp' },
  ]
  const week = (...sessions: [PlanSkeleton['weeks'][number]['sessions'][number]['type'], number][]): PlanSkeleton['weeks'][number] => ({
    phase: 'base',
    sessions: sessions.map(([type, minutes], day) => ({ day, type, minutes, intent: '' })),
  })

  it('picks the closest workout of the right kind, never a rude one', () => {
    const r = fillSkeleton({ weeks: [week(['sweet-spot', 75], ['long', 120], ['vo2max', 60], ['test', 45])] }, lib)
    expect(r.picks).toEqual([['ss-75', 'end-120', 'vo2-60', 'ramp']])
    expect(r.unfilled).toEqual([])
  })

  it('varies the pick week to week when two fit as well', () => {
    const r = fillSkeleton({ weeks: [week(['sweet-spot', 68]), week(['sweet-spot', 68])] }, lib)
    expect(new Set(r.picks.flat()).size).toBe(2)
  })

  it('leaves a session open, for AI to write, when nothing is close enough', () => {
    const r = fillSkeleton({ weeks: [week(['threshold', 60], ['sweet-spot', 180])] }, lib)
    expect(r.picks).toEqual([[null, null]])
    expect(r.unfilled).toEqual([
      { week: 0, session: 0 },
      { week: 0, session: 1 },
    ])
  })
})

describe('closestAnyLength', () => {
  const lib: LibraryCandidate[] = [
    { id: 'ss-60', tags: ['sweet-spot'], durationS: 3600 },
    { id: 'end-90', tags: ['endurance'], durationS: 5400 },
    { id: 'rude', tags: ['threshold', 'fun'], durationS: 3600 },
  ]
  it('takes the closest workout of the kind whatever its length, else the closest endurance ride', () => {
    expect(closestAnyLength({ day: 0, type: 'sweet-spot', minutes: 180, intent: '' }, lib)).toBe('ss-60')
    expect(closestAnyLength({ day: 0, type: 'threshold', minutes: 60, intent: '' }, lib)).toBe('end-90')
    expect(closestAnyLength({ day: 0, type: 'threshold', minutes: 60, intent: '' }, [])).toBeNull()
  })
})

describe('baseSkeleton and fromStart', () => {
  it('rides base with a recovery week every fourth, opening with a ramp test', () => {
    const s = baseSkeleton(survey(), 5)
    expect(s.weeks.map((w) => w.phase)).toEqual(['base', 'base', 'base', 'recovery', 'base'])
    expect(s.weeks[0]!.sessions[0]).toMatchObject({ day: 1, type: 'test' })
    expect(baseSkeleton(survey({ goal: 'endurance' }), 1).weeks[0]!.sessions[0]!.type).not.toBe('test')
    expect(baseSkeleton(survey(), 0).weeks).toEqual([])
  })

  it('moves an AI plan’s opening test past the days before a mid-week start, into the next week if it must', () => {
    const ai: PlanSkeleton = {
      weeks: [
        { phase: 'base', sessions: [{ day: 1, type: 'test', minutes: 40, intent: 'Ramp test' }, { day: 3, type: 'endurance', minutes: 60, intent: 'Easy' }] },
        { phase: 'base', sessions: [{ day: 1, type: 'tempo', minutes: 60, intent: 'Tempo' }] },
      ],
    }
    expect(fromStart(ai, '2026-11-18').weeks.map((w) => w.sessions.map((x) => [x.day, x.type, x.minutes]))).toEqual([[[3, 'test', 40]], [[1, 'tempo', 60]]])
    expect(fromStart(ai, '2026-11-20').weeks.map((w) => w.sessions.map((x) => [x.day, x.type]))).toEqual([[], [[1, 'test']]])
    expect(fromStart(ai, '2026-11-16')).toBe(ai)
  })
})
