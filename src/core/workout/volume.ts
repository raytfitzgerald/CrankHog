// Training volume for a run of calendar days: what was planned against what
// was done, the way TrainingPeaks sums a week. Load is TSS for rides and
// hrTSS for other sports, so the two add up.
import { dateKey, type DateKey } from './schedule'

export interface VolumeInput {
  today: DateKey
  /** Scheduled workouts, with their length and TSS at the rider's FTP where known. */
  planned: readonly { date: DateKey; durationS: number | null; load: number | null; done: boolean }[]
  rides: readonly { startedAt: number; movingS: number; tss: number | null; simulated: boolean }[]
  /** Other sports (Garmin FIT imports). */
  activities: readonly { startedAt: number; movingS: number; hrLoad: number | null }[]
}

export interface VolumeSide {
  sessions: number
  durationS: number
  load: number
}

export interface VolumeTotals {
  planned: VolumeSide
  completed: VolumeSide
  /** Planned workouts done, out of those due by today; null when none was due yet. */
  compliance: number | null
}

/** Volume from `from` to `to`, both days included. */
export function volumeBetween(from: DateKey, to: DateKey, input: VolumeInput): VolumeTotals {
  const inRange = (d: DateKey) => d >= from && d <= to
  const planned: VolumeSide = { sessions: 0, durationS: 0, load: 0 }
  let due = 0
  let doneDue = 0
  for (const p of input.planned) {
    if (!inRange(p.date)) continue
    planned.sessions++
    planned.durationS += p.durationS ?? 0
    planned.load += p.load ?? 0
    if (p.date <= input.today) {
      due++
      if (p.done) doneDue++
    }
  }
  const completed: VolumeSide = { sessions: 0, durationS: 0, load: 0 }
  for (const r of input.rides) {
    if (r.simulated || !inRange(dateKey(r.startedAt))) continue
    completed.sessions++
    completed.durationS += r.movingS
    completed.load += r.tss ?? 0
  }
  for (const a of input.activities) {
    if (!inRange(dateKey(a.startedAt))) continue
    completed.sessions++
    completed.durationS += a.movingS
    completed.load += a.hrLoad ?? 0
  }
  return { planned, completed, compliance: due === 0 ? null : doneDue / due }
}
