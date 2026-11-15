// Before named training plans (0.6.4 and older) there was one Training plan
// folder: workouts filed with folder 'plan', in planOrder. Those workouts
// become a plan called "Training plan", in their old order. This runs in the
// database upgrade to version 5 and again after every restore (a 0.6.4 backup
// brings the old folder back). It is safe to run any number of times: it only
// takes in plan workouts no plan has, and a workout a plan already lists just
// gets that plan's id back.
import type { EntityTable } from 'dexie'
import { nextMonday, type TrainingPlan } from '@core/workout/plan'
import type { StoredWorkout } from './db'

const newId = (prefix: string) => `${prefix}${Date.now().toString(36)}${crypto.randomUUID().slice(0, 8)}`

/** Files the old Training plan folder's workouts in a plan. Returns the plan it made, if it made one. */
export async function adoptLegacyPlanWorkouts(workouts: EntityTable<StoredWorkout, 'id'>, plans: EntityTable<TrainingPlan, 'id'>, now = Date.now()): Promise<TrainingPlan | null> {
  const all = await plans.toArray()
  const known = new Set(all.map((p) => p.id))
  const unfiled = (await workouts.toArray()).filter((w) => w.json.folder === 'plan' && !(w.json.planId && known.has(w.json.planId)))
  if (unfiled.length === 0) return null
  const homeless: StoredWorkout[] = []
  for (const w of unfiled) {
    const home = all.find((p) => p.items.some((i) => i.workoutId === w.id))
    if (home) await workouts.put({ ...w, json: { ...w.json, planId: home.id } })
    else homeless.push(w)
  }
  if (homeless.length === 0) return null
  homeless.sort((a, b) => (a.planOrder ?? 0) - (b.planOrder ?? 0) || a.createdAt - b.createdAt)
  const plan: TrainingPlan = {
    id: newId('p'),
    name: 'Training plan',
    items: homeless.map((w) => ({ id: newId('i'), workoutId: w.id })),
    rideDays: [1, 3, 5],
    startDate: nextMonday(now),
    onCalendar: false,
    source: 'manual',
    createdAt: now,
    updatedAt: now,
  }
  await plans.put(plan)
  await workouts.bulkPut(homeless.map((w) => ({ ...w, json: { ...w.json, planId: plan.id } })))
  return plan
}
