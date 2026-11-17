import { describe, expect, it } from 'vitest'
import type { PlanImportOutput } from '../ai/schemas'
import { isRealDay } from '../workout/plan'
import { dateKeyToMs } from '../workout/schedule'
import { defaultStart, fromAiOutput, MAX_PART_ITEMS, mergeDocs, mondayOf, placeItems, type ImportDoc, type ImportItem } from './model'

type AiItem = PlanImportOutput['items'][number]
const aiItem = (patch: Partial<AiItem>): AiItem => ({ date: null, week: null, weekday: null, sport: 'bike', name: 'Ride', steps: '- 1h 65%', minutes: null, effort: null, notes: null, ...patch })
const out = (patch: Partial<PlanImportOutput>): PlanImportOutput => ({ planName: null, raceName: null, raceDate: null, startDate: null, countdown: null, items: [], skipped: [], ...patch })
const item = (patch: Partial<ImportItem>): ImportItem => ({ where: '', sport: 'bike', name: 'Ride', steps: '- 1h 65%', ...patch })

describe('isRealDay and mondayOf', () => {
  it('knows a real day from a malformed or impossible one', () => {
    expect(isRealDay('2027-01-04')).toBe(true)
    expect(isRealDay('2027-02-30')).toBe(false)
    expect(isRealDay('4/1/2027')).toBe(false)
    expect(isRealDay(null)).toBe(false)
  })

  it('finds the Monday of a day’s week', () => {
    // 2027-01-07 is a Thursday, 2027-01-04 a Monday, 2027-01-10 a Sunday
    expect(mondayOf('2027-01-07')).toBe('2027-01-04')
    expect(mondayOf('2027-01-04')).toBe('2027-01-04')
    expect(mondayOf('2027-01-10')).toBe('2027-01-04')
  })
})

describe('fromAiOutput', () => {
  it('keeps what the document said, as CrankHog’s items', () => {
    const doc = fromAiOutput(
      out({
        planName: ' 70.3 plan ',
        raceName: 'Ironman 70.3 Oceanside',
        raceDate: '2027-04-03',
        startDate: '2027-01-04',
        items: [
          aiItem({ date: '2027-01-05', sport: 'run', name: 'Easy run ', steps: ' - 40m Z2 HR ', notes: ' Relaxed. ' }),
          aiItem({ week: 2, weekday: 5, name: 'Long ride' }),
          aiItem({ week: 3, sport: 'other', name: 'Strength', steps: '', minutes: 45.4, effort: 'moderate' }),
        ],
        skipped: [{ text: 'Brick if you feel good', reason: 'No length given' }],
      }),
    )
    expect(doc).toEqual({
      name: '70.3 plan',
      race: { name: 'Ironman 70.3 Oceanside', date: '2027-04-03' },
      startDate: '2027-01-04',
      items: [
        { where: '2027-01-05', date: '2027-01-05', sport: 'run', name: 'Easy run', steps: '- 40m Z2 HR', notes: 'Relaxed.' },
        { where: 'Week 2, Sat', week: 2, weekday: 5, sport: 'bike', name: 'Long ride', steps: '- 1h 65%' },
        { where: 'Week 3', week: 3, sport: 'other', name: 'Strength', steps: '', minutes: 45, effort: 'moderate' },
      ],
      skipped: [{ text: 'Brick if you feel good', reason: 'No length given' }],
    })
  })

  it('drops days that aren’t real and weeks out of range, keeping the session, and the document’s own week numbers', () => {
    const doc = fromAiOutput(out({ raceDate: '2027-02-30', startDate: 'soon', items: [aiItem({ date: '2027-13-01' }), aiItem({ week: 0, weekday: 2 }), aiItem({ week: 500 }), aiItem({ date: 'Tuesday', week: 4, weekday: 1 })] }))
    expect(doc.race).toBeUndefined()
    expect(doc.startDate).toBeUndefined()
    expect(doc.items.map((i) => [i.date, i.week, i.weekday, i.where])).toEqual([
      [undefined, undefined, undefined, 'No day given'],
      // week 0 is the document's; mergeDocs makes it the plan's week 1
      [undefined, 0, 2, 'Week 0, Wed'],
      [undefined, undefined, undefined, 'No day given'],
      [undefined, 4, 1, 'Week 4, Tue'],
    ])
  })

  it('checks each session’s sport, weekday and effort itself, so one odd value costs only that value', () => {
    const doc = fromAiOutput(
      out({
        countdown: true,
        items: [
          aiItem({ sport: 'Cycling', week: 2, weekday: 7 }),
          aiItem({ sport: 'rowing', week: 2.5, weekday: 1 }),
          aiItem({ sport: 'RUN', week: 3, weekday: 1.5, effort: 'Hard', steps: '' }),
          aiItem({ sport: 'swim', effort: 'tempo', steps: '', name: 'x'.repeat(200) }),
        ],
      }),
    )
    expect(doc.countdown).toBe(true)
    expect(doc.items.map((i) => [i.sport, i.week, i.weekday, i.effort])).toEqual([
      ['bike', 2, undefined, undefined],
      ['other', undefined, undefined, undefined],
      ['run', 3, undefined, 'hard'],
      ['swim', undefined, undefined, undefined],
    ])
    expect(doc.items[3]!.name).toHaveLength(80)
  })

  it('keeps at most a part’s worth of sessions, and says so', () => {
    const doc = fromAiOutput(out({ items: Array.from({ length: MAX_PART_ITEMS + 3 }, () => aiItem({})), skipped: Array.from({ length: 150 }, (_, i) => ({ text: `t${i}`, reason: 'r' })) }))
    expect(doc.items).toHaveLength(MAX_PART_ITEMS)
    expect(doc.skipped).toHaveLength(101)
    expect(doc.skipped.at(-1)).toEqual({ text: '3 more sessions in one part', reason: expect.stringMatching(/^A part holds at most 400 sessions/) })
  })

  it('calls a race with a date but no name "Race"', () => {
    expect(fromAiOutput(out({ raceDate: '2027-04-03' })).race).toEqual({ name: 'Race', date: '2027-04-03' })
  })
})

describe('mergeDocs', () => {
  const doc = (items: ImportItem[], more: Partial<ImportDoc> = {}): ImportDoc => ({ items, skipped: [], ...more })

  it('takes the first name, race and start any part has, and drops a later part’s second read of a session from the document’s start', () => {
    const a = doc([item({ week: 1, weekday: 1, name: 'A' }), item({ week: 1, weekday: 3, name: 'B' })], { skipped: [{ text: 'x', reason: 'y' }] })
    const b = doc([item({ week: 1, weekday: 3, name: 'B' }), item({ week: 2, weekday: 1, name: 'C' })], { name: 'Plan', race: { name: 'Race', date: '2027-04-03' } })
    const c = doc([item({ week: 3, weekday: 1, name: 'D' })], { name: 'Other name', skipped: [{ text: 'z', reason: 'w' }] })
    const merged = mergeDocs([a, b, c], 'Plan. Key session: b, on the Wednesday of week 1.')
    expect(merged.name).toBe('Plan')
    expect(merged.race).toEqual({ name: 'Race', date: '2027-04-03' })
    expect(merged.items.map((i) => i.name)).toEqual(['A', 'B', 'C', 'D'])
    expect(merged.skipped).toHaveLength(2)
  })

  it('keeps sessions a part repeats: three easy runs in a week, a list with no days, an AM/PM double', () => {
    const run = item({ sport: 'run', name: 'Easy run', steps: '- 40m Z2 HR' })
    const merged = mergeDocs([
      doc([
        { ...run, week: 2 },
        { ...run, week: 2 },
        { ...run, week: 2 },
        item({ name: 'Spin' }),
        item({ name: 'Spin' }),
        { ...run, date: '2027-01-05' },
        { ...run, date: '2027-01-05' },
      ]),
    ])
    expect(merged.items.map((i) => [i.name, i.week, i.date])).toEqual([
      ['Easy run', 2, undefined],
      ['Easy run', 2, undefined],
      ['Easy run', 2, undefined],
      ['Spin', undefined, undefined],
      ['Spin', undefined, undefined],
      ['Easy run', undefined, '2027-01-05'],
      ['Easy run', undefined, '2027-01-05'],
    ])
  })

  it('keeps a later part’s repeats of the first part’s sessions unless the document’s start names them, and then only as often as the first part has them', () => {
    // a list of sessions with no weeks or days, long enough for two parts
    const first = doc([item({ name: 'Spin' }), item({ name: 'Tempo' }), item({ name: 'Spin' })])
    const later = doc([item({ name: 'Spin' }), item({ name: 'Tempo' }), item({ name: 'Spin' }), item({ name: 'Spin' })])
    expect(mergeDocs([first, later], 'My 100 sessions').items.map((i) => i.name)).toEqual(['Spin', 'Tempo', 'Spin', 'Spin', 'Tempo', 'Spin', 'Spin'])
    // the start names Spin: the later part's first two are the second read of the first part's two
    expect(mergeDocs([first, later], 'Every week: two SPIN sessions').items.map((i) => i.name)).toEqual(['Spin', 'Tempo', 'Spin', 'Tempo', 'Spin'])
  })

  it('makes the weeks the plan’s, 1 = its first: up a week from 0, and turned round when they count down', () => {
    const at = (week: number) => item({ week, weekday: 1 })
    const weeks = (parts: ImportDoc[]) => mergeDocs(parts).items.map((i) => [i.week, i.where])
    expect(weeks([doc([{ ...at(0), where: 'Week 0, Tue' }, at(1)]), doc([at(3)])])).toEqual([
      [1, 'Week 0, Tue'],
      [2, ''],
      [4, ''],
    ])
    expect(weeks([doc([at(2), at(3)])])).toEqual([
      [2, ''],
      [3, ''],
    ])
    // 16 weeks out … 1 week out, most parts saying so
    const countdown = [doc([at(16), at(15)], { countdown: true }), doc([at(8)], { countdown: true }), doc([at(1)], { countdown: false })]
    expect(weeks(countdown).map(([w]) => w)).toEqual([1, 2, 9, 16])
    expect(weeks([doc([at(3)], { countdown: true }), doc([at(1)], { countdown: false })]).map(([w]) => w)).toEqual([3, 1])
  })
})

describe('defaultStart', () => {
  const now = dateKeyToMs('2026-11-18') // a Wednesday

  it('is the Monday of the document’s start', () => {
    expect(defaultStart({ startDate: '2027-01-07', items: [] }, undefined, now)).toBe('2027-01-04')
  })

  it('counts a week-numbered plan back from its race, so the last week is race week', () => {
    // race Sunday 2027-04-04; 12 weeks: week 12 is the week of 2027-03-29, week 1 that of 2027-01-11
    const items = [item({ week: 1, weekday: 1 }), item({ week: 12, weekday: 2 })]
    expect(defaultStart({ items }, '2027-04-04', now)).toBe('2027-01-11')
  })

  it('is next Monday otherwise', () => {
    expect(defaultStart({ items: [item({ week: 1 })] }, undefined, now)).toBe('2026-11-23')
    expect(defaultStart({ items: [item({ date: '2027-01-05' })] }, '2027-04-04', now)).toBe('2026-11-23')
  })
})

describe('placeItems', () => {
  it('dates each session: its own date, or its week and weekday from the start, or none', () => {
    const items = [item({ date: '2027-02-02' }), item({ week: 1, weekday: 0 }), item({ week: 3, weekday: 6 }), item({})]
    expect(placeItems(items, '2027-01-04')).toEqual(['2027-02-02', '2027-01-04', '2027-01-24', undefined])
  })

  it('spreads sessions a week gives no day over that week', () => {
    const items = [item({ week: 2 }), item({ week: 2 }), item({ week: 2 }), item({ week: 1 })]
    // three in week 2: Tue, Thu, Sat; one in week 1: Sat
    expect(placeItems(items, '2027-01-04')).toEqual(['2027-01-12', '2027-01-14', '2027-01-16', '2027-01-09'])
  })
})
