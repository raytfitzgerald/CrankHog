// Racing Sir Loin down a route.
//
// He isn't a ghost and he isn't a pacer: he's a rival who is roughly your
// equal and completely inconsistent. His pace wanders between a bit under
// your FTP and a bit over it, on a slow cycle, so the lead changes hands
// several times in an hour and neither of you ever settles.
//
// Two things keep him interesting rather than annoying:
//   - he can't get more than HOG_MAX_GAP_M up the road, because past that he
//     stops and waits (and the stunt picker makes him visibly wait: asleep on
//     the verge, having lunch);
//   - he can't be dropped for good either. Get far enough clear and he starts
//     chasing, and he is quicker when he is cross.
//
// Nothing here is physics; it's the same feel as the coach ride-along, and it
// borrows that module's speed curve so the two agree about what watts mean.

import { speedForPower } from '../coach/ride-along'

/** He is held within this far either way, so there is always a race on. */
export const HOG_MAX_GAP_M = 450
/** Past this, one of you is visibly waiting for the other. */
export const HOG_WAIT_M = 150
/** His pace wanders between these fractions of the rider's FTP. */
const PACE_LO = 0.86
const PACE_HI = 1.12
/** One full wander, s. Long enough that a lead feels earned. */
const WANDER_S = 190
/** How much harder he rides when he's been dropped. */
const CHASE_BOOST = 0.16
/** How much he eases off when he's a long way clear. */
const WAIT_EASE = 0.3

export interface HogRaceState {
  /** Where he is relative to the rider, m: positive is ahead. */
  gapM: number
  /** How far into his wander he is, s. */
  phaseS: number
  /** Times the rider has got properly clear of him. */
  youDropped: number
  /** Times he has got properly clear of the rider. */
  heDropped: number
  /** Who was last properly clear, so the counters only tick on a change. */
  lead: 'you' | 'hog' | 'level'
}

export const HOG_RACE_START: HogRaceState = { gapM: 0, phaseS: 0, youDropped: 0, heDropped: 0, lead: 'level' }

/**
 * The watts he's riding, given the rider's FTP and where he is on the road.
 * Exported because the readout explains him with it ("he is having a good
 * patch"), and because it is the part most worth a test.
 */
export function hogPaceW(ftpW: number, s: HogRaceState): number {
  const wander = (PACE_LO + PACE_HI) / 2 + ((PACE_HI - PACE_LO) / 2) * Math.sin((s.phaseS / WANDER_S) * Math.PI * 2)
  // miles clear: sit up. dropped: get cross.
  const adjust = s.gapM > HOG_WAIT_M ? -WAIT_EASE * Math.min(1, (s.gapM - HOG_WAIT_M) / (HOG_MAX_GAP_M - HOG_WAIT_M)) : s.gapM < -HOG_WAIT_M ? CHASE_BOOST : 0
  return Math.max(40, Math.round(ftpW * (wander + adjust)))
}

/**
 * Moves the race on by dtS seconds of *moving* time.
 *
 * With neither power nor speed (a sensor dropout, or a pause) the race holds
 * where it is: missing is not zero, so he doesn't ride off while a trainer
 * reconnects.
 */
export function stepHogRace(s: HogRaceState, dtS: number, rider: { watts: number | null; kmh: number | null }, ftpW: number): HogRaceState {
  if (rider.watts === null && rider.kmh === null) return s
  const dt = Math.min(Math.max(dtS, 0), 0.5)
  const riderKmh = rider.kmh !== null && rider.kmh > 0 ? rider.kmh : speedForPower(rider.watts ?? 0)
  const riderW = rider.watts ?? 0
  const hogW = hogPaceW(ftpW, s)
  // his speed from the rider's, by the power ratio, so a trainer that reads
  // fast or slow doesn't change who is winning
  const hogKmh = riderW > 0 && riderKmh > 0 ? riderKmh * Math.cbrt(hogW / riderW) : speedForPower(hogW)
  const gapM = clamp(s.gapM + ((hogKmh - riderKmh) / 3.6) * dt, -HOG_MAX_GAP_M, HOG_MAX_GAP_M)

  const lead: HogRaceState['lead'] = gapM > HOG_WAIT_M ? 'hog' : gapM < -HOG_WAIT_M ? 'you' : 'level'
  const changed = lead !== 'level' && lead !== s.lead
  return {
    gapM,
    phaseS: (s.phaseS + dt) % WANDER_S,
    youDropped: s.youDropped + (changed && lead === 'you' ? 1 : 0),
    heDropped: s.heDropped + (changed && lead === 'hog' ? 1 : 0),
    lead: lead === 'level' ? s.lead : lead,
  }
}

export type HogMood = 'together' | 'hog-ahead' | 'you-ahead'

export function hogMood(gapM: number): HogMood {
  if (Math.abs(gapM) < 8) return 'together'
  return gapM > 0 ? 'hog-ahead' : 'you-ahead'
}

/** "Sir Loin 42 m ahead", "You're 80 m clear", "Wheel to wheel"; feet for imperial. */
export function hogGapLabel(gapM: number, units: 'metric' | 'imperial' = 'metric'): string {
  const shown = units === 'imperial' ? `${Math.round(Math.abs(gapM) / 0.3048)} ft` : `${Math.round(Math.abs(gapM))} m`
  switch (hogMood(gapM)) {
    case 'together':
      return 'Wheel to wheel with Sir Loin'
    case 'hog-ahead':
      return gapM >= HOG_MAX_GAP_M ? 'Sir Loin is waiting up the road' : `Sir Loin ${shown} ahead`
    case 'you-ahead':
      return gapM <= -HOG_MAX_GAP_M ? 'Sir Loin is out of sight behind' : `${shown} clear of Sir Loin`
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}
