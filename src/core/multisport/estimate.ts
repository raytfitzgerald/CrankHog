// What a session adds up to on the calendar: its time, its distance, and its
// load on the same scale as ride TSS (an hour at threshold is 100).
//
// - Time steps count as written. A distance step's time comes from its pace:
//   the pace it names, or one worked out from the rider's threshold pace
//   (CSS for swims) and the step's intensity.
// - Load scores each step by intensity, the fraction of threshold it asks
//   for: squared for runs and everything else (like rTSS and hrTSS), cubed
//   for swims (like sTSS, since drag rises steeply with speed).
// - A step with no target is easy (EASY_FRACTION); rest scores nothing.
// Missing is not zero: without what it needs, a number is null, never 0.
import { EFFORT_TSS_PER_HOUR, type Effort } from '../sport/load'
import type { SessionSport, SessionStep, StepTarget, SessionSection } from './model'
import type { SessionHeader } from './parse'

/** What the estimates need to know about the rider. Any of it may be missing. */
export interface SessionThresholds {
  /** Seconds per km at threshold. */
  runPaceSPerKm?: number | null
  /** Seconds per 100 m at critical swim speed. */
  swimCssSPer100m?: number | null
  lthr?: number | null
}

/** Intensity of a step with no target: an easy effort. */
export const EASY_FRACTION: Record<SessionSport, number> = { run: 0.75, swim: 0.8, other: 0.75 }
/** Midpoints of pace zones, as a fraction of threshold speed (Z1 to Z7). */
export const PACE_ZONE_FRACTION = [0.75, 0.85, 0.92, 0.98, 1.04, 1.1, 1.2] as const
/** Midpoints of heart-rate zones, as a fraction of threshold heart rate (Friel, Z1 to Z5; Z6 and Z7 run on). */
export const HR_ZONE_FRACTION = [0.8, 0.87, 0.92, 0.97, 1.03, 1.06, 1.09] as const
/** The intensity each effort means, for a session with no steps. */
export const EFFORT_FRACTION: Record<Effort, number> = { easy: 0.75, moderate: 0.85, hard: 0.95, max: 1.02 }

export interface SessionEstimate {
  durationS: number | null
  distanceM: number | null
  load: number | null
  /** What a missing threshold costs, for the import report. */
  warnings: string[]
}

const M_PER_MI = 1609.344
const M_PER_YD = 0.9144

/** Threshold pace in seconds per metre, for the sport, or null. A squash game or a gym session has no pace to go by. */
function thresholdSPerM(sport: SessionSport, t: SessionThresholds): number | null {
  if (sport === 'swim') return t.swimCssSPer100m && t.swimCssSPer100m > 0 ? t.swimCssSPer100m / 100 : null
  if (sport === 'run') return t.runPaceSPerKm && t.runPaceSPerKm > 0 ? t.runPaceSPerKm / 1000 : null
  return null
}

/** A named pace in seconds per metre: the middle of its range. */
function namedSPerM(target: Extract<StepTarget, { kind: 'pace' }>): number {
  const s = (target.low + target.high) / 2
  switch (target.per) {
    case 'km':
      return s / 1000
    case 'mi':
      return s / M_PER_MI
    case '100m':
      return s / 100
    case '100y':
      return s / (100 * M_PER_YD)
  }
}

/** The step's intensity (fraction of threshold), or null when it can't be told. */
function intensity(st: SessionStep, sport: SessionSport, t: SessionThresholds): number | null {
  if (st.rest) return 0
  const target = st.target
  if (!target) return EASY_FRACTION[sport]
  const mid = (a: number, b: number) => (a + b) / 2
  switch (target.kind) {
    case 'pace': {
      const thr = thresholdSPerM(sport, t)
      return thr ? thr / namedSPerM(target) : null
    }
    case 'pacePct':
      return mid(target.low, target.high) / 100
    case 'paceZone':
      return PACE_ZONE_FRACTION[target.zone - 1] ?? null
    case 'hrZone':
      return HR_ZONE_FRACTION[target.zone - 1] ?? null
    case 'lthrPct':
      return mid(target.low, target.high) / 100
    case 'bpm':
      return t.lthr && t.lthr > 0 ? mid(target.low, target.high) / t.lthr : null
  }
}

/** The step's pace in seconds per metre: named, else from threshold and intensity. */
function stepSPerM(st: SessionStep, sport: SessionSport, t: SessionThresholds): number | null {
  if (st.target?.kind === 'pace') return namedSPerM(st.target)
  const thr = thresholdSPerM(sport, t)
  if (!thr) return null
  const f = st.rest ? EASY_FRACTION[sport] : intensity(st, sport, t)
  return f && f > 0 ? thr / f : null
}

const load = (hours: number, f: number, sport: SessionSport) => hours * (sport === 'swim' ? f ** 3 : f ** 2) * 100

const round = (v: number, dp = 1) => Math.round(v * 10 ** dp) / 10 ** dp

/** Time, distance and load for a parsed session. */
export function estimateSession(sport: SessionSport, sections: readonly SessionSection[], header: Pick<SessionHeader, 'durationS' | 'distanceM' | 'effort'>, t: SessionThresholds = {}): SessionEstimate {
  const warnings: string[] = []
  const steps = sections.flatMap((s) => Array.from({ length: s.repeat }, () => s.steps).flat())
  const thrMissing = thresholdSPerM(sport, t) === null
  const thrName = sport === 'swim' ? 'swim threshold pace (CSS)' : 'threshold run pace'
  const sportName = sport === 'swim' ? 'swim' : sport === 'run' ? 'run' : 'session'

  if (steps.length === 0) {
    // a session with no steps: its header
    let durationS = header.durationS ?? null
    const distanceM = header.distanceM ?? null
    if (durationS === null && distanceM !== null && sport !== 'other') {
      const thr = thresholdSPerM(sport, t)
      if (thr) durationS = round((distanceM * thr) / EFFORT_FRACTION[header.effort ?? 'easy'], 0)
      else warnings.push(`This is a ${sportName} with a distance and no time, and no ${thrName} is set: it shows its distance but no time or load. Set it in Settings, Athlete.`)
    }
    // no effort given: moderate
    const l = durationS !== null ? round((durationS / 3600) * EFFORT_TSS_PER_HOUR[header.effort ?? 'moderate']) : null
    return { durationS, distanceM, load: l, warnings }
  }

  let durationS: number | null = 0
  let distanceM: number | null = 0
  let total: number | null = 0
  let distanceStepsUntimed = false
  let loadUnknown = false
  for (const st of steps) {
    const sPerM = stepSPerM(st, sport, t)
    const secs = st.durationS ?? (st.distanceM !== undefined && sPerM !== null ? st.distanceM * sPerM : null)
    const metres = st.distanceM ?? (st.durationS !== undefined && sPerM !== null && !st.rest ? st.durationS / sPerM : st.rest ? 0 : null)
    if (secs === null) distanceStepsUntimed = true
    durationS = durationS !== null && secs !== null ? durationS + secs : null
    distanceM = distanceM !== null && metres !== null ? distanceM + metres : null
    const f = intensity(st, sport, t)
    if (f === null) loadUnknown = true
    total = total !== null && secs !== null && f !== null ? total + load(secs / 3600, f, sport) : null
  }
  if (sport === 'other') {
    // no threshold to set: say only what can't be worked out
    if (distanceStepsUntimed) warnings.push('Distance steps in an "other" session have no pace to go by, so it shows its distance but no time. Give them a time, or a pace target.')
  } else if (distanceStepsUntimed && thrMissing) warnings.push(`This is a ${sportName} with distance steps, and no ${thrName} is set: it shows its distance but no time. Set it in Settings, Athlete.`)
  else if (loadUnknown && thrMissing && steps.some((s) => s.target?.kind === 'pace')) warnings.push(`Pace targets need your ${thrName} to score the load. Set it in Settings, Athlete.`)
  else if (loadUnknown && steps.some((s) => s.target?.kind === 'bpm')) warnings.push('Heart-rate targets in bpm need your threshold heart rate to score the load. Set it in Settings, Athlete.')
  return {
    durationS: durationS !== null ? round(durationS, 0) : null,
    // to the decimetre, not the metre: the shown distance rounds once, in its own unit, so 1,500 yd
    // (1,371.6 m) doesn't become 1,372 m and then 1,499 yd
    distanceM: distanceM !== null && distanceM > 0 ? round(distanceM, 1) : null,
    load: total !== null ? round(total) : null,
    warnings,
  }
}
