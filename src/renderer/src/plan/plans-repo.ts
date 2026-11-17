// Named training plans in IndexedDB, and how they reach the calendar. A plan
// on the calendar is re-laid whenever it changes: its workouts not yet ridden
// are taken off and put back where layOutPlan says, while the ones already
// ridden stay where they were. A workout moved or removed on the calendar is
// marked so on its plan item, so re-laying keeps the rider's change.
//
// A workout of the rider's own in a plan is filed there (folder 'plan' and the
// plan's id), for the library's "In a plan" badge and the builder's Folder.
import { isBlocking, isSessionItem, layOutPlan, layoutStart, nextMonday, parseDatedFileName, type PlanItem, type TrainingPlan } from '@core/workout/plan'
import { sessionFromFile } from '@core/multisport/build'
import type { SessionThresholds } from '@core/multisport/estimate'
import { isSessionFile } from '@core/multisport/parse'
import type { SessionWorkout } from '@core/multisport/model'
import { activityGroup } from '@core/sport/group'
import { addDays, completions, dateKey, dateKeyToMs, isBikeWorkout, pushedChanges, type DateKey, type ScheduledWorkout } from '@core/workout/schedule'
import type { Workout } from '@core/workout/model'
import { currentFtp, DEFAULT_FTP_W } from '../db/athlete-repo'
import { db } from '../db/db'
import { BUILTINS, parseWorkoutFile, saveWorkout } from '../workouts/library'
import { plannedFrom, saveSessionWorkout, sessionThresholds } from '../workouts/sessions-repo'
import type { ImportLine } from '../workouts/session-import'
import { followPushed } from './intervals-push'

const newId = (prefix: string) => `${prefix}${Date.now().toString(36)}${crypto.randomUUID().slice(0, 8)}`

export async function listPlans(): Promise<TrainingPlan[]> {
  return (await db().plans.toArray()).sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function getPlan(id: string): Promise<TrainingPlan | undefined> {
  return db().plans.get(id)
}

export async function createPlan(init: Partial<Omit<TrainingPlan, 'id' | 'createdAt' | 'updatedAt'>> & { name: string }): Promise<TrainingPlan> {
  const now = Date.now()
  const plan: TrainingPlan = {
    items: [],
    rideDays: [1, 3, 5],
    startDate: nextMonday(now),
    onCalendar: false,
    source: 'manual',
    ...init,
    id: newId('p'),
    name: init.name.trim() || 'Training plan',
    createdAt: now,
    updatedAt: now,
  }
  await db().plans.put(plan)
  return plan
}

/** A race-dated plan with its start counted back from the race as the calendar stands; any other plan as it is. */
async function withRaceStart(plan: TrainingPlan): Promise<TrainingPlan> {
  if (plan.anchor !== 'race' || !plan.eventId) return plan
  const marks = await db().dayMarks.toArray()
  const race = marks.find((m) => m.id === plan.eventId)
  const startDate = layoutStart(plan, race?.date, new Set(marks.filter(isBlocking).map((m) => m.date)))
  return startDate === plan.startDate ? plan : { ...plan, startDate }
}

/** Saves changes to a plan, and re-lays it if it is on the calendar. A race-dated plan's start follows its race. */
export async function updatePlan(id: string, patch: Partial<Omit<TrainingPlan, 'id' | 'createdAt'>>): Promise<TrainingPlan> {
  const plan = await db().plans.get(id)
  if (!plan) throw new Error('That plan no longer exists.')
  const next: TrainingPlan = await withRaceStart({ ...plan, ...patch, updatedAt: Date.now() })
  await db().plans.put(next)
  if (next.onCalendar) await relay(next)
  return next
}

/** Deletes a plan. Its workouts stay in the library, filed in another plan that has them or back in Custom workouts. */
export async function deletePlan(id: string): Promise<void> {
  const plan = await db().plans.get(id)
  if (!plan) return
  await relay({ ...plan, onCalendar: false })
  await db().plans.delete(id)
  for (const workoutId of new Set(plan.items.filter((i) => !isSessionItem(i)).map((i) => i.workoutId))) await refile(workoutId)
}

export async function putOnCalendar(id: string): Promise<TrainingPlan> {
  return updatePlan(id, { onCalendar: true })
}

/** Takes the plan's workouts not yet ridden off the calendar. Ridden ones stay, as history. */
export async function takeOffCalendar(id: string): Promise<TrainingPlan> {
  const plan = await updatePlan(id, { onCalendar: false })
  await relay(plan)
  return plan
}

/** Adds a run, swim or other session to a plan. */
export async function addSessionToPlan(id: string, w: Pick<SessionWorkout, 'id' | 'sport'>, date?: DateKey): Promise<TrainingPlan> {
  const plan = await db().plans.get(id)
  if (!plan) throw new Error('That plan no longer exists.')
  const item: PlanItem = { id: newId('i'), workoutId: w.id, sport: w.sport, ...(date ? { date } : {}) }
  return updatePlan(id, { items: [...plan.items, item] })
}

export async function addToPlan(id: string, workoutId: string, date?: DateKey): Promise<TrainingPlan> {
  const plan = await db().plans.get(id)
  if (!plan) throw new Error('That plan no longer exists.')
  const item: PlanItem = { id: newId('i'), workoutId, ...(date ? { date } : {}) }
  const next = await updatePlan(id, { items: [...plan.items, item] })
  await refile(workoutId)
  return next
}

export async function removeItem(id: string, itemId: string): Promise<TrainingPlan> {
  const plan = await db().plans.get(id)
  if (!plan) throw new Error('That plan no longer exists.')
  return updatePlan(id, { items: plan.items.filter((i) => i.id !== itemId) })
}

/** Moves an item one place earlier (-1) or later (1). */
export async function moveItem(id: string, itemId: string, by: -1 | 1): Promise<TrainingPlan> {
  const plan = await db().plans.get(id)
  if (!plan) throw new Error('That plan no longer exists.')
  const items = plan.items.slice()
  const at = items.findIndex((i) => i.id === itemId)
  const to = at + by
  if (at < 0 || to < 0 || to >= items.length) return plan
  ;[items[at], items[to]] = [items[to]!, items[at]!]
  return updatePlan(id, { items })
}

/** Changes one item, keeping everything else about the plan. */
async function updateItem(id: string, itemId: string, change: (item: PlanItem) => PlanItem): Promise<TrainingPlan> {
  const plan = await db().plans.get(id)
  if (!plan) throw new Error('That plan no longer exists.')
  return updatePlan(id, { items: plan.items.map((i) => (i.id === itemId ? change(i) : i)) })
}

const withoutOverrides = ({ movedTo: _m, removed: _r, ...item }: PlanItem): PlanItem => item

/** Whether this plan is on the calendar and still has the item: only then does the calendar change go through the plan. */
async function onCalendarWith(id: string, itemId: string): Promise<boolean> {
  const plan = await db().plans.get(id)
  return !!plan?.onCalendar && plan.items.some((i) => i.id === itemId)
}

/** A plan's workout moved to another day on the calendar. It stays there when the plan is re-laid. False when the plan isn't on the calendar or no longer has it. */
export async function movePlanWorkout(id: string, itemId: string, date: DateKey): Promise<boolean> {
  if (!(await onCalendarWith(id, itemId))) return false
  await updateItem(id, itemId, (i) => (date === i.date ? withoutOverrides(i) : { ...withoutOverrides(i), movedTo: date }))
  return true
}

/** A plan's workout taken off the calendar. It stays in the plan, and off the calendar when the plan is re-laid. False as for movePlanWorkout. */
export async function removePlanWorkout(id: string, itemId: string): Promise<boolean> {
  if (!(await onCalendarWith(id, itemId))) return false
  await updateItem(id, itemId, (i) => ({ ...withoutOverrides(i), removed: true }))
  return true
}

/** Puts a workout moved or removed on the calendar back where the plan has it. */
export async function resetPlanWorkout(id: string, itemId: string): Promise<TrainingPlan> {
  return updateItem(id, itemId, withoutOverrides)
}

/** Names for the calendar: built-ins and the rider's own workouts. */
async function workoutNames(ids: readonly string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>()
  for (const w of BUILTINS) if (ids.includes(w.id)) names.set(w.id, w.name)
  for (const row of await db().workouts.bulkGet(ids.filter((id) => !names.has(id)))) if (row) names.set(row.id, row.name)
  return names
}

/** Brings the calendar in line with the plan (see the top of this file). */
async function relay(plan: TrainingPlan): Promise<void> {
  const d = db()
  // read outside the transaction, which doesn't cover the profile
  const thresholds: SessionThresholds = plan.onCalendar && plan.items.some(isSessionItem) ? await sessionThresholds() : {}
  let before: ScheduledWorkout[] = []
  let after: ScheduledWorkout[] = []
  await d.transaction('rw', [d.schedule, d.rides, d.dayMarks, d.workouts, d.activities, d.sessionWorkouts], async () => {
    const mine = (await d.schedule.toArray()).filter((e) => e.planId === plan.id)
    before = mine
    const workoutIds = [...new Set(mine.map((e) => e.workoutId).filter((x): x is string => !!x))]
    const rides = workoutIds.length > 0 ? await d.rides.where('workoutId').anyOf(workoutIds).toArray() : []
    // a run or swim in the plan is done by an activity on its day (a ride without a workout, by any ride)
    const sessionDays = mine.filter((e) => !isBikeWorkout(e)).map((e) => e.date)
    const span = sessionDays.length > 0 ? ([dateKeyToMs(sessionDays.reduce((a, b) => (a < b ? a : b))), dateKeyToMs(addDays(sessionDays.reduce((a, b) => (a > b ? a : b)), 1))] as const) : null
    const activities = span ? await d.activities.where('startedAt').between(span[0], span[1]).toArray() : []
    const sameDayRides = span ? await d.rides.where('startedAt').between(span[0], span[1]).toArray() : []
    const allRides = [...new Map([...rides, ...sameDayRides].map((r) => [r.id, r])).values()]
    const done = completions(
      mine,
      allRides.map((r) => ({ id: r.id, startedAt: r.startedAt, workoutId: r.workoutId, simulated: r.simulated })),
      activities.map((a) => ({ id: a.id, startedAt: a.startedAt, group: activityGroup(a) })),
    )
    const doneItems = new Set(mine.filter((e) => done.has(e.id)).map((e) => e.planItemId))
    await d.schedule.bulkDelete(mine.filter((e) => !done.has(e.id)).map((e) => e.id))
    after = mine.filter((e) => done.has(e.id))
    if (!plan.onCalendar) return

    const marks = await d.dayMarks.toArray()
    const event = plan.eventId ? marks.find((m) => m.id === plan.eventId) : undefined
    const blocked = new Set(marks.filter(isBlocking).map((m) => m.date))
    const layout = layOutPlan({
      items: plan.items,
      rideDays: plan.rideDays,
      startDate: layoutStart(plan, event?.date, blocked),
      today: dateKey(Date.now()),
      blocked,
      endDate: event?.date,
    })
    const names = await workoutNames(plan.items.filter((i) => !isSessionItem(i)).map((i) => i.workoutId))
    const sessions = new Map((await d.sessionWorkouts.bulkGet(plan.items.filter(isSessionItem).map((i) => i.workoutId))).filter((w): w is SessionWorkout => !!w).map((w) => [w.id, w]))
    const entries: ScheduledWorkout[] = layout.placements
      .map((p) => ({ p, item: plan.items[p.index]! }))
      .filter(({ item }) => !doneItems.has(item.id))
      .map(({ p, item }): ScheduledWorkout => {
        const common = {
          id: `plan-${plan.id}-${item.id}`,
          date: p.date,
          source: 'manual' as const,
          planId: plan.id,
          planItemId: item.id,
          // the plan's order, so a day's workouts list in it
          createdAt: plan.createdAt + p.index,
        }
        if (item.sport) {
          const w = sessions.get(item.workoutId)
          return { ...common, workoutId: null, workout: null, sport: item.sport, name: w?.name ?? 'Session', session: w ? plannedFrom(w, thresholds) : { sessionWorkoutId: item.workoutId } }
        }
        return { ...common, workoutId: item.workoutId, workout: null, name: names.get(item.workoutId) ?? 'Workout' }
      })
    // a session sent to intervals.icu keeps its event there
    const sent = new Map(mine.filter((e) => e.pushedEventId).map((e) => [e.id, e.pushedEventId!]))
    const kept = entries.map((e) => (sent.has(e.id) ? { ...e, pushedEventId: sent.get(e.id) } : e))
    await d.schedule.bulkPut(kept)
    after = [...after, ...kept]
  })
  // and moves or goes there when the re-lay moved or dropped it here
  const changes = pushedChanges(before, after)
  if (changes.moved.length + changes.removed.length > 0) void followPushed(changes)
}

/** Re-lays every plan on the calendar (after an event or a day off changes). A race-dated plan's start follows its race. */
export async function relayAllPlans(): Promise<void> {
  for (const stored of await db().plans.toArray()) {
    const plan = await withRaceStart(stored)
    if (plan !== stored) await db().plans.put(plan)
    if (plan.onCalendar) await relay(plan)
  }
}

export interface PlanImportResult {
  added: number
  failed: { name: string; reason: string }[]
  /** Every file and where it went, for the import report. */
  lines: ImportLine[]
}

/**
 * Workout files into a plan, in file-name order ("01 …", "02 …"). A name
 * starting "YYYY-MM-DD_" puts the workout on that day; the prefix is dropped
 * from the name, and a .zwo keeps the name written inside it.
 */
export async function importIntoPlan(id: string, files: readonly { name: string; text: string }[]): Promise<PlanImportResult> {
  const plan = await db().plans.get(id)
  if (!plan) throw new Error('That plan no longer exists.')
  const ftpW = (await currentFtp())?.ftpW ?? DEFAULT_FTP_W
  const thresholds = await sessionThresholds()
  const ordered = [...files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
  const items: PlanItem[] = []
  const failed: PlanImportResult['failed'] = []
  const lines: ImportLine[] = []
  for (const f of ordered) {
    // a run, swim or other session: read whole or not at all, with the report's reasons
    if (isSessionFile(f.text)) {
      const r = sessionFromFile(f.name, f.text, thresholds, Date.now())
      if (!r.workout) {
        failed.push({ name: f.name, reason: r.errors.map((e) => `${e.line ? `line ${e.line}: ` : ''}${e.text}`).join(' ') })
        lines.push({ file: f.name, kind: 'session', name: r.parsed.name, outcome: 'skipped', errors: r.errors, warnings: r.warnings })
        continue
      }
      const saved = await saveSessionWorkout(r.workout)
      items.push({ id: newId('i'), workoutId: saved.id, sport: saved.sport, ...(r.date ? { date: r.date } : {}) })
      lines.push({ file: f.name, kind: 'session', name: saved.name, outcome: 'plan', planName: plan.name, ...(r.date ? { date: r.date } : {}), errors: [], warnings: r.warnings })
      continue
    }
    try {
      const { date, rest } = parseDatedFileName(f.name)
      const ext = /\.[^.]+$/.exec(f.name)?.[0] ?? ''
      const { workout, warnings } = parseWorkoutFile(`${rest}${ext}`, f.text)
      const saved = await saveWorkout({ ...workout, folder: 'plan', planId: id }, ftpW)
      items.push({ id: newId('i'), workoutId: saved.id, ...(date ? { date } : {}) })
      lines.push({ file: f.name, kind: 'bike', name: saved.name, outcome: 'plan', planName: plan.name, ...(date ? { date } : {}), errors: [], warnings: warnings.map((text) => ({ text })) })
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e)
      failed.push({ name: f.name, reason })
      lines.push({ file: f.name, kind: 'bike', outcome: 'skipped', errors: [{ text: reason }], warnings: [] })
    }
  }
  if (items.length > 0) await updatePlan(id, { items: [...plan.items, ...items], source: plan.items.length === 0 ? 'files' : plan.source })
  return { added: items.length, failed, lines }
}

/**
 * Keeps a workout of the rider's own filed where it is: in a plan while some
 * plan has it (the one it was filed in, if that still has it), in Custom
 * workouts once none does. Built-ins are never filed.
 */
async function refile(workoutId: string): Promise<void> {
  const row = await db().workouts.get(workoutId)
  if (!row) return
  const homes = (await listPlans()).filter((p) => p.items.some((i) => i.workoutId === workoutId))
  const planId = homes.some((p) => p.id === row.json.planId) ? row.json.planId : homes[0]?.id
  if (planId === row.json.planId && (row.json.folder === 'plan') === (planId !== undefined)) return
  const { folder: _f, planId: _p, ...json } = row.json
  await db().workouts.put({ ...row, json: planId ? { ...json, folder: 'plan', planId } : json, planOrder: planId ? row.planOrder : undefined })
}

/**
 * Saves a workout from the builder and files it as its Folder says: in the
 * plan picked (a new "Training plan" when none was, or the one picked has
 * gone), and out of the plan it was filed in before, when that was another.
 * Returns the workout as saved, with the plan it ended up in.
 */
export async function saveAndFile(w: Workout, ftpW: number): Promise<Workout> {
  const before = (await db().workouts.get(w.id))?.json
  const was = before?.folder === 'plan' ? before.planId : undefined
  let saved = await saveWorkout(w, ftpW)
  let plan: TrainingPlan | undefined
  if (saved.folder === 'plan') {
    plan = (saved.planId ? await db().plans.get(saved.planId) : undefined) ?? (await createPlan({ name: 'Training plan' }))
    if (saved.planId !== plan.id) saved = await saveWorkout({ ...saved, planId: plan.id }, ftpW)
    if (!plan.items.some((i) => i.workoutId === saved.id)) await addToPlan(plan.id, saved.id)
  }
  const old = was && was !== plan?.id ? await db().plans.get(was) : undefined
  if (old) await updatePlan(old.id, { items: old.items.filter((i) => i.workoutId !== saved.id) })
  await refile(saved.id)
  return (await db().workouts.get(saved.id))?.json ?? saved
}

/**
 * Takes an item out of a plan. A workout of the rider's own that no other
 * plan has goes back to Custom workouts.
 */
export async function takeOutOfPlan(id: string, itemId: string): Promise<void> {
  const item = (await db().plans.get(id))?.items.find((i) => i.id === itemId)
  if (!item) return
  await removeItem(id, itemId)
  if (!isSessionItem(item)) await refile(item.workoutId)
}
