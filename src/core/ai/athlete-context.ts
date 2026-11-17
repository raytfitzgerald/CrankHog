// Everything CrankHog knows about the rider, as the JSON the coach chat reads
// with each message: profile and thresholds, FTP, fitness, recent rides and
// other sports, training plans, the calendar (planned, done and missed, with
// each session's steps), events and days off, and the rider's own workouts.
// Numbers are worked out here so the model never has to. Nothing comes from
// Strava: intervals.icu doesn't pass Strava activities on. The rider's name
// stays out (it is never sent anywhere). Cut to a budget by dropping detail
// (laps, steps, far days) before anything else.
import { computePmc, projectPmc, type PmcDay } from '../metrics/pmc'
import type { RideSummary } from '../ride/types'
import { activityGroup, type SportGroup } from '../sport/group'
import { activityLoad, type Effort } from '../sport/load'
import { formatPace } from '../sport/session-input'
import { weekdayOf, type DayMark, type TrainingPlan } from '../workout/plan'
import { addDays, completions, dateKey, dateKeyToMs, entrySport, scheduleStatus, type DateKey, type ScheduledWorkout } from '../workout/schedule'

/** The rider's profile as of today. */
export interface ContextProfile {
  weightKg: number
  heightCm?: number
  birthYear?: number
  lthr?: number
  maxHr?: number
  restHr?: number
  cpW?: number
  wPrimeJ?: number
  runThresholdPaceSPerKm?: number
  swimCssSPer100m?: number
}

/** A run, swim or other session, or an outdoor ride synced from intervals.icu. */
export interface ContextActivity {
  id: string
  startedAt: number
  sport: string
  subSport: string | null
  group?: SportGroup
  name: string
  label?: string
  movingS: number
  distanceM: number | null
  avgHr: number | null
  maxHr: number | null
  hrLoad: number | null
  icuLoad?: number | null
  manualLoad?: number | null
  trainingEffect: { aerobic: number; anaerobic: number | null } | null
  effort?: Effort
  notes?: string
  source?: 'fit' | 'intervals' | 'manual'
}

/** What a calendar entry is, as the renderer looked it up: its length and load at today's FTP, and its steps. */
export interface ContextPlanned {
  durationS: number | null
  /** TSS for a bike workout, the planned load for any other session. */
  load: number | null
  distanceM: number | null
  /** A bike workout's intervals.icu text, or a session's steps. */
  steps?: string
  /** The workout's description, or the session's notes. */
  notes?: string
}

/** A workout in the rider's library: one of their own, or a favourite. */
export interface ContextWorkout {
  name: string
  sport: SportGroup
  durationS: number | null
  load: number | null
  distanceM?: number | null
  tags: readonly string[]
  favorite: boolean
}

export interface AthleteContextInput {
  now: number
  /** What the rider reads distances and weights in (the data itself is metric). */
  units: { distance: 'km' | 'mi'; weight: 'kg' | 'lb' }
  profile: ContextProfile | null
  /** Oldest first. */
  ftpHistory: readonly { date: number; ftpW: number; source: string }[]
  eftpW: number | null
  bestPower: { last90: readonly MmpPoint[]; last365: readonly MmpPoint[] }
  /** Load by week, oldest first, every sport. */
  weeks: readonly { weekStart: number; tss: number; hours: number; rides: number; others: number }[]
  /** Real (not simulated) rides, oldest first: recent ones, and far enough back to tell which planned workouts were done. */
  rides: readonly RideSummary[]
  /** Other sports over the same span, oldest first. */
  activities: readonly ContextActivity[]
  /** Each day's load from every sport, all time: for fitness now and on race day. */
  loadHistory: readonly PmcDay[]
  plans: readonly TrainingPlan[]
  /** Every calendar entry. */
  schedule: readonly ScheduledWorkout[]
  /** What each entry is, by entry id, for entries from four weeks ago on. */
  planned: ReadonlyMap<string, ContextPlanned>
  marks: readonly DayMark[]
  workouts: readonly ContextWorkout[]
}

interface MmpPoint {
  durationS: number
  watts: number
}

/**
 * How much the context holds, most first: the first one that fits the budget
 * is sent. `laps` is how many of the latest rides keep their laps; `stepsDays`
 * how many days ahead planned sessions carry their steps and notes.
 */
interface Detail {
  rides: number
  laps: number
  activities: number
  pastDays: number
  aheadDays: number
  stepsDays: number
  entries: number
  plans: number
  events: number
  workouts: number
}

const DETAIL: readonly Detail[] = [
  { rides: 20, laps: 10, activities: 30, pastDays: 28, aheadDays: 84, stepsDays: 14, entries: 160, plans: 10, events: 20, workouts: 60 },
  { rides: 20, laps: 5, activities: 30, pastDays: 28, aheadDays: 56, stepsDays: 7, entries: 110, plans: 10, events: 20, workouts: 40 },
  { rides: 15, laps: 2, activities: 20, pastDays: 14, aheadDays: 42, stepsDays: 3, entries: 70, plans: 8, events: 15, workouts: 20 },
  { rides: 10, laps: 0, activities: 10, pastDays: 7, aheadDays: 21, stepsDays: 1, entries: 40, plans: 5, events: 10, workouts: 0 },
  { rides: 5, laps: 0, activities: 5, pastDays: 3, aheadDays: 14, stepsDays: 0, entries: 20, plans: 3, events: 5, workouts: 0 },
]

/** Characters of JSON the coach gets: with the voice block and the question, well inside the 60 000 a chat message may hold. */
export const CONTEXT_BUDGET = 40_000

/** How far back rides and other sports are listed. */
const RECENT_DAYS = 42
const BEST_DURATIONS = [5, 60, 300, 1200, 3600]
const WEEKDAY = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const
const DAY_MS = 86_400_000

const r1 = (v: number | null | undefined) => (v === null || v === undefined ? null : Math.round(v * 10) / 10)
const r2 = (v: number) => Math.round(v * 100) / 100
/** "2026-11-18 Wed": models get weekdays wrong when left to work them out. */
const day = (key: DateKey) => `${key} ${WEEKDAY[weekdayOf(key)]}`
const daysBetween = (a: DateKey, b: DateKey) => Math.round((dateKeyToMs(b) - dateKeyToMs(a)) / DAY_MS)

/** Text cut to `max` characters, with "…" when it goes on; undefined when empty. */
function clip(text: string | undefined, max: number): string | undefined {
  const t = text?.trim()
  if (!t) return undefined
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`
}

const best = (points: readonly MmpPoint[]) => Object.fromEntries(points.filter((p) => BEST_DURATIONS.includes(p.durationS)).map((p) => [`${p.durationS}s`, Math.round(p.watts)]))

/** Compact, model-friendly summary of one ride (all numbers computed by CrankHog), with up to `laps` laps. */
export function rideFacts(r: RideSummary, laps = 30) {
  return {
    date: day(dateKey(r.startedAt)),
    name: clip(r.name, 80),
    kind: r.kind,
    movingMin: Math.round(r.movingS / 60),
    km: r2(r.distanceM / 1000),
    np: r.np,
    avgPower: r.avgPower,
    if: r.intensityFactor,
    tss: r1(r.tss),
    kj: Math.round(r.kj),
    avgHr: r.avgHr,
    maxHr: r.maxHr,
    avgCadence: r.avgCadence,
    decouplingPct: r1(r.decouplingPct),
    ef: r.ef,
    vi: r.vi,
    ftpAtRide: r.athlete.ftpW,
    zonesMin: r.powerZonesS.map((s) => Math.round(s / 60)),
    best: best(r.mmp),
    ...(laps > 0 ? { laps: r.laps.slice(0, laps).map((l) => ({ label: clip(l.label, 40), s: l.durationS, avgW: l.avgPower, targetW: l.targetW, hr: l.avgHr, rpm: l.avgCadence })) } : {}),
    rpe: r.rpe,
    notes: clip(r.notes, 300),
  }
}

/** Pace for a run (per km) or a swim (per 100 m). */
function paceOf(sport: SportGroup, movingS: number, distanceM: number | null): string | undefined {
  if (!distanceM || distanceM <= 0 || movingS <= 0) return undefined
  if (sport === 'run') return `${formatPace(movingS / (distanceM / 1000))}/km`
  if (sport === 'swim') return `${formatPace(movingS / (distanceM / 100))}/100m`
  return undefined
}

/** Distance in km, or metres for a swim. */
function distanceOf(sport: SportGroup, m: number | null | undefined): { km?: number; m?: number } {
  if (!m || m <= 0) return {}
  return sport === 'swim' ? { m: Math.round(m) } : { km: r2(m / 1000) }
}

function activityFacts(a: ContextActivity) {
  const sport = activityGroup(a)
  return {
    date: day(dateKey(a.startedAt)),
    sport,
    type: a.sport,
    name: clip(a.label ?? a.name, 80),
    min: Math.round(a.movingS / 60),
    ...distanceOf(sport, a.distanceM),
    pace: paceOf(sport, a.movingS, a.distanceM),
    avgHr: a.avgHr ?? undefined,
    maxHr: a.maxHr ?? undefined,
    load: r1(activityLoad(a)) ?? undefined,
    effort: a.effort,
    trainingEffect: a.trainingEffect ?? undefined,
    notes: clip(a.notes, 200),
    from: a.source ?? 'fit',
  }
}

function athleteFacts(input: AthleteContextInput, today: DateKey) {
  const p = input.profile
  const ftp = [...input.ftpHistory].reverse().find((f) => f.date <= input.now)
  return {
    ftpW: ftp?.ftpW,
    eftpW: input.eftpW ?? undefined,
    weightKg: p?.weightKg,
    wPerKg: ftp && p?.weightKg ? r2(ftp.ftpW / p.weightKg) : undefined,
    age: p?.birthYear ? Number(today.slice(0, 4)) - p.birthYear : undefined,
    heightCm: p?.heightCm,
    lthr: p?.lthr,
    maxHr: p?.maxHr,
    restHr: p?.restHr,
    cpW: p?.cpW,
    wPrimeKj: p?.wPrimeJ ? r1(p.wPrimeJ / 1000) : undefined,
    runThresholdPace: p?.runThresholdPaceSPerKm ? `${formatPace(p.runThresholdPaceSPerKm)}/km` : undefined,
    swimCss: p?.swimCssSPer100m ? `${formatPace(p.swimCssSPer100m)}/100m` : undefined,
  }
}

const pmcFacts = (row: { ctl: number; atl: number; tsb: number } | undefined) => (row ? { ctl: r1(row.ctl), atl: r1(row.atl), tsb: r1(row.tsb) } : null)

/** What is worked out once, whatever the detail: which entries were done, fitness now and on each event day. */
function prepare(input: AthleteContextInput) {
  const today = dateKey(input.now)
  const done = completions(
    input.schedule,
    input.rides.map((r) => ({ id: r.id, startedAt: r.startedAt, workoutId: r.workoutId, simulated: r.simulated })),
    input.activities.map((a) => ({ id: a.id, startedAt: a.startedAt, group: activityGroup(a) })),
  )
  const fitness = computePmc(input.loadHistory, { from: addDays(today, -RECENT_DAYS), to: today })
  const events = input.marks.filter((m) => m.kind === 'event').sort((a, b) => a.date.localeCompare(b.date))
  const lastEvent = events.at(-1)?.date
  const ahead = input.schedule.filter((e) => e.date > today && !done.has(e.id)).map((e) => ({ date: e.date, tss: input.planned.get(e.id)?.load ?? 0 }))
  const projected = lastEvent && lastEvent > today ? projectPmc(input.loadHistory, ahead, { today, from: addDays(today, 1), to: lastEvent }) : []
  return { today, done, fitness, events, projected: new Map(projected.map((r) => [r.date, r])) }
}

type Prepared = ReturnType<typeof prepare>

function planFacts(p: TrainingPlan, input: AthleteContextInput, prep: Prepared) {
  const { today, done } = prep
  const race = p.eventId ? input.marks.find((m) => m.id === p.eventId) : undefined
  const base = {
    name: clip(p.name, 80),
    description: clip(p.description, 300),
    madeFrom: p.source,
    onCalendar: p.onCalendar,
    sessions: p.items.filter((i) => !i.removed).length,
    trainingDays: p.rideDays.map((d) => WEEKDAY[d]),
    survey: p.survey ? { goal: p.survey.goal, focus: p.survey.focus, hoursPerWeek: p.survey.hoursPerWeek } : undefined,
    race: race ? { name: clip(race.name, 80), date: day(race.date), priority: race.priority } : undefined,
    datedFromRace: p.anchor === 'race' ? true : undefined,
  }
  const entries = input.schedule.filter((e) => e.planId === p.id).sort((a, b) => a.date.localeCompare(b.date))
  if (!p.onCalendar || entries.length === 0) return base
  const first = entries[0]!.date
  const last = entries.at(-1)!.date
  // weeks run Monday to Sunday from the week of the plan's first session
  const monday = addDays(first, -weekdayOf(first))
  const weeks = Math.floor(daysBetween(monday, last) / 7) + 1
  const week = today < first ? `starts in ${daysBetween(today, first)} days` : today > last ? 'finished' : `${Math.floor(daysBetween(monday, today) / 7) + 1} of ${weeks}`
  const count = { done: 0, missed: 0, today: 0, planned: 0 }
  for (const e of entries) count[scheduleStatus(e, done.has(e.id), today)]++
  return { ...base, firstDay: day(first), lastDay: day(last), week, ...count }
}

function calendarFacts(input: AthleteContextInput, prep: Prepared, d: Detail) {
  const { today, done } = prep
  const from = addDays(today, -d.pastDays)
  const to = addDays(today, d.aheadDays)
  const stepsTo = addDays(today, d.stepsDays)
  const planNames = new Map(input.plans.map((p) => [p.id, clip(p.name, 80)]))
  const near = (e: ScheduledWorkout) => Math.abs(daysBetween(today, e.date))
  const entries = input.schedule
    .filter((e) => e.date >= from && e.date <= to)
    .sort((a, b) => near(a) - near(b) || b.date.localeCompare(a.date))
    .slice(0, d.entries)
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt)
  return entries.map((e) => {
    const sport = entrySport(e)
    const status = scheduleStatus(e, done.has(e.id), today)
    const what = input.planned.get(e.id)
    const detailed = e.date >= today && e.date < stepsTo && status !== 'done'
    return {
      date: day(e.date),
      name: clip(e.name, 80),
      sport,
      label: e.session?.label && e.session.label !== e.name ? clip(e.session.label, 80) : undefined,
      plan: e.planId ? planNames.get(e.planId) : undefined,
      status,
      min: what?.durationS ? Math.round(what.durationS / 60) : undefined,
      load: r1(what?.load) ?? undefined,
      ...distanceOf(sport, what?.distanceM),
      effort: e.session?.effort,
      ...(detailed ? { steps: clip(what?.steps, 1500), notes: clip(what?.notes, 300) } : {}),
    }
  })
}

function eventFacts(prep: Prepared, d: Detail) {
  const { today } = prep
  return prep.events
    .filter((m) => m.date >= addDays(today, -90))
    .slice(0, d.events)
    .map((m) => {
      const form = prep.projected.get(m.date)
      return {
        date: day(m.date),
        name: clip(m.name, 80),
        priority: m.priority,
        daysAway: daysBetween(today, m.date),
        note: clip(m.note, 200),
        projectedForm: form ? pmcFacts(form) : undefined,
      }
    })
}

function shape(input: AthleteContextInput, prep: Prepared, d: Detail) {
  const { today, fitness } = prep
  const recent = dateKeyToMs(addDays(today, -RECENT_DAYS))
  const rides = input.rides.filter((r) => r.startedAt >= recent).slice(-d.rides)
  const plans = [...input.plans].sort((a, b) => Number(b.onCalendar) - Number(a.onCalendar) || b.updatedAt - a.updatedAt).slice(0, d.plans)
  const from = addDays(today, -d.pastDays)
  const to = addDays(today, d.aheadDays)
  return {
    today: day(today),
    riderUnits: input.units,
    athlete: athleteFacts(input, today),
    ftpHistory: input.ftpHistory.slice(-8).map((f) => ({ date: dateKey(f.date), ftpW: f.ftpW, source: f.source })),
    fitness: { now: pmcFacts(fitness.at(-1)), sixWeeksAgo: pmcFacts(fitness[0]) },
    weeks: input.weeks.map((w) => ({ from: dateKey(w.weekStart), load: Math.round(w.tss), hours: r1(w.hours), rides: w.rides, otherSessions: w.others })),
    bestPower: { last90d: best(input.bestPower.last90), last365d: best(input.bestPower.last365) },
    plans: plans.map((p) => planFacts(p, input, prep)),
    events: eventFacts(prep, d),
    daysOff: input.marks
      .filter((m) => m.kind !== 'event' && m.date >= from && m.date <= to)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 30)
      .map((m) => ({ date: day(m.date), kind: m.kind, note: clip(m.note, 120) })),
    calendar: calendarFacts(input, prep, d),
    rides: rides.map((r, i) => rideFacts(r, i >= rides.length - d.laps ? 30 : 0)),
    otherActivities: input.activities
      .filter((a) => a.startedAt >= recent)
      .slice(-d.activities)
      .map(activityFacts),
    workouts: input.workouts.slice(0, d.workouts).map((w) => ({
      name: clip(w.name, 80),
      sport: w.sport,
      min: w.durationS ? Math.round(w.durationS / 60) : undefined,
      load: r1(w.load) ?? undefined,
      ...distanceOf(w.sport, w.distanceM),
      tags: w.tags.length > 0 ? w.tags.slice(0, 4).map((t) => clip(t, 30)) : undefined,
      favorite: w.favorite || undefined,
    })),
  }
}

/** What the coach's JSON holds (fields left undefined are left out). */
export type AthleteContextJson = ReturnType<typeof shape>

/** The coach's JSON: the most detail that fits in `budget` characters. */
export function athleteContext(input: AthleteContextInput, budget = CONTEXT_BUDGET): string {
  const prep = prepare(input)
  let json = ''
  for (const d of DETAIL) {
    json = JSON.stringify(shape(input, prep, d))
    if (json.length <= budget) break
  }
  return json
}
