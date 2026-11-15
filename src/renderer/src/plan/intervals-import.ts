// Planned rides from the rider's intervals.icu calendar onto CrankHog's. Each
// import covers last week and the next four, and replaces what an earlier
// import put in that range, so moves and deletions on intervals.icu carry over.
import { addDays, dateKey, fromIntervalsEvent, type ScheduledWorkout } from '@core/workout/schedule'
import { bridge } from '../platform/bridge'
import { replaceIntervalsImports } from './schedule-repo'

export const IMPORT_DAYS_BACK = 7
export const IMPORT_DAYS_AHEAD = 28

export interface IntervalsImportResult {
  added: number
  updated: number
  removed: number
  /** Runs, swims, and rides with no steps to play. */
  skipped: number
}

export async function importFromIntervals(now = Date.now()): Promise<IntervalsImportResult> {
  const today = dateKey(now)
  const oldest = addDays(today, -IMPORT_DAYS_BACK)
  const newest = addDays(today, IMPORT_DAYS_AHEAD)
  const { events } = await bridge().invoke('intervals.planned', { oldest, newest })
  const entries: ScheduledWorkout[] = []
  let skipped = 0
  for (const ev of events) {
    const r = fromIntervalsEvent({ id: ev.id, start_date_local: ev.start_date_local, name: ev.name, type: ev.type ?? undefined, description: ev.description ?? undefined, zwo: ev.zwo }, now)
    if (r.kind === 'ok') entries.push(r.entry)
    else skipped++
  }
  return { ...(await replaceIntervalsImports(oldest, newest, entries)), skipped }
}
