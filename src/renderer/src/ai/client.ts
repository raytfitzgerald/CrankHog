// Renderer-side AI helpers. All calls go through main (keys never live here).
import { coachVoice } from '@core/coach'
import { athleteContext, CONTEXT_BUDGET, type ContextPlanned, type ContextWorkout } from '@core/ai/athlete-context'
import type { AiMessage, AiToolCall } from '@core/ai/types'
import type { FitnessFacts } from '@core/metrics'
import { dailyLoad } from '@core/sport/daily-load'
import { activityLoad } from '@core/sport/load'
import { distanceUnit, weightUnit } from '@core/units'
import { toIntervalsText } from '@core/workout/io/intervals-text'
import { addDays, dateKey, isBikeWorkout, type ScheduledWorkout } from '@core/workout/schedule'
import { isoDay, otherActivities, pmcSeries, powerCurve, realRides, weeklyLoad } from '../db/fitness'
import { currentFtp, currentProfile, DEFAULT_FTP_W, ftpHistory } from '../db/athlete-repo'
import { db } from '../db/db'
import { bridge } from '../platform/bridge'
import { coachPack, customCoach } from '../coach/custom'
import { settingsStore } from '../stores/settings'
import { describeWorkout, getWorkout, loadLibrary, plannedStatsOf } from '../workouts/library'
import { listSessionWorkouts, plannedFrom, sessionSteps, sessionThresholds } from '../workouts/sessions-repo'

/** The [Coach settings] block for the rider's coach as set right now (persona, spice, language), with the coach's master prompt and the rider's notes for any coach. */
export function coachVoiceNow(): string {
  const c = settingsStore.getState().coach
  return coachVoice(coachPack(c.personaId), { spice: c.spice, profanity: c.profanity }, { instructions: customCoach(c.personaId)?.instructions, notes: c.notes })
}

/** Settings that change what the coach would write, for telling when a cached text is stale. */
export function coachVoiceKey(): string {
  const c = settingsStore.getState().coach
  // a custom coach with a new name, description or master prompt is a different coach (a new photo isn't)
  const custom = customCoach(c.personaId)
  const notes = c.notes.trim() ? `#${hash(c.notes.trim())}` : ''
  return `${c.personaId}${custom ? `@${hash(`${custom.name}\n${custom.persona}\n${custom.instructions}`)}` : ''}/${c.spice}/${c.profanity}${notes}`
}

/** A short, stable fingerprint (FNV-1a), for cache keys. */
function hash(text: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193)
  return (h >>> 0).toString(36)
}

export interface StreamEnd {
  text: string | null
  error: string | null
  code: string | null
  model: string | null
  /** The coach chat's proposals, unchecked. */
  toolCalls?: AiToolCall[]
}

export interface StreamHandle {
  done: Promise<StreamEnd>
  cancel(): void
}

export function streamAi(purpose: 'debrief' | 'chat' | 'fitness-summary', messages: AiMessage[], onDelta: (text: string) => void): StreamHandle {
  const streamId = `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
  let offDelta = () => {}
  let offEnd = () => {}
  const done = new Promise<StreamEnd>((resolve) => {
    offDelta = bridge().on('ai.stream.delta', (d) => {
      if (d.streamId === streamId) onDelta(d.text)
    })
    offEnd = bridge().on('ai.stream.end', (e) => {
      if (e.streamId !== streamId) return
      offDelta()
      offEnd()
      resolve(e)
    })
    void bridge()
      .invoke('ai.stream.start', { streamId, purpose, messages })
      .catch((e: unknown) => {
        offDelta()
        offEnd()
        resolve({ text: null, error: e instanceof Error ? e.message : String(e), code: 'provider', model: null })
      })
  })
  return {
    done,
    cancel: () => void bridge().invoke('ai.stream.cancel', { streamId }),
  }
}

const r1 = (v: number | null | undefined) => (v === null || v === undefined ? null : Math.round(v * 10) / 10)

/**
 * Everything the coach chat is given about the rider, read fresh for each
 * message: see src/core/ai/athlete-context.ts for what it holds. Every
 * stored ride, other sport, plan and calendar entry; never Strava data.
 */
export async function coachContext(now = Date.now(), draft?: unknown, budget = CONTEXT_BUDGET): Promise<string> {
  const settings = settingsStore.getState()
  const [ftps, profile, curve, weeks, rides, activities, plans, schedule, marks, sessions, thresholds] = await Promise.all([
    ftpHistory(),
    currentProfile(now),
    powerCurve(),
    weeklyLoad(6),
    realRides(0),
    otherActivities(0),
    db().plans.toArray(),
    db().schedule.toArray(),
    db().dayMarks.toArray(),
    listSessionWorkouts(),
    sessionThresholds(),
  ])
  const ftpW = [...ftps].reverse().find((f) => f.date <= now)?.ftpW ?? DEFAULT_FTP_W
  const from = addDays(dateKey(now), -28)
  const planned = new Map<string, ContextPlanned>()
  for (const e of schedule) if (e.date >= from) planned.set(e.id, await plannedFacts(e, ftpW))
  const library = await loadLibrary(ftpW)
  const workouts: ContextWorkout[] = [
    ...library
      .filter((e) => e.favorite || (!e.builtin && e.folder === 'custom'))
      .map((e) => {
        const stats = plannedStatsOf(e.workout, e.stats)
        return { name: e.workout.name, sport: 'ride' as const, durationS: stats.durationS, load: stats.tss, tags: e.workout.tags, favorite: e.favorite }
      }),
    ...sessions.map((w) => {
      const p = plannedFrom(w, thresholds)
      return { name: w.name, sport: w.sport, durationS: p.durationS ?? null, load: p.load ?? null, distanceM: p.distanceM ?? null, tags: w.tags, favorite: false }
    }),
  ]
  return athleteContext({
    now,
    units: { distance: distanceUnit(settings.units), weight: weightUnit(settings.weightUnit) },
    profile,
    ftpHistory: ftps,
    eftpW: curve.eftp.ftpW ? Math.round(curve.eftp.ftpW) : null,
    bestPower: { last90: curve.last90, last365: curve.last365 },
    weeks,
    rides,
    activities,
    loadHistory: dailyLoad({ rides, activities: activities.map((a) => ({ startedAt: a.startedAt, load: activityLoad(a) })) }),
    plans,
    schedule,
    planned,
    marks,
    workouts,
    ...(draft !== undefined ? { draft } : {}),
  }, budget)
}

/** A calendar entry's length and load at `ftpW`, and its steps: a bike workout's as intervals.icu text, a session's as planned. */
export async function plannedFacts(e: ScheduledWorkout, ftpW: number): Promise<ContextPlanned> {
  if (isBikeWorkout(e)) {
    const w = e.workout ?? (e.workoutId ? await getWorkout(e.workoutId) : null)
    if (!w) return { durationS: null, load: null, distanceM: null }
    const stats = plannedStatsOf(w, describeWorkout(w, ftpW).stats)
    return { durationS: stats.durationS, load: stats.tss, distanceM: null, steps: toIntervalsText(w), notes: w.description }
  }
  const s = e.session
  if (!s) return { durationS: null, load: null, distanceM: null }
  return { durationS: s.durationS ?? null, load: s.load ?? null, distanceM: s.distanceM ?? null, steps: (await sessionSteps(e.name, s)) ?? undefined, notes: s.notes }
}

/** The numbers behind the Fitness page's overview (locally recorded, non-simulated rides only). */
export async function fitnessFacts(): Promise<FitnessFacts> {
  const [pmc, weeks, recent, curve, ftp] = await Promise.all([pmcSeries(42, { sports: 'rides' }), weeklyLoad(5, { sports: 'rides' }), realRides(Date.now() - 28 * 86_400_000), powerCurve(), currentFtp()])
  const now = pmc.at(-1)
  // six weeks ago, but only if the rider was already riding then (otherwise it's the model's empty start, not a fitness of 0)
  const firstRide = (await realRides(0))[0]
  const before = pmc.length > 42 && firstRide && isoDay(firstRide.startedAt) <= pmc[0]!.date ? pmc[0] : undefined
  return {
    ctl: now ? now.ctl : null,
    atl: now ? now.atl : null,
    tsb: now ? now.tsb : null,
    ctl42dAgo: before ? before.ctl : null,
    weeklyTss: weeks.map((w) => Math.round(w.tss)),
    rides28d: recent.length,
    ftpW: ftp?.ftpW ?? null,
    eftpW: curve.eftp.ftpW ? Math.round(curve.eftp.ftpW) : null,
  }
}

/** What the AI fitness overview is written from: the facts, plus FTP history and best efforts. */
export async function fitnessContext(facts: FitnessFacts): Promise<string> {
  const [curve, ftp] = await Promise.all([powerCurve(), ftpHistory()])
  return JSON.stringify({
    today: new Date().toISOString().slice(0, 10),
    ...facts,
    ctl: r1(facts.ctl),
    atl: r1(facts.atl),
    tsb: r1(facts.tsb),
    ctl42dAgo: r1(facts.ctl42dAgo),
    ftpHistory: ftp.slice(-8).map((f) => ({ date: new Date(f.date).toISOString().slice(0, 10), ftpW: f.ftpW, source: f.source })),
    best90d: Object.fromEntries(curve.last90.filter((p) => [5, 60, 300, 1200, 3600].includes(p.durationS)).map((p) => [`${p.durationS}s`, Math.round(p.watts)])),
  })
}
