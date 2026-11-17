// Run, swim and other session workouts in IndexedDB, and planning them on a
// day. What a session file is and what it adds up to is in @core/multisport.
import { describeSession } from '@core/multisport/build'
import type { SessionThresholds } from '@core/multisport/estimate'
import type { SessionWorkout } from '@core/multisport/model'
import { parseSession } from '@core/multisport/parse'
import { lthrFor } from '@core/metrics/hr-load'
import type { DateKey, PlannedSession, ScheduledWorkout } from '@core/workout/schedule'
import { currentProfile } from '../db/athlete-repo'
import { db } from '../db/db'
import { scheduleSession } from '../plan/schedule-repo'

/** The rider's thresholds, as the session estimates want them. */
export async function sessionThresholds(): Promise<SessionThresholds> {
  const p = await currentProfile()
  return { runPaceSPerKm: p?.runThresholdPaceSPerKm ?? null, swimCssSPer100m: p?.swimCssSPer100m ?? null, lthr: p ? lthrFor(p) : null }
}

/** Saves a session workout. Saving the same file again keeps when it was first added. */
export async function saveSessionWorkout(w: SessionWorkout): Promise<SessionWorkout> {
  const old = await db().sessionWorkouts.get(w.id)
  const row = { ...w, createdAt: old?.createdAt ?? w.createdAt }
  await db().sessionWorkouts.put(row)
  return row
}

export async function listSessionWorkouts(): Promise<SessionWorkout[]> {
  return (await db().sessionWorkouts.toArray()).sort((a, b) => b.updatedAt - a.updatedAt || a.name.localeCompare(b.name))
}

export const getSessionWorkout = (id: string) => db().sessionWorkouts.get(id)

export async function deleteSessionWorkout(id: string): Promise<void> {
  await db().sessionWorkouts.delete(id)
}

/** What a planned session carries from its workout: what it adds up to with today's thresholds, and its steps for intervals.icu. */
export function plannedFrom(w: SessionWorkout, thresholds: SessionThresholds): PlannedSession {
  const { parsed, estimate } = describeSession(w, thresholds)
  return {
    sessionWorkoutId: w.id,
    durationS: estimate?.durationS ?? null,
    distanceM: estimate?.distanceM ?? null,
    load: estimate?.load ?? null,
    ...(w.effort ? { effort: w.effort } : {}),
    ...(w.notes ? { notes: w.notes } : {}),
    ...(parsed.body ? { text: parsed.body } : {}),
  }
}

/** A planned session's steps: the text planned with it, else its library workout's (which keeps them in step with edits there). */
export async function sessionSteps(name: string, s: PlannedSession): Promise<string | null> {
  if (s.text?.trim()) return s.text
  if (!s.sessionWorkoutId) return null
  const w = await getSessionWorkout(s.sessionWorkoutId)
  return (w ? parseSession(name, w.text).body : '') || null
}

/** Puts a session workout on a day. */
export async function planSessionWorkout(date: DateKey, w: SessionWorkout): Promise<ScheduledWorkout> {
  return scheduleSession(date, w.sport, w.name, plannedFrom(w, await sessionThresholds()))
}
