// Where the other riders on a shared track are, seen from the rider: their
// last reported position carried on at their last speed (the server passes
// updates about once a second; spec 7.4 asks apps to smooth between them),
// and the gap to each one around the loop.
import type { ObnRemoteRider } from './session'

/** Carry a rider on for at most this long without news, s: past it they've probably stopped. */
export const EXTRAPOLATE_MAX_S = 3

/** A remote rider's position now, m along the track. */
export function positionNow(r: Pick<ObnRemoteRider, 'distance' | 'speed' | 'at'>, nowMs: number, lengthM: number, loop: boolean): number {
  const dt = Math.min(EXTRAPOLATE_MAX_S, Math.max(0, (nowMs - r.at) / 1000))
  const d = r.distance + r.speed * dt
  if (loop) return mod(d, lengthM)
  return Math.min(d, lengthM)
}

/**
 * The gap from `fromM` to `toM` along a loop of `lengthM`, m: the short way
 * round, in (-length/2, length/2]. Positive means `toM` is ahead.
 */
export function loopGapM(fromM: number, toM: number, lengthM: number): number {
  const d = mod(toM - fromM, lengthM)
  return d > lengthM / 2 ? d - lengthM : d
}

export interface Standing {
  rider: ObnRemoteRider
  /** Position now, m along the track. */
  distanceM: number
  /** From the rider to them, m (positive: ahead); on a loop the short way round. Null while just watching. */
  gapM: number | null
}

/** Everyone on the track, furthest ahead first. */
export function standings(riders: readonly ObnRemoteRider[], me: number | null, nowMs: number, lengthM: number, loop: boolean): Standing[] {
  const out = riders.map((rider): Standing => {
    const distanceM = positionNow(rider, nowMs, lengthM, loop)
    const gapM = me === null ? null : loop ? loopGapM(me, distanceM, lengthM) : distanceM - me
    return { rider, distanceM, gapM }
  })
  return out.sort((a, b) => (b.gapM ?? b.distanceM) - (a.gapM ?? a.distanceM) || a.rider.name.localeCompare(b.rider.name))
}

function mod(v: number, m: number): number {
  if (!(m > 0)) return v
  const r = v % m
  return r < 0 ? r + m : r
}
