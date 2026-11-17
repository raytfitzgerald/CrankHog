// "Import a plan document": a coach's plan in a document or spreadsheet,
// read into sessions by the rider's AI provider (or from CrankHog's template,
// without AI), each checked with CrankHog's own importers, shown for review,
// and only then saved as a plan on the calendar. The AI gets the document's
// text and today's date, nothing else: no rides, no profile.
import { PlanImportSchema } from '@core/ai/schemas'
import { sessionFromFile } from '@core/multisport/build'
import type { SessionThresholds } from '@core/multisport/estimate'
import type { SessionWorkout } from '@core/multisport/model'
import { chunkDocument, planImportInput } from '@core/plan-import/chunk'
import { fromAiOutput, mergeDocs, placeItems, whereOf, type ImportDoc, type ImportItem } from '@core/plan-import/model'
import { readTemplate, type TemplateOptions } from '@core/plan-import/template'
import { contentId } from '@core/workout/ids'
import type { Workout } from '@core/workout/model'
import { weekdayOf, type DayMark, type PlanItem, type TrainingPlan } from '@core/workout/plan'
import { dateKey, type DateKey } from '@core/workout/schedule'
import { workoutIssues } from '@core/workout/validate'
import { db } from '../db/db'
import { bridge } from '../platform/bridge'
import { deleteSessionWorkout, saveSessionWorkout } from '../workouts/sessions-repo'
import { deleteWorkout, describeWorkout, parseWorkoutFile, saveWorkout } from '../workouts/library'
import type { ExtractedDocument } from './doc-extract'
import { addMark, removeMark } from './day-marks-repo'
import { createPlan, deletePlan, putOnCalendar, updatePlan } from './plans-repo'

/** Reading the document went wrong as a whole (nothing was read). */
export class PlanImportError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PlanImportError'
  }
}

/** Something that won't be made, where it is in the document, and why. */
export interface ImportProblem {
  where: string
  name?: string
  reason: string
}

export interface ReadDocument {
  doc: ImportDoc
  /** Parts the AI couldn't read, and template rows that couldn't be read. */
  problems: ImportProblem[]
}

/** Parts read at once: a long plan reads in a third of the time, without crowding the provider's rate limit. */
export const PARALLEL_PARTS = 3

/** Errors every later part would get too (no key, a key refused, the provider not there): no more parts are sent. */
const STOPS = new Set(['not-configured', 'auth', 'network', 'circuit-open'])

/**
 * The document's sessions, read by the rider's AI provider a part at a time
 * (@core/plan-import/chunk), `parallel` parts at once, in the document's
 * order whatever order they come back in. A part that fails is reported and
 * the others kept; after an error every later part would get too, no more
 * are sent. When every part fails, throws PlanImportError with the reason.
 * `onProgress` says how many parts are read, as each one is.
 */
export async function readWithAi(doc: ExtractedDocument, opts: { onProgress?: (read: number, parts: number) => void; now?: number; parallel?: number } = {}): Promise<ReadDocument> {
  const { context, chunks } = chunkDocument(doc.text)
  const today = dateKey(opts.now ?? Date.now())
  const results: ({ doc: ImportDoc } | { problem: ImportProblem } | undefined)[] = chunks.map(() => undefined)
  let next = 0
  let read = 0
  let stop: string | null = null
  const partName = (i: number) => {
    const chunk = chunks[i]!
    return chunks.length === 1 ? doc.fileName : `Part ${i + 1} of ${chunks.length}${chunk.weeks ? ` (weeks ${chunk.weeks[0]}-${chunk.weeks[1]})` : ''}`
  }
  const readPart = async (i: number) => {
    const input = planImportInput({ fileName: doc.fileName, today, chunk: chunks[i]!, part: i + 1, parts: chunks.length, context })
    const res = await bridge()
      .invoke('ai.structured', { purpose: 'plan-import', input })
      .catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : String(e), code: undefined, value: undefined }))
    if (!res.ok) {
      const reason = res.error ?? 'The AI could not read it.'
      if (res.code && STOPS.has(res.code)) stop ??= reason
      return { problem: { where: partName(i), reason } }
    }
    const parsed = PlanImportSchema.safeParse(res.value)
    if (!parsed.success) return { problem: { where: partName(i), reason: "The AI's answer didn't make sense, so it was not used." } }
    return { doc: fromAiOutput(parsed.data) }
  }
  const worker = async () => {
    while (stop === null && next < chunks.length) {
      const i = next++
      results[i] = await readPart(i)
      opts.onProgress?.(++read, chunks.length)
    }
  }
  opts.onProgress?.(0, chunks.length)
  await Promise.all(Array.from({ length: Math.max(1, Math.min(opts.parallel ?? PARALLEL_PARTS, chunks.length)) }, worker))

  const parts: ImportDoc[] = []
  const problems: ImportProblem[] = []
  results.forEach((r, i) => {
    if (!r) problems.push({ where: partName(i), reason: `Not sent: ${stop ?? 'reading stopped.'}` })
    else if ('doc' in r) parts.push(r.doc)
    else problems.push(r.problem)
  })
  if (parts.length === 0) {
    const reasons = problems.filter((p) => !p.reason.startsWith('Not sent: '))
    throw new PlanImportError(chunks.length === 1 || stop ? (stop ?? problems[0]!.reason) : `The AI couldn't read any part of it: ${reasons[0]?.reason ?? ''}`)
  }
  const merged = mergeDocs(parts, context)
  if (merged.items.length === 0 && problems.length === 0) throw new PlanImportError(`The AI found no sessions in ${doc.fileName}.${merged.skipped[0] ? ` ${merged.skipped[0].reason}` : ''}`)
  return { doc: merged, problems }
}

/** The document read as CrankHog's plan template (no AI). */
export function readTemplateDocument(doc: ExtractedDocument, opts: TemplateOptions = {}): ReadDocument {
  const { doc: read, problems } = readTemplate(doc.rows ?? [], opts)
  return { doc: { ...read, name: doc.fileName.replace(/\.[^.]+$/, '') }, problems: problems.map((p) => ({ where: p.where, reason: p.reason })) }
}

interface ReadyBase {
  item: ImportItem
  /** Its day, or none: the plan's next ride day, or with a race, counted back from it. */
  date?: DateKey
  durationS: number | null
  warnings: string[]
}
export interface ReadyBike extends ReadyBase {
  kind: 'bike'
  workout: Workout
}
export interface ReadySession extends ReadyBase {
  kind: 'session'
  workout: SessionWorkout
}
export type ReadyItem = ReadyBike | ReadySession

export interface PreparedImport {
  ready: ReadyItem[]
  /** Sessions whose steps CrankHog couldn't read: the reason, by line of the steps. */
  failed: ImportProblem[]
  /** Sessions on or after race day: the race is on the calendar, the plan stops the day before. */
  leftOut: ImportProblem[]
}

export interface CheckContext {
  ftpW: number
  thresholds: SessionThresholds
  now: number
}

const oneLine = (s: string) => s.replace(/\s*[\r\n]+\s*/g, ' ').trim()

/** A bike session through the bike importer, as a .txt of intervals.icu text. */
function checkBike(item: ImportItem, ftpW: number): Omit<ReadyBike, 'item' | 'date'> | string {
  if (item.steps === '') return 'No steps. A ride needs its steps, such as "- 1h 65%".'
  let parsed: ReturnType<typeof parseWorkoutFile>
  try {
    parsed = parseWorkoutFile(`${item.name}.txt`, item.steps)
  } catch (e) {
    return e instanceof Error ? e.message : String(e)
  }
  // a line the text reader couldn't read is a step left out: the session isn't the one the document has
  if (parsed.warnings.length > 0) return parsed.warnings.join(' ')
  const workout: Workout = {
    ...parsed.workout,
    // the same session, named the same, is the same workout: importing the plan again replaces it rather than adding copies
    id: contentId('plan-import', `${item.name}\n${item.steps}`),
    name: item.name,
    ...(item.notes ? { description: item.notes } : {}),
    source: 'import',
  }
  const issues = workoutIssues(workout)
  const errors = issues.filter((i) => i.severity === 'error')
  if (errors.length > 0) return errors.map((i) => i.message).join(' ')
  return { kind: 'bike', workout, durationS: describeWorkout(workout, ftpW).stats.durationS, warnings: issues.map((i) => i.message) }
}

/** A run, swim or other session through the session importer, as a session file: header lines, a blank line, the steps. */
function checkSession(item: ImportItem, ctx: CheckContext): Omit<ReadySession, 'item' | 'date'> | string {
  const header = [`sport: ${item.sport}`, `name: ${oneLine(item.name)}`]
  if (item.steps === '' && item.minutes) header.push(`duration: ${item.minutes}m`)
  if (item.steps === '' && item.effort) header.push(`effort: ${item.effort}`)
  if (item.notes) header.push(`notes: ${oneLine(item.notes)}`)
  const text = `${header.join('\n')}\n\n${item.steps}\n`
  const r = sessionFromFile(`${item.name}.txt`, text, ctx.thresholds, ctx.now)
  // line numbers count from the first line of the steps, which is what the rider sees
  const say = (m: { line?: number; text: string }) => (m.line && m.line > header.length + 1 ? `Line ${m.line - header.length - 1}: ${m.text}` : m.text)
  if (!r.workout) return r.errors.map(say).join(' ') || 'CrankHog could not read it.'
  return { kind: 'session', workout: r.workout, durationS: r.estimate?.durationS ?? null, warnings: r.warnings.map(say) }
}

/**
 * Every session checked and dated: dated by the document, or by its week and
 * weekday counted from `start` (a Monday). A session on or after race day is
 * left out. Nothing is saved.
 */
export function prepareImport(doc: ImportDoc, opts: CheckContext & { start: DateKey; raceDate?: DateKey }): PreparedImport {
  const dates = placeItems(doc.items, opts.start)
  const ready: ReadyItem[] = []
  const failed: ImportProblem[] = []
  const leftOut: ImportProblem[] = []
  doc.items.forEach((item, i) => {
    const date = dates[i]
    const where = item.where || whereOf(item)
    if (!item.name) return failed.push({ where, reason: 'It has no name.' })
    const checked = item.sport === 'bike' ? checkBike(item, opts.ftpW) : checkSession(item, opts)
    if (typeof checked === 'string') return failed.push({ where, name: item.name, reason: checked })
    if (opts.raceDate && date && date >= opts.raceDate) return leftOut.push({ where, name: item.name, reason: date === opts.raceDate ? 'On race day: the race is on your calendar.' : 'After race day.' })
    ready.push({ ...checked, item, ...(date ? { date } : {}) } as ReadyItem)
  })
  // the plan's order is the calendar's; sessions with no day keep the document's order, after the dated ones
  ready.sort((a, b) => (a.date ?? '￿').localeCompare(b.date ?? '￿'))
  return { ready, failed, leftOut }
}

export interface SaveImport {
  name: string
  /** The plan's first Monday. */
  start: DateKey
  /** The event the plan builds to: put on the calendar with the plan, or the event already there that day. */
  event?: { name: string; date: DateKey; priority: NonNullable<DayMark['priority']> }
  ftpW: number
}

const newItemId = (i: number) => `i${i.toString(36)}${crypto.randomUUID().slice(0, 6)}`

/**
 * Saves the checked sessions as a plan on the calendar: the event (if any),
 * the bike workouts filed in the plan, the run, swim and other sessions, and
 * every session on its day. A plan with an event counts back from race day,
 * so sessions with no day end on the ride day before it, and follow the race
 * if it moves. If that fails part way, what it made is taken
 * back (never a workout the rider already had), so trying again doesn't leave
 * a second plan.
 */
export async function saveImport(ready: readonly ReadyItem[], opts: SaveImport): Promise<TrainingPlan> {
  if (ready.length === 0) throw new PlanImportError('There is nothing to save.')
  const existing = opts.event ? await eventOn(opts.event.date, opts.event.name) : undefined
  const event = existing ?? (opts.event ? await addMark({ date: opts.event.date, kind: 'event', name: opts.event.name, priority: opts.event.priority }) : undefined)
  let plan: TrainingPlan | undefined
  const madeBikes: string[] = []
  const madeSessions: string[] = []
  try {
    const rideDays = [...new Set(ready.filter((r) => r.date).map((r) => weekdayOf(r.date!)))].sort()
    plan = await createPlan({ name: opts.name, source: 'files', startDate: opts.start, eventId: event?.id, ...(event ? { anchor: 'race' as const } : {}), ...(rideDays.length > 0 ? { rideDays } : {}) })
    const saved = new Set<string>()
    for (const r of ready) {
      if (saved.has(r.workout.id)) continue
      saved.add(r.workout.id)
      if (r.kind === 'bike') {
        if (!(await db().workouts.get(r.workout.id))) madeBikes.push(r.workout.id)
        await saveWorkout({ ...r.workout, folder: 'plan', planId: plan.id }, opts.ftpW)
      } else {
        if (!(await db().sessionWorkouts.get(r.workout.id))) madeSessions.push(r.workout.id)
        await saveSessionWorkout(r.workout)
      }
    }
    const items: PlanItem[] = ready.map((r, i) => ({ id: newItemId(i), workoutId: r.workout.id, ...(r.kind === 'session' ? { sport: r.workout.sport } : {}), ...(r.date ? { date: r.date } : {}) }))
    await updatePlan(plan.id, { items })
    return await putOnCalendar(plan.id)
  } catch (e) {
    await undoSave(plan, existing ? undefined : event, madeBikes, madeSessions).catch(() => undefined)
    throw e
  }
}

/** The event already on the calendar that day, if any: the one of that name, else the most important. A plan for it builds to it rather than to a copy. */
export async function eventOn(date: DateKey, name?: string): Promise<DayMark | undefined> {
  const events = (await db().dayMarks.where('date').equals(date).toArray()).filter((m) => m.kind === 'event')
  const rank = (m: DayMark) => (name && m.name?.trim().toLowerCase() === name.trim().toLowerCase() ? 0 : 1) * 10 + ['A', 'B', 'C'].indexOf(m.priority ?? 'C')
  return events.sort((a, b) => rank(a) - rank(b))[0]
}

async function undoSave(plan: TrainingPlan | undefined, event: DayMark | undefined, bikes: readonly string[], sessions: readonly string[]): Promise<void> {
  if (plan) await deletePlan(plan.id)
  for (const id of bikes) await deleteWorkout(id)
  for (const id of sessions) await deleteSessionWorkout(id)
  if (event) await removeMark(event.id)
}
