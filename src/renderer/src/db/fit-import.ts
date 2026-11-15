// Imports FIT activities (Garmin, Wahoo, other apps, or CrankHog's own files)
// into the local history, so fitness charts and bests include them.
import { FitImportError, importFitActivity, importOtherActivity, splitMultisport, type DecodedFit } from '@core/fit/import'
import { activityName } from '@core/fit/sport'
import { hrLoad, lthrFor } from '@core/metrics/hr-load'
import { finalizeRide } from '@core/ride/finalize'
import { athleteSnapshot } from './athlete-repo'
import { db } from './db'

export interface FitImportReport {
  imported: { name: string; rideId: string }[]
  /** Runs, swims and strength sessions, kept for the calendar. */
  activities: { name: string; id: string }[]
  skipped: { name: string; reason: string }[]
}

/** "2 rides and 1 other activity", for the import messages. */
export function describeImport(r: Pick<FitImportReport, 'imported' | 'activities'>): string {
  const rides = `${r.imported.length} ride${r.imported.length === 1 ? '' : 's'}`
  const others = `${r.activities.length} other activit${r.activities.length === 1 ? 'y' : 'ies'}`
  if (r.activities.length === 0) return rides
  return r.imported.length === 0 ? others : `${rides} and ${others}`
}

/** Two rides that start within this long of each other are the same ride. */
const SAME_RIDE_MS = 90_000

export async function importFitFiles(files: { name: string; bytes: Uint8Array }[], onProgress?: (done: number, total: number) => void): Promise<FitImportReport> {
  const { default: FitParser } = await import('fit-file-parser')
  const starts = (await db().rides.orderBy('startedAt').keys()) as number[]
  const otherStarts = (await db().activities.orderBy('startedAt').keys()) as number[]
  const report: FitImportReport = { imported: [], activities: [], skipped: [] }
  let done = 0
  for (const f of files) {
    try {
      const ab = f.bytes.buffer.slice(f.bytes.byteOffset, f.bytes.byteOffset + f.bytes.byteLength) as ArrayBuffer
      let decoded: DecodedFit
      try {
        decoded = (await new FitParser({ mode: 'list', force: true }).parseAsync(ab)) as unknown as DecodedFit
      } catch {
        throw new FitImportError('no-records', 'Not a readable FIT file.')
      }
      // a triathlon's swim, bike and run come in on their own
      for (const leg of splitMultisport(decoded)) {
        try {
          await importLeg(f.name, leg, { starts, otherStarts, report })
        } catch (e) {
          report.skipped.push({ name: f.name, reason: e instanceof Error ? e.message : String(e) })
        }
      }
    } catch (e) {
      report.skipped.push({ name: f.name, reason: e instanceof Error ? e.message : String(e) })
    } finally {
      onProgress?.(++done, files.length)
    }
  }
  return report
}

/** One activity: a ride into the history, anything else onto the calendar. Throws to skip it. */
async function importLeg(fileName: string, decoded: DecodedFit, into: { starts: number[]; otherStarts: number[]; report: FitImportReport }): Promise<void> {
  const { starts, report } = into
  let imp
  try {
    imp = importFitActivity(decoded)
  } catch (e) {
    if (!(e instanceof FitImportError) || e.code !== 'not-cycling') throw e
    report.activities.push(await saveOtherActivity(fileName, decoded, into.otherStarts))
    return
  }
  if (starts.some((s) => Math.abs(s - imp.startedAt) < SAME_RIDE_MS)) throw new FitImportError('no-records', 'Already in your history.')
  const athlete = await athleteSnapshot(imp.startedAt)
  const rideId = `fit-${imp.startedAt.toString(36)}`
  const name = rideName(fileName, imp.indoor, imp.startedAt)
  const fin = finalizeRide({
    rideId,
    name,
    kind: 'free',
    simulated: false,
    startedAt: imp.startedAt,
    athlete,
    records: imp.records,
    utcOffsetMin: -new Date(imp.startedAt).getTimezoneOffset(),
    softwareVersion: 10,
    now: Date.now(),
    imported: { fileName, device: imp.device ?? undefined },
    elevationGainM: imp.elevationGainM,
  })
  await db().transaction('rw', db().rides, db().rideStreams, async () => {
    await db().rides.put(fin.summary)
    await db().rideStreams.put(fin.streams)
  })
  starts.push(imp.startedAt)
  report.imported.push({ name, rideId })
}

/** A run, swim or strength session: a summary with its hrTSS, for the calendar. */
async function saveOtherActivity(fileName: string, decoded: DecodedFit, starts: number[]): Promise<{ name: string; id: string }> {
  const a = importOtherActivity(decoded)
  if (starts.some((s) => Math.abs(s - a.startedAt) < SAME_RIDE_MS)) throw new FitImportError('no-records', 'Already on your calendar.')
  const athlete = await athleteSnapshot(a.startedAt)
  const id = `act-${a.startedAt.toString(36)}`
  const name = activityName(a.sport, a.startedAt)
  await db().activities.put({
    id,
    startedAt: a.startedAt,
    sport: a.sport,
    subSport: a.subSport,
    name,
    movingS: a.movingS,
    distanceM: a.distanceM,
    avgHr: a.avgHr,
    maxHr: a.maxHr,
    hrLoad: hrLoad(a.hr, lthrFor(athlete)),
    trainingEffect: a.trainingEffect,
    garminLoad: a.garminLoad,
    device: a.device,
    fileName,
  })
  starts.push(a.startedAt)
  return { name, id }
}

/** "2026-09-29 0712 - Sweet Spot 3x15.fit" (CrankHog) keeps its name; others get a time-of-day name. */
export function rideName(fileName: string, indoor: boolean, startedAt: number): string {
  const ours = /^\d{4}-\d{2}-\d{2} \d{4} - (.+)\.fit$/i.exec(fileName)
  if (ours?.[1]) return ours[1]
  const h = new Date(startedAt).getHours()
  const part = h < 5 ? 'Night' : h < 11 ? 'Morning' : h < 14 ? 'Lunch' : h < 18 ? 'Afternoon' : 'Evening'
  return `${part} ${indoor ? 'indoor ride' : 'ride'}`
}
