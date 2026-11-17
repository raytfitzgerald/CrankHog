// IndexedDB (via Dexie). The main window is the only connection owner, so
// schema upgrades never block on another open tab/window.
import Dexie, { type EntityTable } from 'dexie'
import type { RideStreams } from '@core/ride/streams'
import type { RideSummary } from '@core/ride/types'
import type { Workout } from '@core/workout/model'
import type { Journey } from '@core/journeys/progress'
import type { ScheduledWorkout } from '@core/workout/schedule'
import type { DayMark, TrainingPlan } from '@core/workout/plan'
import type { StoredRoute, StoredRouteRide } from '../routes/route-codec'
import { adoptLegacyPlanWorkouts } from './legacy-plan'
import type { SessionWorkout } from '@core/multisport/model'
import { groupOfFitSport, type SportGroup } from '@core/sport/group'
import type { Effort } from '@core/sport/load'

export interface StoredWorkout {
  id: string
  name: string
  source: Workout['source']
  tags: string[]
  durationS: number
  tss: number | null
  favorite: boolean
  /** Position in the Training plan (1, 2, 3…), for workouts filed there. */
  planOrder?: number
  json: Workout
  createdAt: number
  updatedAt: number
}

export interface FtpEntry {
  id?: number
  /** Epoch ms the FTP became effective. */
  date: number
  ftpW: number
  source: 'test-20min' | 'test-ramp' | 'test-8min' | 'test-kolie' | 'manual' | 'estimate'
  rideId?: string
  basisW?: number
  weightKg?: number
  notes?: string
}

export interface ProfileEntry {
  id?: number
  /** Effective from (epoch ms). The latest entry at or before a date applies. */
  from: number
  weightKg: number
  lthr?: number
  maxHr?: number
  restHr?: number
  cpW?: number
  wPrimeJ?: number
  /** Threshold run pace, seconds per km: for the time and load of run sessions. */
  runThresholdPaceSPerKm?: number
  /** Critical swim speed as a pace, seconds per 100 m: for swim sessions. */
  swimCssSPer100m?: number
  heightCm?: number
  birthYear?: number
}

/** Where an activity came from. Rows from before 1.1 have none and came from a FIT file. */
export type ActivitySource = 'fit' | 'intervals' | 'manual'

/**
 * An activity that isn't a ride in the history: a run, a swim, a squash game,
 * a gym session, or an outdoor ride synced from intervals.icu. A summary for
 * the calendar, weekly volume, fitness and the coach chat; never seen by
 * the power curve or FTP.
 */
export interface OtherActivity {
  id: string
  startedAt: number
  /** FIT sport: "running", "swimming", "racket"… (an intervals.icu activity keeps its type, "TrailRun"). */
  sport: string
  subSport: string | null
  name: string
  movingS: number
  distanceM: number | null
  avgHr: number | null
  maxHr: number | null
  /** hrTSS (src/core/metrics/hr-load.ts), so it adds up with ride TSS. */
  hrLoad: number | null
  /** Garmin's Training Effect, when the file carries it. */
  trainingEffect: { aerobic: number; anaerobic: number | null } | null
  /** Garmin's own training load, when the file carries it. */
  garminLoad: number | null
  device: string | null
  /** The FIT file it came from (FIT imports only). */
  fileName?: string
  /** Missing on rows from before 1.1: those came from FIT files. */
  source?: ActivitySource
  /** Ride, Run, Swim or Other. Missing on rows from before 1.1: worked out from the sport (activityGroup). */
  group?: SportGroup
  /** What the rider called it: "Squash", "Long run". */
  label?: string
  /** intervals.icu's training load. */
  icuLoad?: number | null
  /** The rider's own load, typed in or from the effort they picked. */
  manualLoad?: number | null
  effort?: Effort
  notes?: string
  /** The intervals.icu activity id, once matched to one. */
  externalId?: string
}

export interface KvEntry {
  key: string
  value: unknown
}

export class CrankHogDb extends Dexie {
  rides!: EntityTable<RideSummary, 'id'>
  rideStreams!: EntityTable<RideStreams, 'rideId'>
  workouts!: EntityTable<StoredWorkout, 'id'>
  ftpHistory!: EntityTable<FtpEntry, 'id'>
  profile!: EntityTable<ProfileEntry, 'id'>
  kv!: EntityTable<KvEntry, 'key'>
  routes!: EntityTable<StoredRoute, 'id'>
  routeRides!: EntityTable<StoredRouteRide, 'rideId'>
  journeys!: EntityTable<Journey, 'id'>
  schedule!: EntityTable<ScheduledWorkout, 'id'>
  plans!: EntityTable<TrainingPlan, 'id'>
  activities!: EntityTable<OtherActivity, 'id'>
  dayMarks!: EntityTable<DayMark, 'id'>
  sessionWorkouts!: EntityTable<SessionWorkout, 'id'>

  // The database name keeps the old brand for the same reason the app://
  // origin does (app-protocol.ts): renaming it would orphan every ride ever
  // recorded. Users never see it. Do not 'tidy' this.
  constructor(name = 'freegaz') {
    super(name)
    this.version(1).stores({
      rides: 'id, startedAt, kind, simulated, workoutId',
      rideStreams: 'rideId',
      workouts: 'id, name, source, updatedAt, favorite, *tags',
      ftpHistory: '++id, date, source',
      profile: '++id, from',
      kv: 'key',
    })
    // v2: the route library (points packed, see routes/route-codec.ts) and
    // the rides on each route, for Challenge ghosts.
    this.version(2).stores({
      routes: 'id, name, importedAt',
      routeRides: 'rideId, routeId, startedAt',
    })
    // v3: journeys in progress (grand journeys and imported routes; drops are one-offs)
    this.version(3).stores({
      journeys: 'id, courseId, updatedAt',
    })
    // v4: workouts scheduled on calendar days (src/core/workout/schedule.ts)
    this.version(4).stores({
      schedule: 'id, date, source',
    })
    // v5: named training plans, other sports from FIT files, and events and days off.
    // The old Training plan folder becomes a plan, in the same transaction.
    this.version(5)
      .stores({
        plans: 'id, updatedAt',
        activities: 'id, startedAt, sport',
        dayMarks: 'id, date, kind',
      })
      .upgrade(async (tx) => {
        await adoptLegacyPlanWorkouts(tx.table('workouts'), tx.table('plans'))
      })
    // v6: multisport. Activities say where they came from and which sport
    // group they count in; run, swim and other sessions get a library.
    this.version(6)
      .stores({
        activities: 'id, startedAt, sport, source, externalId',
        sessionWorkouts: 'id, sport, name, updatedAt',
      })
      .upgrade(async (tx) => {
        await tx
          .table<OtherActivity, string>('activities')
          .toCollection()
          .modify((a) => {
            Object.assign(a, completeActivity(a))
          })
      })
  }
}

/** Fills in what a pre-1.1 activity lacks: it came from a FIT file, and its group follows its sport. Used by the upgrade and by restoring an older backup. */
export function completeActivity<T extends OtherActivity>(a: T): T {
  return { ...a, source: a.source ?? 'fit', group: a.group ?? groupOfFitSport(a.sport, a.subSport) }
}

let instance: CrankHogDb | null = null

export function db(): CrankHogDb {
  instance ??= new CrankHogDb()
  return instance
}

/** Ask Chromium not to evict our data under storage pressure. */
export async function requestPersistence(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false
  } catch {
    return false
  }
}
