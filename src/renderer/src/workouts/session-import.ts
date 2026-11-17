// Importing workout files, with a report that says where each one went and
// why: on its day, in the library, in a plan, or skipped, with every error
// and warning by line (docs/WORKOUT-FORMAT.md). Run, swim and other session
// files are read by @core/multisport; bike files by the bike importers.
import { sessionFromFile } from '@core/multisport/build'
import type { SessionSport } from '@core/multisport/model'
import { isSessionFile, type SessionMessage } from '@core/multisport/parse'
import { parseDatedFileName } from '@core/workout/plan'
import type { DateKey } from '@core/workout/schedule'
import { currentFtp, DEFAULT_FTP_W } from '../db/athlete-repo'
import { scheduleWorkout } from '../plan/schedule-repo'
import { parseWorkoutFile, saveWorkout } from './library'
import { planSessionWorkout, saveSessionWorkout, sessionThresholds } from './sessions-repo'

/** Where imported files go. */
export type ImportTarget = 'calendar' | 'library'

export interface ImportLine {
  file: string
  /** What it's called once imported. */
  name?: string
  kind: 'session' | 'bike'
  /** A session's sport, once it was read. */
  sport?: SessionSport
  outcome: 'day' | 'library' | 'plan' | 'skipped'
  date?: DateKey
  planName?: string
  errors: SessionMessage[]
  warnings: SessionMessage[]
}

export const NO_DATE = 'No date: name it YYYY-MM-DD_Name.txt or add a "date:" line, or import it on the Workouts page.'

/** Session files: .txt with a sport line. Bike files: .zwo, .mrc, .erg and .txt without one. */
export const SESSION_IMPORT_EXTENSIONS = ['.txt', '.zwo', '.mrc', '.erg'] as const

/**
 * Imports files in file-name order. On the calendar, each needs a date (in
 * its name, or a session's "date:" line) and goes on that day; in the
 * library, each goes to the library. A file with errors is skipped whole.
 */
export async function importWorkoutFiles(files: readonly { name: string; text: string }[], target: ImportTarget, now = Date.now()): Promise<ImportLine[]> {
  const sorted = [...files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
  const thresholds = await sessionThresholds()
  const ftpW = (await currentFtp())?.ftpW ?? DEFAULT_FTP_W
  const lines: ImportLine[] = []
  for (const f of sorted) {
    if (isSessionFile(f.text)) {
      const r = sessionFromFile(f.name, f.text, thresholds, now)
      const base = { file: f.name, kind: 'session' as const, name: r.parsed.name, ...(r.parsed.header.sport ? { sport: r.parsed.header.sport } : {}), errors: r.errors, warnings: r.warnings }
      if (!r.workout) {
        lines.push({ ...base, outcome: 'skipped' })
        continue
      }
      if (target === 'calendar' && !r.date) {
        lines.push({ ...base, outcome: 'skipped', errors: [{ text: NO_DATE }] })
        continue
      }
      const saved = await saveSessionWorkout(r.workout)
      if (target === 'calendar' && r.date) {
        await planSessionWorkout(r.date, saved)
        lines.push({ ...base, outcome: 'day', date: r.date })
      } else lines.push({ ...base, outcome: 'library' })
      continue
    }
    // a bike workout
    const date = parseDatedFileName(f.name).date
    if (target === 'calendar' && !date) {
      lines.push({ file: f.name, kind: 'bike', outcome: 'skipped', errors: [{ text: NO_DATE }], warnings: [] })
      continue
    }
    try {
      const { workout, warnings } = parseWorkoutFile(f.name, f.text)
      const named = date ? { ...workout, name: workout.name === f.name.replace(/\.[^.]+$/, '') ? parseDatedFileName(f.name).rest : workout.name } : workout
      const saved = await saveWorkout(named, ftpW)
      const warn = warnings.map((text) => ({ text }))
      if (target === 'calendar' && date) {
        await scheduleWorkout(date, saved)
        lines.push({ file: f.name, kind: 'bike', name: saved.name, outcome: 'day', date, errors: [], warnings: warn })
      } else lines.push({ file: f.name, kind: 'bike', name: saved.name, outcome: 'library', errors: [], warnings: warn })
    } catch (e) {
      lines.push({ file: f.name, kind: 'bike', outcome: 'skipped', errors: [{ text: e instanceof Error ? e.message : String(e) }], warnings: [] })
    }
  }
  return lines
}

/** "3 on the calendar, 1 skipped": the report's headline. */
export function summarizeImport(lines: readonly ImportLine[]): string {
  const n = (o: ImportLine['outcome']) => lines.filter((l) => l.outcome === o).length
  const parts = [n('day') && `${n('day')} on the calendar`, n('library') && `${n('library')} in the library`, n('plan') && `${n('plan')} in the plan`, n('skipped') && `${n('skipped')} skipped`].filter(Boolean)
  return parts.length > 0 ? `${parts.join(', ')}.` : 'Nothing to import.'
}
