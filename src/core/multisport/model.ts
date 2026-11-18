// Run, swim and other sessions: workouts CrankHog doesn't play on a trainer,
// but plans, shows on the calendar and sends to intervals.icu (and on to a
// watch). The steps are written in intervals.icu's workout text; that text,
// with CrankHog's header lines, is the stored form (docs/WORKOUT-FORMAT.md).
import type { SportGroup } from '../sport/group'
import type { Effort } from '../sport/load'

/** The sports a session file may name. Bike workouts use the bike formats (.zwo, .erg, .mrc, plain .txt). */
export type SessionSport = Exclude<SportGroup, 'ride'>

export const SESSION_SPORTS: readonly SessionSport[] = ['run', 'swim', 'other']

/** A pool length for a swim. */
export type PoolLength = '25m' | '50m' | '25y'

/** The unit a step's distance is written in: "400mtr", "1.5km", "1mi", "100y". */
export type DistanceUnit = 'mtr' | 'km' | 'mi' | 'y'

export type StepTarget =
  /** Seconds per km (runs) or per 100 m (swims); a range when low and high differ. */
  | { kind: 'pace'; low: number; high: number; per: 'km' | 'mi' | '100m' | '100y' }
  /** Percent of threshold pace (CSS for swims). */
  | { kind: 'pacePct'; low: number; high: number }
  | { kind: 'paceZone'; zone: number }
  | { kind: 'hrZone'; zone: number }
  /** Percent of threshold heart rate. */
  | { kind: 'lthrPct'; low: number; high: number }
  | { kind: 'bpm'; low: number; high: number }

export interface SessionStep {
  /** The line it came from, 1-based, for messages. */
  line: number
  /** Seconds, or metres: exactly one of the two. */
  durationS?: number
  distanceM?: number
  /** What the distance was written in, so it is shown the same way: 100y stays 100y, not 91mtr. */
  distanceUnit?: DistanceUnit
  target?: StepTarget
  rest?: boolean
  /** Words after the target: "drill", "kick", "easy". */
  note?: string
}

export interface SessionSection {
  title?: string
  /** How many times the steps repeat (1 when not a repeat). */
  repeat: number
  steps: SessionStep[]
}

export interface SessionWorkout {
  id: string
  sport: SessionSport
  name: string
  /** The whole file as imported or pasted, header lines included: the stored form. */
  text: string
  tags: string[]
  source: 'import' | 'user' | 'intervals'
  /** Swims only. */
  pool?: PoolLength
  /** For a session with no steps. */
  durationS?: number
  distanceM?: number
  effort?: Effort
  notes?: string
  createdAt: number
  updatedAt: number
}
