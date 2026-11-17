import { describe, expect, it } from 'vitest'
import type { PlanItem, TrainingPlan } from '@core/workout/plan'
import type { LibraryEntry } from '../../workouts/library'
import { filterChips, filterRows, folderRows, shownPlanOf } from './folders'

const entry = (id: string, folder: LibraryEntry['folder'], o: { tags?: string[]; durationS?: number; favorite?: boolean; ftpTest?: boolean } = {}) =>
  ({
    workout: { id, name: id, tags: o.tags ?? [], ...(o.ftpTest ? { ftpTest: { protocol: 'ramp' } } : {}) },
    builtin: folder === 'crankhog',
    folder,
    favorite: o.favorite ?? false,
    stats: { durationS: o.durationS ?? 3600 },
  }) as unknown as LibraryEntry

const plan = (id: string, items: Omit<PlanItem, 'id'>[], updatedAt = 0): TrainingPlan => ({
  id,
  name: id,
  items: items.map((it, i) => ({ id: `${id}-${i}`, ...it })),
  rideDays: [1, 3, 5],
  startDate: '2026-11-16',
  onCalendar: false,
  source: 'files',
  createdAt: 0,
  updatedAt,
})

const library = [entry('mine-1', 'plan'), entry('mine-2', 'plan'), entry('loose', 'custom'), entry('builtin:endurance-60', 'crankhog')]
const ids = (rows: { entry: LibraryEntry }[]) => rows.map((r) => r.entry.workout.id)

describe('folderRows', () => {
  it('lists CrankHog workouts, and every workout of your own under Custom', () => {
    expect(ids(folderRows('crankhog', library, [], null))).toEqual(['builtin:endurance-60'])
    expect(ids(folderRows('custom', library, [], null))).toEqual(['mine-1', 'mine-2', 'loose'])
  })

  it('lists a plan in its order, numbered as in the plan, without its runs or workouts gone from the library', () => {
    const p = plan('a', [{ workoutId: 'mine-2' }, { workoutId: 'run-1', sport: 'run' }, { workoutId: 'deleted' }, { workoutId: 'mine-1' }, { workoutId: 'mine-2' }])
    const rows = folderRows('plan', library, [p], p)
    expect(rows.map((r) => [r.entry.workout.id, r.n])).toEqual([
      ['mine-2', 1],
      ['mine-1', 4],
      ['mine-2', 5],
    ])
    expect(new Set(rows.map((r) => r.key)).size).toBe(3)
  })

  it('lists every plan’s workouts once each, unnumbered, when no plan is shown', () => {
    const a = plan('a', [{ workoutId: 'mine-1' }, { workoutId: 'builtin:endurance-60' }])
    const b = plan('b', [{ workoutId: 'builtin:endurance-60' }, { workoutId: 'mine-2' }])
    const rows = folderRows('plan', library, [a, b], null)
    expect(ids(rows)).toEqual(['mine-1', 'builtin:endurance-60', 'mine-2'])
    expect(rows.every((r) => r.n === undefined)).toBe(true)
  })
})

describe('shownPlanOf', () => {
  const a = plan('a', [], 2)
  const b = plan('b', [], 1)
  it('shows the plan picked, else the first (the latest), and all of them only when there are two or more', () => {
    expect(shownPlanOf([a, b], 'b', false)).toBe(b)
    expect(shownPlanOf([a, b], 'gone', false)).toBe(a)
    expect(shownPlanOf([a, b], 'b', true)).toBeNull()
    expect(shownPlanOf([a], null, true)).toBe(a)
    expect(shownPlanOf([], null, false)).toBeNull()
  })
})

describe('filterRows and filterChips', () => {
  const rows = [entry('Short sweet spot', 'crankhog', { tags: ['sweet-spot'], durationS: 30 * 60 }), entry('Long endurance', 'crankhog', { tags: ['endurance'], durationS: 2 * 3600, favorite: true }), entry('Ramp', 'crankhog', { tags: ['test', 'ftp'], ftpTest: true })].map((e) => ({ key: e.workout.id, entry: e }))

  it('filters by chip, length and search', () => {
    expect(ids(filterRows(rows, { filter: 'favorites', length: 'any', query: '' }))).toEqual(['Long endurance'])
    expect(ids(filterRows(rows, { filter: 'tests', length: 'any', query: '' }))).toEqual(['Ramp'])
    expect(ids(filterRows(rows, { filter: 'tag:sweet-spot', length: 'any', query: '' }))).toEqual(['Short sweet spot'])
    expect(ids(filterRows(rows, { filter: 'all', length: 'long', query: '' }))).toEqual(['Long endurance'])
    expect(ids(filterRows(rows, { filter: 'all', length: 'any', query: 'ENDUR' }))).toEqual(['Long endurance'])
  })

  it('offers FTP tests only on CrankHog workouts, and the folder’s own tags', () => {
    expect(filterChips('crankhog', rows).map((c) => c.id)).toEqual(['all', 'favorites', 'tests', 'tag:sweet-spot', 'tag:endurance'])
    expect(filterChips('plan', rows.slice(1, 2)).map((c) => c.label)).toEqual(['All', 'Favorites', 'Endurance'])
  })
})
