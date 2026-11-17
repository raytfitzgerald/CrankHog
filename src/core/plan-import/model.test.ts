import { describe, expect, it } from 'vitest'
import type { PlanImportOutput } from '../ai/schemas'
import { dateKeyToMs } from '../workout/schedule'
import { defaultStart, fromAiOutput, isRealDate, mergeDocs, mondayOf, placeItems, type ImportItem } from './model'

type AiItem = PlanImportOutput['items'][number]
const aiItem = (patch: Partial<AiItem>): AiItem => ({ date: null, week: null, weekday: null, sport: 'bike', name: 'Ride', steps: '- 1h 65%', minutes: null, effort: null, notes: null, ...patch })
const out = (patch: Partial<PlanImportOutput>): PlanImportOutput => ({ planName: null, raceName: null, raceDate: null, startDate: null, items: [], skipped: [], ...patch })
const item = (patch: Partial<ImportItem>): ImportItem => ({ where: '', sport: 'bike', name: 'Ride', steps: '- 1h 65%', ...patch })

describe('isRealDate and mondayOf', () => {
  it('knows a real day from a malformed or impossible one', () => {
    expect(isRealDate('2027-01-04')).toBe(true)
    expect(isRealDate('2027-02-30')).toBe(false)
    expect(isRealDate('4/1/2027')).toBe(false)
    expect(isRealDate(null)).toBe(false)
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

  it('drops days that aren’t real and weeks out of range, keeping the session', () => {
    const doc = fromAiOutput(out({ raceDate: '2027-02-30', startDate: 'soon', items: [aiItem({ date: '2027-13-01' }), aiItem({ week: 0, weekday: 2 }), aiItem({ week: 500 }), aiItem({ date: 'Tuesday', week: 4, weekday: 1 })] }))
    expect(doc.race).toBeUndefined()
    expect(doc.startDate).toBeUndefined()
    expect(doc.items.map((i) => [i.date, i.week, i.weekday, i.where])).toEqual([
      [undefined, undefined, undefined, 'No day given'],
      [undefined, undefined, undefined, 'No day given'],
      [undefined, undefined, undefined, 'No day given'],
      [undefined, 4, 1, 'Week 4, Tue'],
    ])
  })

  it('calls a race with a date but no name "Race"', () => {
    expect(fromAiOutput(out({ raceDate: '2027-04-03' })).race).toEqual({ name: 'Race', date: '2027-04-03' })
  })
})

describe('mergeDocs', () => {
  it('takes the first name, race and start any part has, and every session once, in order', () => {
    const a = { items: [item({ week: 1, weekday: 1, name: 'A' }), item({ week: 1, weekday: 3, name: 'B' })], skipped: [{ text: 'x', reason: 'y' }] }
    const b = { name: 'Plan', race: { name: 'Race', date: '2027-04-03' }, items: [item({ week: 1, weekday: 3, name: 'B' }), item({ week: 2, weekday: 1, name: 'C' })], skipped: [] }
    const c = { name: 'Other name', items: [item({ week: 3, weekday: 1, name: 'D' })], skipped: [{ text: 'z', reason: 'w' }] }
    const merged = mergeDocs([a, b, c])
    expect(merged.name).toBe('Plan')
    expect(merged.race).toEqual({ name: 'Race', date: '2027-04-03' })
    expect(merged.items.map((i) => i.name)).toEqual(['A', 'B', 'C', 'D'])
    expect(merged.skipped).toHaveLength(2)
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
