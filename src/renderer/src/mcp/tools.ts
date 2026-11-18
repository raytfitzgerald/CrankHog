// Claude's tool calls, run where the rider's data lives. Main has already
// checked each input against its schema (src/core/mcp/tools.ts) and that
// the rider allows changes. Reads give what the coach chat gets; changes go
// through the coach chat's own code (coach-actions.ts) and the plan import's
// (doc-import.ts), so they're checked, applied and undone the same way, and
// every one goes on Claude's list in Settings, AI.
import { refOf } from '@core/coach-actions/refs'
import type { Proposal } from '@core/coach-actions/actions'
import { planDoc, type McpPlan } from '@core/mcp/plan'
import type { CalendarQuery, McpToolName, WorkoutQuery } from '@core/mcp/tools'
import { WEEKDAY_SHORT } from '@core/plan-import/model'
import { activityGroup } from '@core/sport/group'
import { weekdayOf } from '@core/workout/plan'
import { addDays, completions, dateKey, dateKeyToMs, entrySport, scheduleStatus, type DateKey } from '@core/workout/schedule'
import { applyProposal, checkProposal, type CardItem } from '../ai/coach-actions'
import { coachContext, plannedFacts } from '../ai/client'
import { currentFtp, DEFAULT_FTP_W } from '../db/athlete-repo'
import { db } from '../db/db'
import { prepareImport, saveImportUndoable, type PreparedImport } from '../plan/doc-import'
import { rideStore } from '../stores/ride'
import { loadLibrary, plannedStatsOf } from '../workouts/library'
import { listSessionWorkouts, plannedFrom, sessionThresholds } from '../workouts/sessions-repo'
import { recordChange, undoChange } from './changes'

export interface ToolAnswer {
  text: string
  isError: boolean
}

/** The longest calendar span get_calendar reads. */
const MAX_SPAN_DAYS = 400
/** The most workouts list_workouts returns. */
const MAX_WORKOUTS = 150

const ok = (value: unknown): ToolAnswer => ({ text: typeof value === 'string' ? value : JSON.stringify(value), isError: false })
const no = (text: string): ToolAnswer => ({ text, isError: true })
const day = (d: DateKey) => `${WEEKDAY_SHORT[weekdayOf(d)]} ${d}`
const minutes = (s: number | null | undefined) => (s ? Math.round(s / 60) : null)

/** Runs one of Claude's tool calls. Never throws: a failure is an answer Claude can read and act on. */
export async function runTool(name: string, args: unknown, now = Date.now()): Promise<ToolAnswer> {
  if (rideStore.getState().active) return no('The athlete is riding right now. Try again after the ride.')
  try {
    switch (name as McpToolName) {
      case 'get_training':
        return ok(await coachContext(now))
      case 'get_calendar':
        return await calendar(args as CalendarQuery, now)
      case 'list_workouts':
        return ok(await workouts(args as WorkoutQuery))
      case 'check_changes':
        return ok(await checked(args as Proposal, now))
      case 'make_changes':
        return await makeChanges(args as Proposal, now)
      case 'check_plan':
        return await plan(args as McpPlan, false, now)
      case 'save_plan':
        return await plan(args as McpPlan, true, now)
      case 'undo_change': {
        const c = await undoChange((args as { id?: string | null }).id)
        return ok({ undone: c.id, summary: c.summary })
      }
      default:
        return no(`CrankHog has no tool named ${name}.`)
    }
  } catch (e) {
    return no(e instanceof Error ? e.message : String(e))
  }
}

async function calendar(q: CalendarQuery, now: number): Promise<ToolAnswer> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(q.from) || !/^\d{4}-\d{2}-\d{2}$/.test(q.to)) return no('Write from and to as YYYY-MM-DD.')
  if (q.to < q.from) return no('to is before from.')
  if (q.to > addDays(q.from, MAX_SPAN_DAYS)) return no(`At most ${MAX_SPAN_DAYS} days at a time.`)
  const today = dateKey(now)
  const [entries, marks, plans, ftp] = await Promise.all([
    db().schedule.where('date').between(q.from, q.to, true, true).toArray(),
    db().dayMarks.where('date').between(q.from, q.to, true, true).toArray(),
    db().plans.toArray(),
    currentFtp(now),
  ])
  const start = dateKeyToMs(q.from)
  const end = dateKeyToMs(addDays(q.to, 1))
  const [rides, activities] = await Promise.all([db().rides.where('startedAt').between(start, end).toArray(), db().activities.where('startedAt').between(start, end).toArray()])
  const done = completions(
    entries,
    rides.map((r) => ({ id: r.id, startedAt: r.startedAt, workoutId: r.workoutId, simulated: r.simulated })),
    activities.map((a) => ({ id: a.id, startedAt: a.startedAt, group: activityGroup(a) })),
  )
  const planName = new Map(plans.map((p) => [p.id, p.name]))
  const ftpW = ftp?.ftpW ?? DEFAULT_FTP_W
  const sessions = []
  for (const e of entries.sort((a, b) => a.date.localeCompare(b.date))) {
    const f = await plannedFacts(e, ftpW)
    sessions.push({
      ref: refOf('c', e.id),
      day: day(e.date),
      sport: entrySport(e),
      name: e.name,
      status: scheduleStatus(e, done.has(e.id), today),
      minutes: minutes(f.durationS),
      load: f.load === null ? null : Math.round(f.load),
      ...(f.distanceM ? { km: Math.round(f.distanceM / 100) / 10 } : {}),
      ...(e.planId ? { plan: planName.get(e.planId) ?? null, planRef: refOf('p', e.planId) } : {}),
      ...(e.source === 'intervals' ? { fromIntervals: true } : {}),
      ...(q.steps && f.steps ? { steps: f.steps } : {}),
      ...(q.steps && f.notes ? { notes: f.notes } : {}),
    })
  }
  const days = marks
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((m) => ({ ref: refOf('m', m.id), day: day(m.date), kind: m.kind, ...(m.name ? { name: m.name } : {}), ...(m.priority ? { priority: m.priority } : {}), ...(m.note ? { note: m.note } : {}) }))
  return ok({ today: day(today), from: q.from, to: q.to, sessions, eventsAndDaysOff: days })
}

async function workouts(q: WorkoutQuery) {
  const ftpW = (await currentFtp())?.ftpW ?? DEFAULT_FTP_W
  const words = (q.search ?? '').toLowerCase().split(/\s+/).filter(Boolean)
  const matches = (name: string, tags: readonly string[]) => words.every((w) => name.toLowerCase().includes(w) || tags.some((t) => t.toLowerCase().includes(w)))
  const out: { name: string; sport: string; minutes: number | null; load: number | null; tags: string[]; from: string; favorite?: true }[] = []
  if (!q.sport || q.sport === 'bike') {
    for (const e of await loadLibrary(ftpW)) {
      if (!matches(e.workout.name, e.workout.tags)) continue
      const stats = plannedStatsOf(e.workout, e.stats)
      out.push({ name: e.workout.name, sport: 'bike', minutes: minutes(stats.durationS), load: stats.tss === null ? null : Math.round(stats.tss), tags: e.workout.tags, from: e.builtin ? 'CrankHog' : e.folder === 'plan' ? 'a training plan' : 'the athlete', ...(e.favorite ? { favorite: true as const } : {}) })
    }
  }
  if (q.sport !== 'bike') {
    const thresholds = await sessionThresholds()
    for (const w of await listSessionWorkouts()) {
      if (q.sport && w.sport !== q.sport) continue
      if (!matches(w.name, w.tags)) continue
      const p = plannedFrom(w, thresholds)
      out.push({ name: w.name, sport: w.sport, minutes: minutes(p.durationS), load: p.load == null ? null : Math.round(p.load), tags: w.tags, from: 'the athlete' })
    }
  }
  return { count: out.length, workouts: out.slice(0, MAX_WORKOUTS), ...(out.length > MAX_WORKOUTS ? { more: `${out.length - MAX_WORKOUTS} more: search to narrow it` } : {}) }
}

const side = (s: CardItem['before']) => s && { name: s.name, sport: s.sport, minutes: minutes(s.durationS), ...(s.distanceM ? { km: Math.round(s.distanceM / 100) / 10 } : {}), load: s.load === null ? null : Math.round(s.load) }

async function checked(p: Proposal, now: number) {
  const r = await checkProposal(p, day, now)
  return {
    canApply: r.problems.length === 0 && r.ops.length > 0,
    changes: r.items.map((i) => ({ change: i.line, ...(i.why ? { why: i.why } : {}), ...(i.before ? { before: side(i.before) } : {}), ...(i.after ? { after: side(i.after) } : {}), ...(i.removed ? { removed: true } : {}) })),
    ...(r.problems.length > 0 ? { problems: r.problems } : {}),
    ...(r.warnings.length > 0 ? { warnings: r.warnings } : {}),
    ...(r.notes.length > 0 ? { plans: r.notes } : {}),
  }
}

async function makeChanges(p: Proposal, now: number): Promise<ToolAnswer> {
  const r = await checkProposal(p, day, now)
  if (r.ops.length === 0 && r.problems.length === 0) return no('There are no changes in that.')
  if (r.problems.length > 0) return no(`Nothing was changed. ${r.problems.join(' ')}`)
  const applied = await applyProposal(p, now)
  const lines = r.items.map((i) => i.line)
  const change = await recordChange({ kind: 'changes', summary: p.summary || lines[0] || 'Changes', lines, undo: applied.undo })
  return ok({ id: change.id, done: lines, ...(r.warnings.length > 0 ? { warnings: r.warnings } : {}), ...(r.notes.length > 0 ? { plans: r.notes } : {}) })
}

/** The checked plan in numbers: weeks, sessions and hours by sport, and what the import couldn't read or left out. */
function planReport(prepared: PreparedImport, start: DateKey, raceDate: DateKey | undefined) {
  const bySport: Record<string, { sessions: number; hours: number }> = {}
  for (const r of prepared.ready) {
    const sport = r.item.sport
    const s = (bySport[sport] ??= { sessions: 0, hours: 0 })
    s.sessions++
    s.hours += (r.durationS ?? (r.item.minutes ?? 0) * 60) / 3600
  }
  for (const s of Object.values(bySport)) s.hours = Math.round(s.hours * 10) / 10
  const days = prepared.ready.flatMap((r) => (r.date ? [r.date] : []))
  const last = raceDate ?? days.at(-1) ?? start
  return {
    weeks: Math.floor((dateKeyToMs(last) - dateKeyToMs(start)) / (7 * 86_400_000)) + 1,
    first: days[0] ?? null,
    last: days.at(-1) ?? null,
    sessions: prepared.ready.length,
    bySport,
    ...(prepared.failed.length > 0 ? { cantRead: prepared.failed.map((f) => `${f.where}: ${f.reason}`) } : {}),
    ...(prepared.leftOut.length > 0 ? { leftOut: prepared.leftOut.map((f) => `${f.where}: ${f.reason}`) } : {}),
    warnings: prepared.ready.flatMap((r) => r.warnings.map((w) => `${r.item.where}: ${w}`)).slice(0, 40),
  }
}

async function plan(p: McpPlan, save: boolean, now: number): Promise<ToolAnswer> {
  const { doc, start, raceDate, problems } = planDoc(p, dateKey(now))
  if (problems.length > 0) return no(`${save ? 'Nothing was saved. ' : ''}${problems.slice(0, 40).join(' ')}`)
  const ftpW = (await currentFtp(now))?.ftpW ?? DEFAULT_FTP_W
  const prepared = prepareImport(doc, { start, ...(raceDate ? { raceDate } : {}), ftpW, thresholds: await sessionThresholds(), now })
  const report = planReport(prepared, start, raceDate)
  if (!save) return ok({ canSave: prepared.failed.length === 0 && prepared.ready.length > 0, ...report })
  if (prepared.failed.length > 0) return no(`Nothing was saved: CrankHog couldn't read ${prepared.failed.length} of the sessions. Fix them and save again. ${JSON.stringify(report.cantRead)}`)
  if (prepared.ready.length === 0) return no('Nothing was saved: there are no sessions before race day.')
  const race = p.race && raceDate ? { name: p.race.name, date: raceDate, priority: 'A' as const } : undefined
  const { plan: saved, made } = await saveImportUndoable(prepared.ready, { name: p.name, start, ...(race ? { event: race } : {}), ftpW })
  const change = await recordChange({
    kind: 'plan',
    summary: `Saved the plan ${saved.name}: ${prepared.ready.length} sessions${race ? `, to ${race.name} on ${day(race.date)}` : ''}`,
    lines: [`${prepared.ready.length} sessions from ${report.first ? day(report.first) : start} to ${report.last ? day(report.last) : start}`],
    made,
  })
  return ok({ id: change.id, plan: saved.name, planRef: refOf('p', saved.id), ...report })
}
