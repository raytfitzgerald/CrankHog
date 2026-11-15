// "Build a plan for me": a plan outline from the survey, either by CrankHog's
// own rules or by the rider's AI provider, filled with workouts from the
// library. AI writes only the sessions nothing in the library fits. The AI
// sees the survey and rides recorded in CrankHog, never anything from Strava.
import type { DayMark, PlanSurvey, TrainingPlan } from '@core/workout/plan'
import { baseSkeleton, builtinSkeleton, closestAnyLength, fillSkeleton, fromStart, MAX_AI_WEEKS, skeletonDates, type LibraryCandidate, type PlanSkeleton, type SkeletonSession } from '@core/workout/plan-builder'
import type { Workout } from '@core/workout/model'
import { GeneratedWorkoutSchema, PlanSkeletonSchema } from '@core/ai/schemas'
import { workoutFromGenerated } from '@core/workout/from-generated'
import { validateWorkout } from '@core/workout/validate'
import { currentFtp, DEFAULT_FTP_W } from '../db/athlete-repo'
import { pmcSeries, weeklyLoad } from '../db/fitness'
import { bridge } from '../platform/bridge'
import { deleteWorkout, loadLibrary, saveWorkout } from '../workouts/library'
import { addMark, removeMark } from './day-marks-repo'
import { createPlan, deletePlan, putOnCalendar, updatePlan } from './plans-repo'

export interface DraftInput {
  survey: PlanSurvey
  weeks: number
  toEvent: boolean
}

export interface PlanDraft {
  skeleton: PlanSkeleton
  /** A workout id for each session (built-in, the rider's own, or one in `written`). */
  picks: (string | null)[][]
  /** Workouts the AI wrote for sessions nothing in the library fitted (not saved yet). */
  written: Workout[]
  source: 'ai' | 'builtin'
  ftpW: number
}

export class PlanAiError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PlanAiError'
  }
}

/** At most this many workouts are written by AI for one plan; the rest take the closest from the library. */
export const MAX_AI_WORKOUTS = 8

async function library(ftpW: number): Promise<{ candidates: LibraryCandidate[] }> {
  const entries = await loadLibrary(ftpW)
  return { candidates: entries.map((e) => ({ id: e.workout.id, tags: e.workout.tags, durationS: e.stats.durationS, ftpTest: e.workout.ftpTest?.protocol })) }
}

async function ftp(): Promise<number> {
  return (await currentFtp())?.ftpW ?? DEFAULT_FTP_W
}

/** Fills the picks nothing fitted with the closest of any length. */
function fallback(skeleton: PlanSkeleton, picks: (string | null)[][], candidates: readonly LibraryCandidate[]): (string | null)[][] {
  return picks.map((week, wi) => week.map((p, si) => p ?? closestAnyLength(skeleton.weeks[wi]!.sessions[si]!, candidates)))
}

/** A plan by CrankHog's own periodization rules, from CrankHog's workouts. No AI. */
export async function draftBuiltinPlan(input: DraftInput): Promise<PlanDraft> {
  const ftpW = await ftp()
  const { candidates } = await library(ftpW)
  const skeleton = builtinSkeleton(input.survey, input.weeks, input.toEvent)
  const { picks } = fillSkeleton(skeleton, candidates)
  return { skeleton, picks: fallback(skeleton, picks, candidates), written: [], source: 'builtin', ftpW }
}

/** What the AI planner is told: the survey, the weeks it plans (after any base weeks before them), and recent training recorded here. */
async function plannerInput(input: DraftInput, baseWeeksBefore: number, ftpW: number): Promise<string> {
  const [weeks, pmc] = await Promise.all([weeklyLoad(6), pmcSeries(1)])
  const context = {
    survey: input.survey,
    weeks: input.weeks,
    baseWeeksBefore,
    endsWithEvent: input.toEvent,
    ftpW,
    recentWeeks: weeks.map((w) => ({ hours: Math.round(w.hours * 10) / 10, tss: Math.round(w.tss), rides: w.rides })),
    fitnessCtl: pmc.at(-1) ? Math.round(pmc.at(-1)!.ctl) : null,
  }
  return `Plan this rider's training. Survey and recent training (recorded in CrankHog):\n${JSON.stringify(context)}`
}

function sessionRequest(s: SkeletonSession, ftpW: number): string {
  return `The rider's request: a ${s.minutes}-minute ${s.type.replace('-', ' ')} session. ${s.intent} The rider's FTP is ${ftpW} W. The whole workout, warm-up and cool-down included, lasts ${s.minutes} minutes.`
}

/**
 * A plan outlined by the rider's AI provider. Throws PlanAiError when the
 * AI is not set up, fails, or answers with an outline that doesn't parse.
 * The AI outlines at most MAX_AI_WEEKS; a plan to an event further off rides
 * base by CrankHog's rules until then, so the AI's taper lands on the event.
 */
export async function draftAiPlan(input: DraftInput, opts: { maxWritten?: number } = {}): Promise<PlanDraft> {
  const ftpW = await ftp()
  const aiWeeks = Math.min(input.weeks, MAX_AI_WEEKS)
  const res = await bridge().invoke('ai.structured', { purpose: 'training-plan', input: await plannerInput({ ...input, weeks: aiWeeks }, input.weeks - aiWeeks, ftpW) })
  if (!res.ok) throw new PlanAiError(res.error ?? 'The AI could not plan this.')
  const parsed = PlanSkeletonSchema.safeParse(res.value)
  if (!parsed.success) throw new PlanAiError("The AI's plan didn't make sense, so it was not used.")
  // the weeks asked for, on the days the rider can ride; to an event, the last ones, so it still ends there
  const days = new Set(input.survey.rideDays)
  const own = (input.toEvent ? parsed.data.weeks.slice(-aiWeeks) : parsed.data.weeks.slice(0, aiWeeks)).map((w) => ({ ...w, sessions: w.sessions.filter((s) => days.has(s.day)) }))
  if (own.every((w) => w.sessions.length === 0)) throw new PlanAiError("The AI's plan had no rides on your days.")
  const before = input.toEvent ? baseSkeleton(input.survey, input.weeks - own.length).weeks : []
  const skeleton: PlanSkeleton = fromStart({ weeks: [...before, ...own] }, input.survey.startDate)

  const { candidates } = await library(ftpW)
  const { picks, unfilled } = fillSkeleton(skeleton, candidates)
  const written: Workout[] = []
  for (const { week, session } of unfilled.slice(0, opts.maxWritten ?? MAX_AI_WORKOUTS)) {
    const s = skeleton.weeks[week]!.sessions[session]!
    if (s.type === 'test') continue
    const r = await bridge()
      .invoke('ai.structured', { purpose: 'workout', input: sessionRequest(s, ftpW) })
      .catch(() => null)
    const g = r?.ok ? GeneratedWorkoutSchema.safeParse(r.value) : null
    if (!g?.success) continue
    const w: Workout = { ...workoutFromGenerated(g.data, { id: `ai-${Date.now().toString(36)}${crypto.randomUUID().slice(0, 8)}` }), source: 'ai' }
    if (validateWorkout(w).length > 0) continue
    written.push(w)
    picks[week]![session] = w.id
  }
  return { skeleton, picks: fallback(skeleton, picks, candidates), written, source: 'ai', ftpW }
}

/**
 * Saves a draft as a plan: the event on the calendar (if any), the AI's
 * workouts in the library, every session on its day, and the plan on the
 * calendar. If that fails part way, what it made is taken back, so trying
 * again doesn't leave a second plan.
 */
export async function savePlanDraft(draft: PlanDraft, opts: { name: string; survey: PlanSurvey; event?: { name: string; date: string; priority: NonNullable<DayMark['priority']> } }): Promise<TrainingPlan> {
  const event = opts.event ? await addMark({ date: opts.event.date, kind: 'event', name: opts.event.name, priority: opts.event.priority }) : undefined
  let plan: TrainingPlan | undefined
  try {
    plan = await createPlan({ name: opts.name, survey: opts.survey, rideDays: opts.survey.rideDays, startDate: opts.survey.startDate, source: draft.source, eventId: event?.id })
    for (const w of draft.written) await saveWorkout({ ...w, folder: 'plan', planId: plan.id }, draft.ftpW)
    const items = skeletonDates(draft.skeleton, opts.survey.startDate)
      .map(({ date, week, session }) => ({ date, workoutId: draft.picks[week]?.[session] ?? null }))
      .filter((x): x is { date: string; workoutId: string } => x.workoutId !== null)
      // nothing on race day or after it
      .filter((x) => !opts.event || x.date < opts.event.date)
      .map((x, i) => ({ id: `i${i.toString(36)}${crypto.randomUUID().slice(0, 6)}`, workoutId: x.workoutId, date: x.date }))
    await updatePlan(plan.id, { items })
    return await putOnCalendar(plan.id)
  } catch (e) {
    await undoSave(plan, event, draft.written).catch(() => undefined)
    throw e
  }
}

async function undoSave(plan: TrainingPlan | undefined, event: DayMark | undefined, written: readonly Workout[]): Promise<void> {
  if (plan) await deletePlan(plan.id)
  for (const w of written) await deleteWorkout(w.id)
  if (event) await removeMark(event.id)
}
