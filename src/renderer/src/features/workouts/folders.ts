// What each folder of workouts lists, and the search and filters over it.
// The Workouts page and the calendar's workout picker share them.
import type { TrainingPlan } from '@core/workout/plan'
import { tagLabel, type LibraryEntry } from '../../workouts/library'

export type Folder = LibraryEntry['folder']
export type Filter = 'all' | 'favorites' | 'tests' | `tag:${string}`
export type Length = 'any' | 'short' | 'medium' | 'long'

export const LENGTHS: { id: Length; label: string; test: (s: number) => boolean }[] = [
  { id: 'any', label: 'Any length', test: () => true },
  { id: 'short', label: 'Under 45 min', test: (s) => s < 45 * 60 },
  { id: 'medium', label: '45–75 min', test: (s) => s >= 45 * 60 && s <= 75 * 60 },
  { id: 'long', label: 'Over 75 min', test: (s) => s > 75 * 60 },
]

/** A card in a folder. The Training plan folder numbers each one as in its plan, when one plan is shown. */
export interface Row {
  key: string
  entry: LibraryEntry
  n?: number
}

/** The plan the Training plan folder shows: the one picked, else the latest. Null for every plan's workouts, offered with two or more. */
export function shownPlanOf(plans: readonly TrainingPlan[], planId: string | null, all: boolean): TrainingPlan | null {
  if (all && plans.length > 1) return null
  return plans.find((p) => p.id === planId) ?? plans[0] ?? null
}

/**
 * A folder's cards. Custom workouts are all of the rider's own, filed in a
 * plan or not. The Training plan folder is the shown plan's bike workouts in
 * its order (runs and swims live on Run & swim), or with no plan shown every
 * plan's, each once.
 */
export function folderRows(folder: Folder, library: readonly LibraryEntry[], plans: readonly TrainingPlan[], shown: TrainingPlan | null): Row[] {
  if (folder !== 'plan') return library.filter((e) => (folder === 'custom' ? e.folder !== 'crankhog' : e.folder === folder)).map((e) => ({ key: e.workout.id, entry: e }))
  const byId = new Map(library.map((e) => [e.workout.id, e]))
  if (shown) return shown.items.flatMap((item, i) => (item.sport || !byId.has(item.workoutId) ? [] : [{ key: item.id, entry: byId.get(item.workoutId)!, n: i + 1 }]))
  const seen = new Set<string>()
  return plans.flatMap((p) =>
    p.items.flatMap((item) => {
      if (item.sport || seen.has(item.workoutId) || !byId.has(item.workoutId)) return []
      seen.add(item.workoutId)
      return [{ key: item.workoutId, entry: byId.get(item.workoutId)! }]
    }),
  )
}

/** The filter chips for a folder: All, Favorites, FTP tests on CrankHog's own, then its tags, commonest first. */
export function filterChips(folder: Folder, rows: readonly Row[]): { id: Filter; label: string }[] {
  const count = new Map<string, number>()
  for (const { entry } of rows) for (const t of entry.workout.tags) if (t !== 'test' && t !== 'ftp') count.set(t, (count.get(t) ?? 0) + 1)
  const tags = [...count.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t)
  return [
    { id: 'all', label: 'All' },
    { id: 'favorites', label: 'Favorites' },
    ...(folder === 'crankhog' ? [{ id: 'tests' as const, label: 'FTP tests' }] : []),
    ...tags.map((t) => ({ id: `tag:${t}` as const, label: tagLabel(t) })),
  ]
}

/** The rows that pass the filter chip, the length and the search (name, description or tag). */
export function filterRows(rows: readonly Row[], { filter, length, query }: { filter: Filter; length: Length; query: string }): Row[] {
  const q = query.trim().toLowerCase()
  const lengthTest = LENGTHS.find((l) => l.id === length)!.test
  return rows.filter(({ entry: e }) => {
    const w = e.workout
    if (filter === 'favorites' && !e.favorite) return false
    if (filter === 'tests' && !w.ftpTest) return false
    if (filter.startsWith('tag:') && !w.tags.includes(filter.slice(4))) return false
    if (!lengthTest(e.stats.durationS)) return false
    return !q || w.name.toLowerCase().includes(q) || (w.description ?? '').toLowerCase().includes(q) || w.tags.some((t) => t.includes(q))
  })
}
