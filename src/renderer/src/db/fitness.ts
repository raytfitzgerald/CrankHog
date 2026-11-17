// Fitness data prep from stored rides and other sports. Simulated rides never
// count. Fitness, fatigue, form and weekly load count every sport by default;
// the power curve and FTP are rides only. The AI fitness overview asks for
// rides only (sports: 'rides'); the coach chat gets every sport.
import { computePmc, estimateFtp, mergeMmp, type PmcRow } from '@core/metrics'
import type { RideSummary } from '@core/ride/types'
import { dailyLoad } from '@core/sport/daily-load'
import { activityLoad } from '@core/sport/load'
import { db, type FtpEntry, type OtherActivity } from './db'

/** Which sessions count: every sport (the default), or rides alone (for what the AI is given). */
export interface SportsOption {
  sports?: 'all' | 'rides'
}

const DAY = 86_400_000

export const isoDay = (ms: number): string => {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export async function realRides(sinceMs = 0): Promise<RideSummary[]> {
  const rows = await db().rides.where('startedAt').above(sinceMs).toArray()
  return rows.filter((r) => !r.simulated).sort((a, b) => a.startedAt - b.startedAt)
}

/** Runs, swims and other sports since `sinceMs`, oldest first. */
export async function otherActivities(sinceMs = 0): Promise<OtherActivity[]> {
  const rows = await db().activities.where('startedAt').above(sinceMs).toArray()
  return rows.sort((a, b) => a.startedAt - b.startedAt)
}

export async function pmcSeries(days = 180, opts: SportsOption = {}): Promise<PmcRow[]> {
  // Warm the model up with everything we have; display the last `days`.
  const rides = await realRides(0)
  const activities = opts.sports === 'rides' ? [] : await otherActivities(0)
  if (rides.length === 0 && activities.length === 0) return []
  const now = new Date()
  const today = isoDay(now.getTime())
  // calendar days, not 24-hour steps, so a clock change can't shift the range
  const from = isoDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - days).getTime())
  return computePmc(dailyLoad({ rides, activities: activities.map((a) => ({ startedAt: a.startedAt, load: activityLoad(a) })) }), { from, to: today })
}

export interface WeeklyLoad {
  weekStart: number
  tss: number
  hours: number
  kj: number
  rides: number
  /** Runs, swims and other sessions (0 when asked for rides only). */
  others: number
}

export async function weeklyLoad(weeks = 16, opts: SportsOption = {}): Promise<WeeklyLoad[]> {
  const now = new Date()
  const monday = now.getDate() - ((now.getDay() + 6) % 7)
  // each week starts on a calendar Monday, so a clock change can't move a ride into the wrong week
  const starts = Array.from({ length: weeks + 1 }, (_, i) => new Date(now.getFullYear(), now.getMonth(), monday + (i - weeks + 1) * 7).getTime())
  const start = starts[0]!
  const rides = await realRides(start)
  const out: WeeklyLoad[] = starts.slice(0, weeks).map((weekStart) => ({ weekStart, tss: 0, hours: 0, kj: 0, rides: 0, others: 0 }))
  const weekOf = (t: number): WeeklyLoad | undefined => {
    let i = starts.findIndex((s) => s > t) - 1
    if (i < -1) i = weeks - 1
    return out[i]
  }
  for (const r of rides) {
    const w = weekOf(r.startedAt)
    if (!w) continue
    w.tss += r.tss ?? 0
    w.hours += r.movingS / 3600
    w.kj += r.kj
    w.rides++
  }
  if (opts.sports !== 'rides') {
    for (const a of await otherActivities(start)) {
      const w = weekOf(a.startedAt)
      if (!w) continue
      w.tss += activityLoad(a) ?? 0
      w.hours += a.movingS / 3600
      w.others++
    }
  }
  return out
}

export interface PowerCurve {
  last90: { durationS: number; watts: number }[]
  last365: { durationS: number; watts: number }[]
  eftp: ReturnType<typeof estimateFtp>
}

export async function powerCurve(): Promise<PowerCurve> {
  const rides = await realRides(Date.now() - 365 * DAY)
  let last90: { durationS: number; watts: number }[] = []
  let last365: { durationS: number; watts: number }[] = []
  const cut = Date.now() - 90 * DAY
  for (const r of rides) {
    last365 = mergeMmp(last365, r.mmp)
    if (r.startedAt >= cut) last90 = mergeMmp(last90, r.mmp)
  }
  return { last90, last365, eftp: estimateFtp(last90) }
}

export async function ftpTimeline(): Promise<FtpEntry[]> {
  return db().ftpHistory.orderBy('date').toArray()
}
