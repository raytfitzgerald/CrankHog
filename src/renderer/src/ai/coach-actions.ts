// The coach's proposed changes, applied and undone. What a proposal would do
// is worked out in @core/coach-actions from a snapshot of the calendar read
// here; applying it goes through the same repos the calendar, the library and
// Settings use, so plans re-lay, intervals.icu and Google Calendar follow, and
// nothing is written any other way. Each change applied leaves an undo step
// (plain data, kept with the chat's card), so Undo works after a restart too.
import { describeOp, groupOfSport, relayNotes, resolveProposal, type ActionWorld, type NewSession, type Op, type Proposal, type ResolvedProposal, type WorldWorkout } from '@core/coach-actions/actions'
import type { ImportItem } from '@core/plan-import/model'
import type { SessionThresholds } from '@core/multisport/estimate'
import type { SessionWorkout } from '@core/multisport/model'
import { activityGroup, type SportGroup } from '@core/sport/group'
import { effortLoad } from '@core/sport/load'
import { contentId } from '@core/workout/ids'
import type { Workout } from '@core/workout/model'
import type { DayMark, PlanItem } from '@core/workout/plan'
import { addDays, completions, dateKey, dateKeyToMs, type DateKey, type ScheduledWorkout } from '@core/workout/schedule'
import { currentFtp, DEFAULT_FTP_W, recordFtp, updateProfile } from '../db/athlete-repo'
import { db } from '../db/db'
import { addManualActivity } from '../plan/activities-repo'
import { addMark, addMarks, removeMark, removeMarks, restoreMark, updateMark } from '../plan/day-marks-repo'
import { checkItem } from '../plan/doc-import'
import { updatePlan } from '../plan/plans-repo'
import { moveScheduled, removeScheduled, scheduleSession, scheduleWorkout } from '../plan/schedule-repo'
import { BUILTINS, deleteWorkout, saveWorkout } from '../workouts/library'
import { deleteSessionWorkout, planSessionWorkout, saveSessionWorkout, sessionThresholds } from '../workouts/sessions-repo'

/** One way to take back a change, as plain data. */
export type UndoStep =
  | { do: 'delete-entry'; id: string }
  | { do: 'move-entry'; id: string; date: DateKey }
  | { do: 'put-entry'; entry: ScheduledWorkout }
  | { do: 'plan-item'; planId: string; item: PlanItem }
  | { do: 'delete-workout'; id: string }
  | { do: 'delete-session-workout'; id: string }
  | { do: 'remove-marks'; ids: string[] }
  | { do: 'put-mark'; mark: DayMark }
  | { do: 'update-mark'; id: string; patch: Partial<Omit<DayMark, 'id'>> }
  | { do: 'remove-activity'; id: string }
  | { do: 'delete-ftp'; id: number }
  | { do: 'delete-profile'; id: number }

/** What applying left behind: how to undo it, and the workouts it made, for "Open in builder". */
export interface Applied {
  undo: UndoStep[]
  /** Workouts and sessions made or changed, for the card's "Open in builder". */
  workouts: { id: string; name: string; sport: SportGroup }[]
}

/** How far back the snapshot reads the calendar: what the coach's data shows, and a margin. */
const PAST_DAYS = 60

/** The calendar, events, days off and library as they are now, for resolving a proposal. */
export async function actionWorld(now = Date.now()): Promise<ActionWorld> {
  const today = dateKey(now)
  const from = addDays(today, -PAST_DAYS)
  const [schedule, marks, own, sessions] = await Promise.all([db().schedule.where('date').aboveOrEqual(from).toArray(), db().dayMarks.toArray(), db().workouts.toArray(), db().sessionWorkouts.toArray()])
  const start = dateKeyToMs(from)
  const [rides, activities] = await Promise.all([db().rides.where('startedAt').aboveOrEqual(start).toArray(), db().activities.where('startedAt').aboveOrEqual(start).toArray()])
  const done = completions(
    schedule,
    rides.map((r) => ({ id: r.id, startedAt: r.startedAt, workoutId: r.workoutId, simulated: r.simulated })),
    activities.map((a) => ({ id: a.id, startedAt: a.startedAt, group: activityGroup(a) })),
  )
  const workouts: WorldWorkout[] = [
    ...own.map((w) => ({ id: w.id, name: w.name, sport: 'ride' as const })),
    ...sessions.map((w) => ({ id: w.id, name: w.name, sport: w.sport })),
    ...BUILTINS.map((w) => ({ id: w.id, name: w.name, sport: 'ride' as const })),
  ]
  return {
    today,
    entries: schedule.map((e) => ({ id: e.id, date: e.date, name: e.name, sport: e.sport ?? 'ride', ...(e.planId ? { planId: e.planId } : {}), ...(done.has(e.id) ? { done: true } : {}) })),
    marks,
    workouts,
  }
}

/** A proposal resolved now, with every new session's steps read by CrankHog's importers: what it would do, and what can't be done. */
export interface CheckedProposal extends ResolvedProposal {
  lines: string[]
  /** What it does to plans that the calendar diff can't show (re-lays). */
  notes: string[]
}

interface Ctx {
  ftpW: number
  thresholds: SessionThresholds
  now: number
}

async function ctxNow(now = Date.now()): Promise<Ctx> {
  return { ftpW: (await currentFtp(now))?.ftpW ?? DEFAULT_FTP_W, thresholds: await sessionThresholds(), now }
}

const asItem = (s: NewSession): ImportItem => ({ where: '', sport: s.sport, name: s.name, steps: s.steps, ...(s.minutes ? { minutes: s.minutes } : {}), ...(s.effort ? { effort: s.effort } : {}), ...(s.notes ? { notes: s.notes } : {}) })

/** The session an op makes, read as the plan import reads one; a string says why it can't be made. */
function made(s: NewSession, ctx: Ctx): { kind: 'bike'; workout: Workout } | { kind: 'session'; workout: SessionWorkout } | string {
  const checked = checkItem(asItem(s), { ftpW: ctx.ftpW, thresholds: ctx.thresholds, now: ctx.now })
  if (typeof checked === 'string') return checked
  if (checked.kind === 'bike') return { kind: 'bike', workout: { ...checked.workout, id: contentId('coach', `${s.name}\n${s.steps}`), source: 'ai' } }
  return { kind: 'session', workout: checked.workout }
}

/** The steps a ride without steps gets when it has to be a workout (in a plan): one steady block at the effort's power. */
const RIDE_POWER: Record<NonNullable<NewSession['effort']>, number> = { easy: 60, moderate: 72, hard: 85, max: 95 }
const rideSteps = (s: NewSession): NewSession => (s.sport === 'bike' && !s.steps && s.minutes ? { ...s, steps: `- ${s.minutes}m ${RIDE_POWER[s.effort ?? 'easy']}%` } : s)

/** A proposal as the card shows it: resolved against the calendar now, and each new session's steps checked. */
export async function checkProposal(p: Proposal, day: (d: DateKey) => string, now = Date.now()): Promise<CheckedProposal> {
  const world = await actionWorld(now)
  const r = resolveProposal(p, world)
  const ctx = await ctxNow(now)
  const problems = [...r.problems]
  for (const o of r.ops) {
    const s = o.op === 'create' ? o.session : o.op === 'replace' ? (o.entry.planId ? rideSteps(o.session) : o.session) : null
    if (!s || !s.steps) continue
    const m = made(s, ctx)
    if (typeof m === 'string') problems.push(`${s.name}: ${m}`)
  }
  return { ...r, problems, diff: problems.length === 0 ? r.diff : [], lines: r.ops.map((o) => describeOp(o, day)), notes: relayNotes(r.ops, world) }
}

/**
 * Applies a proposal: resolved again now (the calendar may have changed
 * since the card was shown), then each change in order. If one fails, the
 * ones before it are undone and the error thrown, so it's all or nothing.
 */
export async function applyProposal(p: Proposal, now = Date.now()): Promise<Applied> {
  const r = await checkProposal(p, (d) => d, now)
  if (r.problems.length > 0) throw new Error(r.problems.join(' '))
  const ctx = await ctxNow(now)
  const out: Applied = { undo: [], workouts: [] }
  try {
    for (const o of r.ops) await applyOp(o, ctx, out)
  } catch (e) {
    await undoSteps(out.undo).catch(() => undefined)
    throw e
  }
  return out
}

/** A new session saved in the library (if it's new there): a bike workout in Custom workouts, or in the plan given. */
async function keep(m: Exclude<ReturnType<typeof made>, string>, ctx: Ctx, out: Applied, plan?: string): Promise<void> {
  if (m.kind === 'bike') {
    if (!(await db().workouts.get(m.workout.id))) out.undo.push({ do: 'delete-workout', id: m.workout.id })
    await saveWorkout(plan ? { ...m.workout, folder: 'plan', planId: plan } : m.workout, ctx.ftpW)
    out.workouts.push({ id: m.workout.id, name: m.workout.name, sport: 'ride' })
  } else {
    if (!(await db().sessionWorkouts.get(m.workout.id))) out.undo.push({ do: 'delete-session-workout', id: m.workout.id })
    await saveSessionWorkout(m.workout)
    out.workouts.push({ id: m.workout.id, name: m.workout.name, sport: m.workout.sport })
  }
}

/** A session put on a day by hand (not through a plan). */
async function plan(date: DateKey, s: NewSession, ctx: Ctx, out: Applied): Promise<void> {
  if (!s.steps) {
    const durationS = (s.minutes ?? 0) * 60
    const e = await scheduleSession(date, groupOfSport(s.sport), s.name, { label: s.name, durationS, effort: s.effort, load: effortLoad(durationS, s.effort), ...(s.notes ? { notes: s.notes } : {}) })
    out.undo.push({ do: 'delete-entry', id: e.id })
    return
  }
  const m = made(s, ctx)
  if (typeof m === 'string') throw new Error(`${s.name}: ${m}`)
  await keep(m, ctx, out)
  const e = m.kind === 'bike' ? await scheduleWorkout(date, m.workout) : await planSessionWorkout(date, m.workout)
  out.undo.push({ do: 'delete-entry', id: e.id })
}

/** The plan item behind a calendar entry, when the entry is a plan's and the plan is on the calendar. */
async function planItemOf(id: string): Promise<{ planId: string; item: PlanItem } | null> {
  const e = await db().schedule.get(id)
  if (!e?.planId || !e.planItemId) return null
  const p = await db().plans.get(e.planId)
  const item = p?.onCalendar ? p.items.find((i) => i.id === e.planItemId) : undefined
  return item ? { planId: p!.id, item } : null
}

async function applyOp(o: Op, ctx: Ctx, out: Applied): Promise<void> {
  switch (o.op) {
    case 'create': {
      const m = made(o.session, ctx)
      if (typeof m === 'string') throw new Error(`${o.session.name}: ${m}`)
      await keep(m, ctx, out)
      if (o.date) {
        const e = m.kind === 'bike' ? await scheduleWorkout(o.date, m.workout) : await planSessionWorkout(o.date, m.workout)
        out.undo.push({ do: 'delete-entry', id: e.id })
      }
      return
    }
    case 'add-session':
      return plan(o.date, o.session, ctx, out)
    case 'schedule': {
      const session = await db().sessionWorkouts.get(o.workout.id)
      const e = session ? await planSessionWorkout(o.date, session) : await scheduleWorkout(o.date, o.workout)
      out.undo.push({ do: 'delete-entry', id: e.id })
      return
    }
    case 'move': {
      const owner = await planItemOf(o.entry.id)
      out.undo.push(owner ? { do: 'plan-item', ...owner } : { do: 'move-entry', id: o.entry.id, date: o.entry.date })
      await moveScheduled(o.entry.id, o.to)
      return
    }
    case 'remove': {
      const owner = await planItemOf(o.entry.id)
      const row = await db().schedule.get(o.entry.id)
      if (!row) throw new Error(`${o.entry.name} is no longer on the calendar.`)
      // a removed session's intervals.icu copy goes too, so the one put back is a new one there
      const { pushedEventId: _p, ...kept } = row
      out.undo.push(owner ? { do: 'plan-item', ...owner } : { do: 'put-entry', entry: kept })
      await removeScheduled(o.entry.id)
      return
    }
    case 'replace': {
      const owner = await planItemOf(o.entry.id)
      if (owner) {
        // a plan's session is changed in the plan, so it stays the plan's and re-lays with it
        const m = made(rideSteps(o.session), ctx)
        if (typeof m === 'string') throw new Error(`${o.session.name}: ${m}`)
        await keep(m, ctx, out, m.kind === 'bike' ? owner.planId : undefined)
        out.undo.push({ do: 'plan-item', ...owner })
        const p = (await db().plans.get(owner.planId))!
        const { sport: _s, ...rest } = owner.item
        const item: PlanItem = { ...rest, workoutId: m.workout.id, ...(m.kind === 'session' ? { sport: m.workout.sport } : {}) }
        await updatePlan(owner.planId, { items: p.items.map((i) => (i.id === item.id ? item : i)) })
        return
      }
      const row = await db().schedule.get(o.entry.id)
      if (!row) throw new Error(`${o.entry.name} is no longer on the calendar.`)
      const { pushedEventId: _p, ...kept } = row
      await removeScheduled(o.entry.id)
      out.undo.push({ do: 'put-entry', entry: kept })
      await plan(o.entry.date, o.session, ctx, out)
      return
    }
    case 'days-off': {
      const marks = await addMarks(o.dates.map((date) => ({ date, kind: o.kind, ...(o.note ? { note: o.note } : {}) })))
      out.undo.push({ do: 'remove-marks', ids: marks.map((m) => m.id) })
      return
    }
    case 'add-event': {
      const m = await addMark({ date: o.date, kind: 'event', name: o.name, priority: o.priority })
      out.undo.push({ do: 'remove-marks', ids: [m.id] })
      return
    }
    case 'change-event': {
      const now = await db().dayMarks.get(o.mark.id)
      if (!now) throw new Error(`${o.mark.name ?? 'The event'} is no longer on the calendar.`)
      out.undo.push({ do: 'update-mark', id: now.id, patch: { date: now.date, name: now.name, priority: now.priority } })
      await updateMark(o.mark.id, o.patch)
      return
    }
    case 'remove-mark': {
      const now = await db().dayMarks.get(o.mark.id)
      if (!now) throw new Error('That event or day off is no longer on the calendar.')
      out.undo.push({ do: 'put-mark', mark: now })
      await removeMark(o.mark.id)
      return
    }
    case 'log': {
      const a = await addManualActivity(
        { date: o.date, group: groupOfSport(o.session.sport), label: o.session.name, durationS: o.session.minutes * 60, distanceM: o.distanceM, effort: o.session.effort, notes: o.session.notes },
        ctx.now,
      )
      out.undo.push({ do: 'remove-activity', id: a.id })
      return
    }
    case 'thresholds': {
      if (o.ftpW !== undefined) {
        const id = await recordFtp({ date: ctx.now, ftpW: o.ftpW, source: 'manual' })
        out.undo.push({ do: 'delete-ftp', id })
      }
      if (Object.keys(o.profile).length > 0) {
        const row = await updateProfile(o.profile)
        if (row.id !== undefined) out.undo.push({ do: 'delete-profile', id: row.id })
      }
      return
    }
  }
}

/** Takes changes back, last first. */
export async function undoSteps(steps: readonly UndoStep[]): Promise<void> {
  const errors: string[] = []
  for (const s of [...steps].reverse()) {
    try {
      await undoStep(s)
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e))
    }
  }
  if (errors.length > 0) throw new Error(`Some of it couldn't be undone: ${errors.join(' ')}`)
}

async function undoStep(s: UndoStep): Promise<void> {
  switch (s.do) {
    case 'delete-entry':
      await removeScheduled(s.id)
      return
    case 'move-entry':
      if (await db().schedule.get(s.id)) await moveScheduled(s.id, s.date)
      return
    case 'put-entry':
      await db().schedule.put(s.entry)
      return
    case 'plan-item': {
      const p = await db().plans.get(s.planId)
      if (!p) return
      await updatePlan(s.planId, { items: p.items.map((i) => (i.id === s.item.id ? s.item : i)) })
      return
    }
    case 'delete-workout':
      // only if nothing else uses it now
      if (!(await db().schedule.toArray()).some((e) => e.workoutId === s.id) && !(await db().plans.toArray()).some((p) => p.items.some((i) => i.workoutId === s.id))) await deleteWorkout(s.id)
      return
    case 'delete-session-workout':
      if (!(await db().plans.toArray()).some((p) => p.items.some((i) => i.workoutId === s.id)) && !(await db().schedule.toArray()).some((e) => e.session?.sessionWorkoutId === s.id)) await deleteSessionWorkout(s.id)
      return
    case 'remove-marks':
      await removeMarks(s.ids)
      return
    case 'put-mark':
      await restoreMark(s.mark)
      return
    case 'update-mark':
      if (await db().dayMarks.get(s.id)) await updateMark(s.id, s.patch)
      return
    case 'remove-activity':
      await db().activities.delete(s.id)
      return
    case 'delete-ftp':
      await db().ftpHistory.delete(s.id)
      return
    case 'delete-profile':
      await db().profile.delete(s.id)
      return
  }
}
