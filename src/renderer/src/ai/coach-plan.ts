// Plans the coach drafts in the chat: written by the rider's AI provider in
// steps (@core/coach-plan/draft: an outline, then a few weeks at a time,
// three blocks at once), revised on the rider's feedback, and saved, once
// the rider accepts, as the plan-document import saves a plan: each session
// checked by CrankHog's own importers, the race an A event, the plan
// counted back from it, every session on its day.
//
// Drafts live in a store the chat's plan card watches, so one keeps writing
// while the rider reads elsewhere, and are kept in IndexedDB so the card
// survives a restart. A draft still being written when CrankHog closed is
// marked as stopped.
import { createStore, useStore } from 'zustand'
import { PlanOutlineSchema, PlanWeeksSchema } from '@core/ai/schemas'
import { checkBrief, PlanRevisionSchema, reshapes, type PlanBrief, type PlanSpan } from '@core/coach-plan/brief'
import { blocksOf, changedWeeks, draftFacts, fromOutline, fromWeeks, MAX_REPAIR, outlineInput, repairInput, replaceWeeks, weeksInput, type PlanDraft, type PlanOutline } from '@core/coach-plan/draft'
import type { ImportItem } from '@core/plan-import/model'
import { dateKey, type DateKey } from '@core/workout/schedule'
import { currentFtp, DEFAULT_FTP_W } from '../db/athlete-repo'
import { db } from '../db/db'
import { bridge } from '../platform/bridge'
import { checkItem, PARALLEL_PARTS, prepareImport, saveImportUndoable, undoImport, type ImportMade, type PreparedImport } from '../plan/doc-import'
import { sessionThresholds } from '../workouts/sessions-repo'
import { coachContext } from './client'

export type DraftStatus = 'drafting' | 'ready' | 'failed' | 'superseded' | 'accepted'

export interface DraftRecord {
  id: string
  version: number
  name: string
  status: DraftStatus
  /** While drafting: parts written of all there are (the outline, then each block of weeks). */
  progress?: { done: number; total: number; what: string }
  /** The draft, while it can still be accepted (or undone after). */
  draft?: PlanDraft
  error?: string
  /** What accepting it made, for the card and for Undo. */
  accepted?: { planId: string; sessions: number; first?: DateKey; last?: DateKey; made: ImportMade }
  createdAt: number
}

const KV_KEY = 'coach.plan-drafts'

const store = createStore<{ drafts: Record<string, DraftRecord>; loaded: boolean }>(() => ({ drafts: {}, loaded: false }))

export const useDraft = (id: string): DraftRecord | undefined => useStore(store, (s) => s.drafts[id])

function put(r: DraftRecord, save = true): void {
  store.setState((s) => ({ drafts: { ...s.drafts, [r.id]: r } }))
  if (save) void persist()
}

let writes: Promise<unknown> = Promise.resolve()
function persist(): Promise<unknown> {
  // one write at a time, each with the latest state
  writes = writes.then(() => db().kv.put({ key: KV_KEY, value: store.getState().drafts })).catch(() => undefined)
  return writes
}

/** Reads the drafts kept from before, once. One that was being written when CrankHog closed is marked as stopped. */
export async function loadDrafts(): Promise<void> {
  if (store.getState().loaded) return
  const row = await db().kv.get(KV_KEY)
  const kept = row?.value && typeof row.value === 'object' ? (row.value as Record<string, DraftRecord>) : {}
  const live = store.getState().drafts
  const drafts: Record<string, DraftRecord> = {}
  for (const [id, r] of Object.entries(kept)) drafts[id] = r.status === 'drafting' && !live[id] ? { ...r, status: 'failed', progress: undefined, error: 'Drafting stopped when CrankHog closed. Ask the coach to draft it again.' } : r
  store.setState({ drafts: { ...drafts, ...live }, loaded: true })
}

/** Forgets every draft (a new chat). */
export async function clearDrafts(): Promise<void> {
  store.setState({ drafts: {} })
  await db().kv.delete(KV_KEY)
}

/** The draft the rider is reviewing now: the newest one that's ready. */
export function currentDraft(): DraftRecord | undefined {
  return Object.values(store.getState().drafts)
    .filter((r) => r.status === 'ready' && r.draft)
    .sort((a, b) => b.createdAt - a.createdAt)[0]
}

/** The draft as the coach chat reads it, if there's one under review. */
export function draftForCoach(): unknown {
  const r = currentDraft()
  return r?.draft ? draftFacts(r.draft, 'shown to the rider for review, not saved yet') : undefined
}

/** What became of a plan card, for the coach: one line. */
export function draftNote(id: string): string | null {
  const r = store.getState().drafts[id]
  if (!r) return null
  switch (r.status) {
    case 'drafting':
      return `Draft ${r.version} of the plan "${r.name}" is still being written.`
    case 'ready':
      return `Draft ${r.version} of the plan "${r.name}" is ready and shown to the rider (planDraft in the data). They haven't accepted it yet.`
    case 'failed':
      return `Drafting the plan "${r.name}" failed: ${r.error ?? 'unknown error'}`
    case 'superseded':
      return `Draft ${r.version} of the plan "${r.name}" was replaced by a revision.`
    case 'accepted':
      return `The rider accepted draft ${r.version}: "${r.name}" is saved as their plan and on their calendar.`
  }
}

// ---- writing a draft --------------------------------------------------------

/** Errors every later call would get too: nothing more is sent. */
const STOPS = new Set(['not-configured', 'auth', 'network', 'circuit-open'])

class DraftError extends Error {}

async function structured<T>(purpose: 'plan-outline' | 'plan-weeks', input: string, parse: (v: unknown) => T | null): Promise<T> {
  const res = await bridge()
    .invoke('ai.structured', { purpose, input })
    .catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : String(e), code: 'provider', value: undefined }))
  if (!res.ok) throw Object.assign(new DraftError(res.error ?? 'The AI could not write it.'), { code: res.code })
  const v = parse(res.value)
  if (v === null) throw new DraftError("The AI's answer didn't make sense.")
  return v
}

/** The rider's numbers for the planner: thresholds, fitness, recent weeks, and hours a week of each sport lately. No names, no Strava data. */
async function athleteFacts(): Promise<string> {
  const ctx = JSON.parse(await coachContext()) as {
    athlete?: unknown
    fitness?: unknown
    weeks?: unknown
    events?: unknown
    rides?: { movingMin?: number }[]
    otherActivities?: { sport?: string; min?: number }[]
  }
  const hours = { bike: 0, run: 0, swim: 0, other: 0 }
  for (const r of ctx.rides ?? []) hours.bike += (r.movingMin ?? 0) / 60
  for (const a of ctx.otherActivities ?? []) {
    const k = a.sport === 'ride' ? 'bike' : a.sport === 'run' || a.sport === 'swim' ? a.sport : 'other'
    hours[k] += (a.min ?? 0) / 60
  }
  const perWeek = Object.fromEntries(Object.entries(hours).map(([k, h]) => [k, Math.round((h / 6) * 10) / 10]))
  return JSON.stringify({ athlete: ctx.athlete, fitness: ctx.fitness, recentWeeks: ctx.weeks, hoursPerWeekLast6Weeks: perWeek, events: ctx.events })
}

interface Job {
  today: DateKey
  brief: PlanBrief
  span: PlanSpan
  athlete: string
  onProgress: (done: number, total: number, what: string) => void
}

const weeksName = (b: readonly [number, number]) => (b[0] === b[1] ? `Week ${b[0]}` : `Weeks ${b[0]}-${b[1]}`)

/**
 * Writes `weeks` of the plan in blocks, `PARALLEL_PARTS` at once, into
 * `items`. A block that fails is a problem and its weeks stay as they were;
 * after an error every later block would get too, no more are sent.
 */
async function writeWeeks(job: Job, outline: PlanOutline, items: ImportItem[], weeks: readonly number[], revise?: { feedback: string }, counted = { done: 1, total: 1 }) {
  const blocks = blocksOf(weeks)
  const problems: { where: string; reason: string }[] = []
  let out = items
  let next = 0
  let stop: string | null = null
  const rewriting = new Set(weeks)
  const one = async (block: [number, number]) => {
    const before = out.filter((i) => i.week === block[0] - 1 && !rewriting.has(block[0] - 1))
    const current = out.filter((i) => i.week !== undefined && i.week >= block[0] && i.week <= block[1])
    const input = weeksInput({ today: job.today, brief: job.brief, span: job.span, athlete: job.athlete, outline, block, before, ...(revise ? { current, feedback: revise.feedback } : {}) })
    try {
      const fresh = await structured('plan-weeks', input, (v) => {
        const p = PlanWeeksSchema.safeParse(v)
        return p.success ? fromWeeks(p.data, block) : null
      })
      if (fresh.length === 0) throw new DraftError('The AI wrote no sessions for them.')
      out = replaceWeeks(out, block, fresh)
    } catch (e) {
      const code = (e as { code?: string }).code
      if (code && STOPS.has(code)) stop ??= (e as Error).message
      problems.push({ where: weeksName(block), reason: (e as Error).message })
    }
  }
  const worker = async () => {
    while (stop === null && next < blocks.length) {
      const block = blocks[next++]!
      job.onProgress(counted.done, counted.total, 'Writing the weeks')
      await one(block)
      counted.done++
      job.onProgress(counted.done, counted.total, 'Writing the weeks')
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(PARALLEL_PARTS, blocks.length)) }, worker))
  for (const b of blocks.slice(next)) problems.push({ where: weeksName(b), reason: `Not sent: ${stop ?? 'drafting stopped.'}` })
  if (stop && problems.length === blocks.length) throw new DraftError(stop)
  return { items: out, problems }
}

/** Sessions CrankHog's importers can't read, sent back once to be written again; those still unreadable stay, for the card to list. */
async function repair(job: Job, items: ImportItem[]): Promise<ImportItem[]> {
  const ctx = { ftpW: (await currentFtp())?.ftpW ?? DEFAULT_FTP_W, thresholds: await sessionThresholds(), now: Date.now() }
  const failed = items.flatMap((item) => {
    const r = checkItem(item, ctx)
    return typeof r === 'string' ? [{ item, reason: r }] : []
  })
  if (failed.length === 0) return items
  const sent = failed.slice(0, MAX_REPAIR)
  const weeks = sent.map((f) => f.item.week!)
  const block: [number, number] = [Math.min(...weeks), Math.max(...weeks)]
  try {
    const fixed = await structured('plan-weeks', repairInput({ today: job.today, brief: job.brief, span: job.span, failed: sent }), (v) => {
      const p = PlanWeeksSchema.safeParse(v)
      return p.success ? fromWeeks(p.data, block) : null
    })
    const good = fixed.filter((i) => typeof checkItem(i, ctx) !== 'string')
    // a fixed session takes the place of the broken one on its day and sport
    const fixedKey = new Set(good.map((i) => `${i.week}/${i.weekday}/${i.sport}`))
    const broken = new Set(sent.map((f) => f.item))
    const kept = items.filter((i) => !broken.has(i) || !fixedKey.has(`${i.week}/${i.weekday}/${i.sport}`))
    return [...kept, ...good].sort((a, b) => (a.week ?? 0) - (b.week ?? 0) || (a.weekday ?? 0) - (b.weekday ?? 0))
  } catch {
    return items
  }
}

const newId = () => `d${Date.now().toString(36)}${crypto.randomUUID().slice(0, 6)}`

function outlineOf(v: unknown, weeks: number): PlanOutline | null {
  const p = PlanOutlineSchema.safeParse(v)
  return p.success ? fromOutline(p.data, weeks) : null
}

/**
 * Starts drafting a plan from the coach's brief. Returns the draft's id at
 * once (the card shows it being written), or an error when the brief can't
 * be a plan.
 */
export function startDraft(raw: unknown, now = Date.now()): { id: string } | { error: string } {
  const today = dateKey(now)
  const checked = checkBrief(raw, today)
  if (!checked.ok) return { error: checked.error }
  const id = newId()
  const { brief, span, notes } = checked
  const base: DraftRecord = { id, version: 1, name: brief.name, status: 'drafting', progress: { done: 0, total: 1, what: 'Outlining the plan' }, createdAt: now }
  put(base, true)
  void (async () => {
    try {
      const job: Job = { today, brief, span, athlete: await athleteFacts(), onProgress: (done, total, what) => put({ ...store.getState().drafts[id]!, progress: { done, total, what } }, false) }
      const total = 1 + blocksOf(range(span.weeks)).length
      job.onProgress(0, total, 'Outlining the plan')
      const outline = await structured('plan-outline', outlineInput({ today, brief, span, athlete: job.athlete }), (v) => outlineOf(v, span.weeks))
      const written = await writeWeeks(job, outline, [], range(span.weeks), undefined, { done: 1, total })
      job.onProgress(total, total, 'Checking the sessions')
      const items = await repair(job, written.items)
      if (items.length === 0) throw new DraftError(written.problems[0]?.reason ?? 'The AI wrote no sessions.')
      const draft: PlanDraft = { id, version: 1, brief, span, outline, items, problems: written.problems, notes, createdAt: Date.now() }
      put({ ...base, status: 'ready', progress: undefined, draft })
    } catch (e) {
      put({ ...base, status: 'failed', progress: undefined, error: e instanceof Error ? e.message : String(e) })
    }
  })()
  return { id }
}

const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1)

/**
 * Starts revising the draft under review with the rider's feedback: the
 * outline changed as asked, and the weeks whose outline changed rewritten.
 * The new draft replaces the old one once it's written; if it fails, the old
 * one stays.
 */
export function startRevision(raw: unknown, now = Date.now()): { id: string } | { error: string } {
  const parsed = PlanRevisionSchema.safeParse(raw)
  if (!parsed.success || !parsed.data.feedback.trim()) return { error: "The coach's revision didn't make sense." }
  const was = currentDraft()
  if (!was?.draft) return { error: 'There is no draft to revise. Ask the coach to draft the plan first.' }
  const old = was.draft
  const today = dateKey(now)
  const checked = parsed.data.brief ? checkBrief(parsed.data.brief, today) : ({ ok: true, brief: old.brief, span: old.span, notes: old.notes } as const)
  if (!checked.ok) return { error: checked.error }
  const { brief, span, notes } = checked
  const feedback = parsed.data.feedback.trim().slice(0, 2000)
  const asked = (parsed.data.weeks ?? []).map(Math.round).filter((w) => w >= 1 && w <= span.weeks)
  const id = newId()
  const base: DraftRecord = { id, version: was.version + 1, name: brief.name, status: 'drafting', progress: { done: 0, total: 1, what: 'Revising the outline' }, createdAt: now }
  put(base, true)
  void (async () => {
    try {
      const job: Job = { today, brief, span, athlete: await athleteFacts(), onProgress: (done, total, what) => put({ ...store.getState().drafts[id]!, progress: { done, total, what } }, false) }
      const sameSpan = span.start === old.span.start && span.weeks === old.span.weeks
      const reshaped = !sameSpan || reshapes(old.brief, brief)
      job.onProgress(0, 2, 'Revising the outline')
      const outline = await structured('plan-outline', outlineInput({ today, brief, span, athlete: job.athlete, ...(sameSpan ? { current: old.outline, feedback } : {}) }), (v) => outlineOf(v, span.weeks))
      const empty = range(span.weeks).filter((w) => !old.items.some((i) => i.week === w))
      let weeks = reshaped ? range(span.weeks) : [...new Set([...changedWeeks(old.outline, outline), ...asked, ...empty])]
      // the feedback changed nothing in the outline: it is about the sessions, so they are all looked at again
      if (weeks.length === 0) weeks = range(span.weeks)
      const total = 1 + blocksOf(weeks).length
      const written = await writeWeeks(job, outline, sameSpan ? old.items : [], weeks, { feedback }, { done: 1, total })
      job.onProgress(total, total, 'Checking the sessions')
      const items = await repair(job, written.items)
      if (items.length === 0) throw new DraftError(written.problems[0]?.reason ?? 'The AI wrote no sessions.')
      const draft: PlanDraft = { id, version: base.version, brief, span, outline, items, problems: written.problems, notes, createdAt: Date.now() }
      const prior = store.getState().drafts[was.id]
      if (prior?.status === 'ready') put({ ...prior, status: 'superseded', draft: undefined }, false)
      put({ ...base, status: 'ready', progress: undefined, draft })
    } catch (e) {
      put({ ...base, status: 'failed', progress: undefined, error: e instanceof Error ? e.message : String(e) })
    }
  })()
  return { id }
}

/** The draft as it would be saved: every session checked by CrankHog's importers and dated, nothing saved. */
export async function prepareDraft(d: PlanDraft, now = Date.now()): Promise<PreparedImport> {
  const ftpW = (await currentFtp(now))?.ftpW ?? DEFAULT_FTP_W
  return prepareImport({ items: d.items, skipped: [], ...(d.brief.race ? { race: { name: d.brief.race.name, date: d.brief.race.date } } : {}) }, { start: d.span.start, raceDate: d.span.raceDate, ftpW, thresholds: await sessionThresholds(), now })
}

/** Saves the draft as the rider's plan, on the calendar: the race an A event, the plan counted back from it. */
export async function acceptDraft(id: string): Promise<DraftRecord> {
  const r = store.getState().drafts[id]
  if (!r?.draft || r.status !== 'ready') throw new Error('That draft can no longer be accepted.')
  const d = r.draft
  const prepared = await prepareDraft(d)
  const ftpW = (await currentFtp())?.ftpW ?? DEFAULT_FTP_W
  const { plan, made } = await saveImportUndoable(prepared.ready, {
    name: d.brief.name,
    start: d.span.start,
    ...(d.brief.race ? { event: { name: d.brief.race.name, date: d.brief.race.date, priority: 'A' as const } } : {}),
    ftpW,
  })
  const days = prepared.ready.flatMap((x) => (x.date ? [x.date] : []))
  const next: DraftRecord = { ...r, status: 'accepted', accepted: { planId: plan.id, sessions: prepared.ready.length, first: days[0], last: days.at(-1), made } }
  put(next)
  await persist()
  return next
}

/** Takes an accepted plan back off: the plan, its race if it was new, its new workouts. The draft can be revised or accepted again. */
export async function undoAccept(id: string): Promise<void> {
  const r = store.getState().drafts[id]
  if (r?.status !== 'accepted' || !r.accepted) throw new Error('There is nothing to undo.')
  await undoImport(r.accepted.made)
  put({ ...r, status: 'ready', accepted: undefined })
  await persist()
}

/** The draft once it's written (or has failed). */
export function settled(id: string): Promise<DraftRecord> {
  return new Promise((resolve) => {
    const check = () => {
      const r = store.getState().drafts[id]
      if (!r || r.status === 'drafting') return false
      resolve(r)
      return true
    }
    if (check()) return
    const off = store.subscribe(() => {
      if (check()) off()
    })
  })
}
