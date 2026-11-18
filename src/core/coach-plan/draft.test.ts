import { describe, expect, it } from 'vitest'
import type { PlanOutlineOutput } from '../ai/schemas'
import type { ImportItem } from '../plan-import/model'
import { checkBrief, reshapes, weekStart, type PlanBrief } from './brief'
import { blocksOf, changedWeeks, draftFacts, fromOutline, fromWeeks, outlineInput, repairInput, replaceWeeks, weeksInput, type PlanDraft } from './draft'

const TODAY = '2026-11-17' // a Tuesday

/** The brief for a full Ironman 36 weeks out, as the coach would hand it over. */
const ironman = (over: Record<string, unknown> = {}) => ({
  name: 'Ironman Barcelona 2027',
  race: { name: 'Ironman Barcelona', date: '2027-08-01', kind: 'full-distance triathlon (3.8 km swim, 180 km bike, 42.2 km run)' },
  sports: ['Swim', 'cycling', 'run', 'strength'],
  hoursPerWeek: { start: 8, peak: 15 },
  days: [
    { weekday: 0, maxMinutes: 60, note: 'pool before work' },
    { weekday: 1, maxMinutes: 90 },
    { weekday: 3, maxMinutes: 90 },
    { weekday: 5, maxMinutes: 360 },
    { weekday: 6, maxMinutes: 180 },
    { weekday: 9, maxMinutes: 60 },
  ],
  longRideDay: 5,
  longRunDay: 6,
  athlete: 'FTP 250 W, runs 25 km a week, swims 2x a week in a 25 m pool, no injuries.',
  away: [{ from: '2027-02-08', to: '2027-02-21', note: 'skiing' }],
  ...over,
})

describe('checkBrief', () => {
  it('works out a race plan from next Monday to race week, and reads sports in any case', () => {
    const r = checkBrief(ironman(), TODAY)
    if (!r.ok) throw new Error(r.error)
    expect(r.span).toEqual({ start: '2026-11-23', weeks: 36, raceDate: '2027-08-01' })
    expect(weekStart(r.span, 36)).toBe('2027-07-26')
    expect(r.brief.sports).toEqual(['swim', 'bike', 'run', 'other'])
    // a day that isn't a weekday is dropped
    expect(r.brief.days.map((d) => d.weekday)).toEqual([0, 1, 3, 5, 6])
    expect(r.notes).toEqual([])
  })

  it('starts on the Monday of a start date given, and covers only the last 52 weeks of a race far off', () => {
    const r = checkBrief(ironman({ startDate: '2026-12-02' }), TODAY)
    expect(r.ok && r.span.start).toBe('2026-11-30')
    const far = checkBrief(ironman({ race: { name: 'Kona', date: '2028-10-14', kind: 'full' } }), TODAY)
    if (!far.ok) throw new Error(far.error)
    expect(far.span.weeks).toBe(52)
    expect(weekStart(far.span, 52)).toBe('2028-10-09')
    expect(far.notes[0]).toContain('last 52 weeks')
  })

  it('needs a race date after today, or a number of weeks, and a day and hours to train', () => {
    expect(checkBrief(ironman({ race: { name: 'x', date: '2026-11-01', kind: 'x' } }), TODAY)).toMatchObject({ ok: false, error: expect.stringContaining("isn't after today") })
    expect(checkBrief(ironman({ race: null }), TODAY)).toEqual({ ok: false, error: 'A plan without a race needs a number of weeks.' })
    expect(checkBrief(ironman({ race: null, weeks: 12 }), TODAY)).toMatchObject({ ok: true, span: { start: '2026-11-23', weeks: 12 } })
    expect(checkBrief(ironman({ days: [] }), TODAY)).toMatchObject({ ok: false })
    expect(checkBrief(ironman({ hoursPerWeek: { start: 0, peak: 0 } }), TODAY)).toMatchObject({ ok: false })
    expect(checkBrief({ name: 'x' }, TODAY)).toMatchObject({ ok: false, error: expect.stringContaining("didn't make sense") })
  })

  it('tells a change to the days or hours from one that only touches some weeks', () => {
    const a = (checkBrief(ironman(), TODAY) as { brief: PlanBrief }).brief
    expect(reshapes(a, { ...a, longRideDay: 6 })).toBe(true)
    expect(reshapes(a, { ...a, away: [] })).toBe(false)
  })
})

const outlineOut = (weeks: number, patch: (w: number) => Partial<PlanOutlineOutput['weeks'][number]> = () => ({})): PlanOutlineOutput => ({
  notes: 'Base, build, peak, taper.',
  weeks: Array.from({ length: weeks }, (_, i) => ({ week: i + 1, phase: i % 4 === 3 ? 'Recovery week' : 'base', focus: 'Aerobic', hours: { swim: 2, bike: 4.13, run: 2, other: 0.5 }, keySessions: ['Long ride'], ...patch(i + 1) })),
})

describe('fromOutline', () => {
  it('reads phases loosely, rounds hours, and fills a week left out from the one before', () => {
    const out = outlineOut(6)
    out.weeks.splice(4, 1)
    const o = fromOutline(out, 6)!
    expect(o.weeks.map((w) => w.phase)).toEqual(['base', 'base', 'base', 'recovery', 'recovery', 'base'])
    expect(o.weeks[4]!.week).toBe(5)
    expect(o.weeks[0]!.hours.bike).toBe(4.25)
  })

  it('is no outline when fewer than half the weeks came back', () => {
    expect(fromOutline(outlineOut(2), 6)).toBeNull()
  })

  it('finds the weeks a revision changed', () => {
    const before = fromOutline(outlineOut(8), 8)!
    const after = fromOutline(outlineOut(8, (w) => (w === 3 || w === 7 ? { hours: { swim: 1, bike: 4.13, run: 2, other: 0.5 } } : {})), 8)!
    expect(changedWeeks(before, after)).toEqual([3, 7])
  })
})

describe('blocksOf', () => {
  it('cuts weeks into runs of at most four in a row', () => {
    expect(blocksOf([1, 2, 3, 4, 5, 6, 7, 8, 9])).toEqual([
      [1, 4],
      [5, 8],
      [9, 9],
    ])
    expect(blocksOf([12, 3, 13, 2])).toEqual([
      [2, 3],
      [12, 13],
    ])
  })
})

const ai = (week: number, weekday: number, sport: string, name: string) => ({ week, weekday, sport, name, steps: '- 30m Z2 HR', minutes: null, effort: null, notes: null })

describe('fromWeeks and replaceWeeks', () => {
  it("keeps only the block's weeks, and reads sports as the import does", () => {
    const items = fromWeeks({ items: [ai(4, 1, 'Running', 'Easy run'), ai(5, 2, 'bike', 'Too late'), ai(4, 9, 'kayak', 'Paddle'), ai(4, 3, 'swim', '')] }, [3, 4])
    expect(items.map((i) => [i.week, i.weekday, i.sport, i.name])).toEqual([
      [4, 1, 'run', 'Easy run'],
      [4, undefined, 'other', 'Paddle'],
    ])
    expect(items[0]!.where).toBe('Week 4, Tue')
  })

  it("swaps a block's weeks for new sessions, in day order", () => {
    const item = (week: number, weekday: number, name: string): ImportItem => ({ where: '', week, weekday, sport: 'run', name, steps: '' })
    const out = replaceWeeks([item(1, 2, 'a'), item(2, 1, 'b'), item(3, 0, 'c')], [2, 2], [item(2, 5, 'B2'), item(2, 0, 'B1')])
    expect(out.map((i) => i.name)).toEqual(['a', 'B1', 'B2', 'c'])
  })
})

describe('what the planner is sent', () => {
  const r = checkBrief(ironman(), TODAY) as Extract<ReturnType<typeof checkBrief>, { ok: true }>
  const outline = fromOutline(outlineOut(36), 36)!

  it('gives the outline the brief with the dates worked out, and nothing that names the rider', () => {
    const input = outlineInput({ today: TODAY, brief: r.brief, span: r.span, athlete: '{"ftpW":250}' })
    expect(input).toContain('36 weeks, week 1 starting Monday 2026-11-23, week 36 starting Monday 2027-07-26.')
    expect(input).toContain('on 2027-08-01 (Sunday), in week 36')
    expect(input).toContain('Saturday (weekday 5) up to 360 min')
    expect(input).toContain('Long ride: Saturday.')
    expect(input).toContain('Away: 2027-02-08 to 2027-02-21 (skiing).')
    expect(input).toContain('Outline all 36 weeks.')
    const revise = outlineInput({ today: TODAY, brief: r.brief, span: r.span, athlete: '{}', current: outline, feedback: 'less swimming' })
    expect(revise).toContain("The rider's feedback: less swimming")
    expect(revise).toContain('keep every week it doesn')
  })

  it('gives a block of weeks the outline, the week before, and for a revision the sessions now, inside the IPC limit', () => {
    const before: ImportItem[] = [{ where: '', week: 4, weekday: 5, sport: 'bike', name: 'Long ride', steps: '- 3h 65%' }]
    const input = weeksInput({ today: TODAY, brief: r.brief, span: r.span, athlete: '{}', outline, block: [5, 8], before })
    expect(input).toContain('Week 4, before these, has: Sat bike Long ride.')
    expect(input).toContain('Write every session of weeks 5 to 8 (week 5 starts Monday 2026-12-21;')
    expect(input).not.toContain('Nothing before today')
    const first = weeksInput({ today: TODAY, brief: r.brief, span: r.span, athlete: '{}', outline, block: [1, 4], before: [], current: before, feedback: 'long ride on Sunday' })
    expect(first).toContain(`Nothing before today (${TODAY}).`)
    expect(first).toContain("The rider's feedback on the plan: long ride on Sunday")
    expect(first.length).toBeLessThan(40_000)
  })

  it('sends unreadable sessions back with their reasons', () => {
    const input = repairInput({ today: TODAY, brief: r.brief, span: r.span, failed: [{ item: { where: '', week: 2, weekday: 1, sport: 'bike', name: 'Bad', steps: '- 20 minutes hard' }, reason: 'Line 1: no length' }] })
    expect(input).toContain('"reason":"Line 1: no length"')
  })

  it("gives the coach the draft's outline, and its sessions while they fit", () => {
    const items: ImportItem[] = Array.from({ length: 36 * 8 }, (_, i) => ({ where: '', week: Math.floor(i / 8) + 1, weekday: i % 7, sport: 'run', name: `Session with a fairly long name ${i}`, steps: '' }))
    const draft: PlanDraft = { id: 'd1', version: 2, brief: r.brief, span: r.span, outline, items, problems: [], notes: [], createdAt: 0 }
    const facts = draftFacts(draft, 'ready')
    expect(facts).toMatchObject({ version: 2, weeks: 36, firstMonday: '2026-11-23', race: { date: '2027-08-01' } })
    expect(facts.outline).toHaveLength(36)
    expect(facts.outline[0]).toHaveProperty('sessions')
    expect(facts.outline[35]).toHaveProperty('sessionCount', 8)
    expect(JSON.stringify(facts).length).toBeLessThan(20_000)
  })
})
