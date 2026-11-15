// What a calendar card shows of a workout: its shape, its length and its
// average planned power at the rider's FTP.
import type { Workout } from '@core/workout/model'
import { plannedWorkoutId, type ScheduledWorkout } from '@core/workout/schedule'
import type { ProfileBlock } from '../../charts/WorkoutChart'
import { describeWorkout, plannedStatsOf, type LibraryEntry } from '../../workouts/library'
import { profileBlocks } from '../../workouts/profile'

export interface WorkoutPreview {
  blocks: ProfileBlock[]
  /** The whole timeline, which the shape spans. */
  durationS: number
  /** The length to plan on: as written, except a ramp test (see plannedStatsOf). */
  plannedS: number
  /** Average planned watts, or null where there is no fair figure (a ramp test, or no set power). */
  avgW: number | null
  ramp: boolean
}

export function workoutPreview(w: Workout, ftpW: number): WorkoutPreview {
  const { timeline, stats } = describeWorkout(w, ftpW)
  const ramp = w.ftpTest?.protocol === 'ramp'
  return {
    blocks: profileBlocks(timeline, ftpW),
    durationS: timeline.durationS,
    plannedS: plannedStatsOf(w, stats).durationS,
    avgW: ramp || stats.avgW <= 0 ? null : Math.round(stats.avgW),
    ramp,
  }
}

/** A preview for every workout the calendar can show, by workout id: the library's, and those carried by calendar entries. */
export function previewsFor(library: readonly Pick<LibraryEntry, 'workout'>[], schedule: readonly ScheduledWorkout[], ftpW: number): Map<string, WorkoutPreview> {
  const out = new Map<string, WorkoutPreview>()
  const wanted = new Set(schedule.map(plannedWorkoutId).filter((id): id is string => id !== null))
  for (const e of schedule) if (e.workout && !out.has(e.workout.id)) out.set(e.workout.id, workoutPreview(e.workout, ftpW))
  for (const { workout } of library) if (!out.has(workout.id) && wanted.has(workout.id)) out.set(workout.id, workoutPreview(workout, ftpW))
  return out
}

/** 3600 → "1:00", 2700 → "0:45": hours and minutes, as the cards show length. */
export function hoursMinutes(s: number): string {
  const m = Math.round(s / 60)
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`
}
