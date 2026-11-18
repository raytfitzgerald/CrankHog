// What the coach can ask to change, and what each change would do. The coach
// never changes anything itself: it proposes, the chat shows the proposal as
// a card, and only the rider's Apply makes it happen (with Undo after).
//
// The schema here is the one the model is given (as a tool, or described in
// its prompt) and the one CrankHog checks what comes back against. Its shape
// is loose on purpose (no ranges or lengths) so one odd value doesn't fail a
// whole proposal; resolveProposal checks every value and says what's wrong,
// and works out what the proposal would do to the calendar, from a snapshot
// of what is there now. The renderer applies it (src/renderer/src/ai/coach-actions.ts).
import { z } from 'zod'
import { isRealDay, type DayMark } from '../workout/plan'
import { addDays, type DateKey } from '../workout/schedule'
import type { ImportSport } from '../plan-import/model'
import type { SportGroup } from '../sport/group'
import { parsePaceField } from '../sport/session-input'
import { byRef } from './refs'

const day = z.string().describe('A day, YYYY-MM-DD')
const calendarRef = z.string().describe('The ref of a calendar entry in the data (starts with c)')
const markRef = z.string().describe('The ref of an event or day off in the data (starts with m)')
const sport = z.enum(['bike', 'run', 'swim', 'other']).describe('bike for any cycling; other for strength, yoga, squash, anything else')
const effort = z.enum(['easy', 'moderate', 'hard', 'max'])
const name = z.string().describe('Short and plain, at most 60 characters')
const notes = z.string().nullish().describe('How it should feel, fuelling or technique, in a sentence or two')
const why = z.string().nullish().describe('One short line on why, shown on the card under the change')
const steps = z
  .string()
  .describe('Bike: intervals.icu workout text. Run, swim, other: CrankHog session steps. One step a line, as in the chat prompt. Empty only for a session given by minutes and effort')

/** A session's content: steps, or for one without steps, how long and how hard. */
const content = {
  sport,
  name,
  steps,
  minutes: z.number().nullish().describe('Only for a session with no steps: how long it lasts'),
  effort: effort.nullish().describe('Only for a session with no steps: how hard'),
  notes,
}

export const CoachActionSchema = z.discriminatedUnion('type', [
  z
    .object({ type: z.literal('create_workout'), why, date: day.nullish().describe('Also plan it on this day; leave out to only save it'), sport, name, steps, notes })
    .describe("A new workout with steps, saved in the rider's library (a bike workout in Custom workouts, a run or swim in their sessions), and planned on `date` when given"),
  z
    .object({ type: z.literal('add_session'), why, date: day, sport, name, minutes: z.number().describe('How long it lasts'), effort, notes })
    .describe('A session with no steps planned on a day: "Squash, 1 h, hard", "Easy spin, 45 min"'),
  z
    .object({ type: z.literal('schedule_workout'), why, date: day, workout: z.string().describe("The name of a workout in the rider's library (workouts in the data, or a CrankHog built-in)") })
    .describe('A workout the rider already has, planned on a day'),
  z.object({ type: z.literal('move'), why, ref: calendarRef, to: day }).describe('A planned session moved to another day'),
  z.object({ type: z.literal('swap'), why, ref: calendarRef, with: calendarRef }).describe('Two planned sessions swap days'),
  z.object({ type: z.literal('replace'), why, ref: calendarRef, ...content }).describe('A planned session changed in place (same day): new steps, or a new length and effort, or a different sport'),
  z.object({ type: z.literal('remove'), why, ref: calendarRef }).describe('A planned session taken off the calendar'),
  z
    .object({ type: z.literal('days_off'), why, kind: z.enum(['rest', 'sick', 'travel']), from: day, to: day.describe('The last day, YYYY-MM-DD; the same as from for one day'), note: z.string().nullish() })
    .describe("Rest, sick or travel days. Plans on the calendar skip them: their sessions on those days move to the next free day"),
  z.object({ type: z.literal('add_event'), why, name, date: day, priority: z.enum(['A', 'B', 'C']).describe('A = the race the season builds to') }).describe('A race or event on the calendar'),
  z
    .object({ type: z.literal('change_event'), why, ref: markRef, date: day.nullish(), name: z.string().nullish(), priority: z.enum(['A', 'B', 'C']).nullish() })
    .describe('An event renamed, re-prioritised or moved to a new date. Plans built to it re-lay themselves to the new date'),
  z.object({ type: z.literal('remove_day_mark'), why, ref: markRef }).describe('An event or a day off taken off the calendar'),
  z
    .object({
      type: z.literal('log_activity'), why,
      date: day,
      sport,
      name,
      minutes: z.number(),
      distanceKm: z.number().nullish().describe('Kilometres; for a swim too (1.5 for 1500 m)'),
      effort,
      notes,
    })
    .describe('Something the rider did, logged in their history: "squash, 1 h, hard"'),
  z
    .object({
      type: z.literal('set_thresholds'), why,
      ftpW: z.number().nullish().describe('FTP in watts'),
      lthr: z.number().nullish().describe('Lactate threshold heart rate, bpm'),
      maxHr: z.number().nullish(),
      restHr: z.number().nullish(),
      weightKg: z.number().nullish(),
      runThresholdPace: z.string().nullish().describe('Threshold run pace per km, m:ss ("4:30")'),
      swimCss: z.string().nullish().describe('Swim CSS per 100 m, m:ss ("1:45")'),
    })
    .describe('FTP, heart-rate thresholds, weight, run threshold pace or swim CSS from today on. Leave out what stays'),
])
export type CoachAction = z.infer<typeof CoachActionSchema>

export const ProposalSchema = z.object({
  summary: z.string().describe('One line for the card: what this does and why ("Lighter week: Tuesday\'s VO2 becomes an easy spin, Thursday off")'),
  actions: z.array(CoachActionSchema).describe('Every change for the request, in order'),
})
export type Proposal = z.infer<typeof ProposalSchema>

/** The most actions one proposal may hold: a heavy week rewritten, not a season (that's a plan). */
export const MAX_ACTIONS = 60
/** The most days one days_off may cover. */
const MAX_DAYS_OFF = 62

const ALIASES: Record<string, string> = { ride: 'bike', cycling: 'bike', running: 'run', swimming: 'swim', strength: 'other', all_out: 'max', 'all out': 'max' }
const lower = (v: unknown) => (typeof v === 'string' ? (ALIASES[v.trim().toLowerCase()] ?? v.trim().toLowerCase()) : v)

/**
 * The model's tool input as a proposal, or why it isn't one. Sports, efforts
 * and kinds are read in any case ("Ride" is bike), and an action given as
 * the whole input (no summary, no list) is taken as a list of one.
 */
export function readProposal(raw: unknown): { ok: true; proposal: Proposal } | { ok: false; error: string } {
  const input = raw && typeof raw === 'object' && !Array.isArray(raw) && 'type' in raw && !('actions' in raw) ? { summary: '', actions: [raw] } : raw
  const tidied =
    input && typeof input === 'object' && Array.isArray((input as { actions?: unknown }).actions)
      ? {
          ...(input as object),
          summary: typeof (input as { summary?: unknown }).summary === 'string' ? (input as { summary: string }).summary : '',
          actions: (input as { actions: unknown[] }).actions.map((a) =>
            a && typeof a === 'object' ? Object.fromEntries(Object.entries(a).map(([k, v]) => [k, ['type', 'sport', 'effort', 'kind'].includes(k) ? lower(v) : k === 'priority' && typeof v === 'string' ? v.trim().toUpperCase() : v])) : a,
          ),
        }
      : input
  const parsed = ProposalSchema.safeParse(tidied)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { ok: false, error: `The coach's proposal didn't make sense (${first ? `${first.path.join('.') || 'it'}: ${first.message}` : 'unreadable'}).` }
  }
  if (parsed.data.actions.length === 0) return { ok: false, error: 'The coach proposed no changes.' }
  if (parsed.data.actions.length > MAX_ACTIONS) return { ok: false, error: `The coach proposed ${parsed.data.actions.length} changes; a proposal holds at most ${MAX_ACTIONS}.` }
  return { ok: true, proposal: parsed.data }
}

// ---- what a proposal would do -----------------------------------------------

/** A calendar entry, as resolving needs it. */
export interface WorldEntry {
  id: string
  date: DateKey
  name: string
  sport: SportGroup
  planId?: string
  /** Done (ridden or matched by an activity): it can't be moved or changed. */
  done?: boolean
  /** Imported from intervals.icu: the next import puts it back as it is there. */
  fromIntervals?: boolean
}

/** A workout in the library the coach may name: the rider's own, a session, or a CrankHog built-in. */
export interface WorldWorkout {
  id: string
  name: string
  /** ride for a bike workout. */
  sport: SportGroup
}

/** What is there now, read for resolving a proposal. */
export interface ActionWorld {
  today: DateKey
  entries: readonly WorldEntry[]
  marks: readonly DayMark[]
  workouts: readonly WorldWorkout[]
}

const GROUP: Record<ImportSport, SportGroup> = { bike: 'ride', run: 'run', swim: 'swim', other: 'other' }
export const groupOfSport = (s: ImportSport): SportGroup => GROUP[s]

/** A session the proposal makes: steps, or minutes and effort. */
export interface NewSession {
  sport: ImportSport
  name: string
  steps: string
  minutes?: number
  effort?: 'easy' | 'moderate' | 'hard' | 'max'
  notes?: string
}

export type Op = OpKind & {
  /** The coach's one line on why, for the card. */
  why?: string
}

type OpKind =
  | { op: 'create'; date?: DateKey; session: NewSession }
  | { op: 'add-session'; date: DateKey; session: NewSession & { minutes: number; effort: NonNullable<NewSession['effort']> } }
  | { op: 'schedule'; date: DateKey; workout: WorldWorkout }
  | { op: 'move'; entry: WorldEntry; to: DateKey }
  | { op: 'replace'; entry: WorldEntry; session: NewSession }
  | { op: 'remove'; entry: WorldEntry }
  | { op: 'days-off'; kind: 'rest' | 'sick' | 'travel'; dates: DateKey[]; note?: string }
  | { op: 'add-event'; name: string; date: DateKey; priority: 'A' | 'B' | 'C' }
  | { op: 'change-event'; mark: DayMark; patch: { date?: DateKey; name?: string; priority?: 'A' | 'B' | 'C' } }
  | { op: 'remove-mark'; mark: DayMark }
  | { op: 'log'; date: DateKey; session: NewSession & { minutes: number; effort: NonNullable<NewSession['effort']> }; distanceM: number | null }
  | { op: 'thresholds'; ftpW?: number; profile: { lthr?: number; maxHr?: number; restHr?: number; weightKg?: number; runThresholdPaceSPerKm?: number; swimCssSPer100m?: number } }

/** One day of the calendar before and after, for the card. */
export interface DayDiff {
  date: DateKey
  rows: { name: string; sport: SportGroup; change: 'same' | 'added' | 'removed' }[]
  /** A day off or event added or removed that day. */
  marks: { label: string; change: 'added' | 'removed' }[]
}

export interface ResolvedProposal {
  ops: Op[]
  /** What can't be done, and why: the card shows these and offers no Apply. */
  problems: string[]
  /** What can be done but the rider should know first. */
  warnings: string[]
  diff: DayDiff[]
}

/** Why a session imported from intervals.icu isn't rewritten here, and what moving or removing one means. */
export const FROM_INTERVALS = 'came from intervals.icu, and the next import puts it back as it is there. Change it on intervals.icu.'

const clean = (s: string | null | undefined) => {
  const t = s?.trim()
  return t ? t : undefined
}
const MARK_LABEL: Record<DayMark['kind'], string> = { event: 'Event', rest: 'Rest day', sick: 'Sick day', travel: 'Travel day' }

/** The days from `from` to `to`, both included. */
function daysFrom(from: DateKey, to: DateKey): DateKey[] {
  const out: DateKey[] = []
  for (let d = from; d <= to && out.length <= MAX_DAYS_OFF; d = addDays(d, 1)) out.push(d)
  return out
}

const numberIn = (v: number | null | undefined, lo: number, hi: number) => (typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi ? v : undefined)

/**
 * What the proposal would do, checked against what is there now: every ref
 * found, every day real, every number sensible. Each action that can't be
 * done is a problem, in words for the rider; the rest are ops, in order.
 */
export function resolveProposal(p: Proposal, world: ActionWorld): ResolvedProposal {
  const ops: Op[] = []
  const problems: string[] = []
  const warnings: string[] = []
  const say = (n: number, text: string) => problems.push(p.actions.length > 1 ? `Change ${n}: ${text}` : text)
  const warnIntervals = (e: WorldEntry) => {
    const w = `${e.name} ${FROM_INTERVALS}`
    if (e.fromIntervals && !warnings.includes(w)) warnings.push(w)
  }
  /** A day a session may be planned on: today or later. */
  const ahead = (n: number, d: DateKey | undefined): DateKey | undefined => {
    if (d && d < world.today) say(n, `${d} has passed, so nothing can be planned on it.`)
    return d && d >= world.today ? d : undefined
  }
  const entry = (n: number, ref: string): WorldEntry | undefined => {
    const e = byRef('c', world.entries, ref)
    if (!e) say(n, `There's no session ${ref} on the calendar.`)
    else if (e.done) say(n, `${e.name} on ${e.date} is done already.`)
    return e && !e.done ? e : undefined
  }
  const mark = (n: number, ref: string): DayMark | undefined => {
    const m = byRef('m', world.marks, ref)
    if (!m) say(n, `There's no event or day off ${ref} on the calendar.`)
    return m
  }
  const realDay = (n: number, d: string | null | undefined, what = 'day'): DateKey | undefined => {
    const t = d?.trim()
    if (isRealDay(t)) return t
    say(n, `"${d ?? ''}" isn't a ${what}.`)
    return undefined
  }
  const named = (n: number, s: string): string | undefined => {
    const t = s.trim().slice(0, 80)
    if (!t) say(n, 'It has no name.')
    return t || undefined
  }

  const one = (a: CoachAction, n: number): void => {
    switch (a.type) {
      case 'create_workout': {
        const date = a.date ? ahead(n, realDay(n, a.date)) : undefined
        const nm = named(n, a.name)
        if (!a.steps.trim()) say(n, `${a.name || 'The workout'} has no steps.`)
        else if (nm && (a.date ? date : true)) ops.push({ op: 'create', ...(date ? { date } : {}), session: { sport: a.sport, name: nm, steps: a.steps.trim(), ...(clean(a.notes) ? { notes: clean(a.notes) } : {}) } })
        return
      }
      case 'add_session': {
        const date = ahead(n, realDay(n, a.date))
        const nm = named(n, a.name)
        const minutes = numberIn(a.minutes, 1, 24 * 60)
        if (minutes === undefined) say(n, `${a.minutes} minutes isn't a session's length.`)
        if (date && nm && minutes !== undefined)
          ops.push({ op: 'add-session', date, session: { sport: a.sport, name: nm, steps: '', minutes: Math.round(minutes), effort: a.effort, ...(clean(a.notes) ? { notes: clean(a.notes) } : {}) } })
        return
      }
      case 'schedule_workout': {
        const date = ahead(n, realDay(n, a.date))
        const want = a.workout.trim().toLowerCase()
        const w = world.workouts.find((x) => x.name.trim().toLowerCase() === want)
        if (!w) say(n, `There's no workout called "${a.workout}" in your library.`)
        if (date && w) ops.push({ op: 'schedule', date, workout: w })
        return
      }
      case 'move': {
        const e = entry(n, a.ref)
        const to = ahead(n, realDay(n, a.to))
        if (e) warnIntervals(e)
        if (e && to) ops.push({ op: 'move', entry: e, to })
        return
      }
      case 'swap': {
        const e1 = entry(n, a.ref)
        const e2 = entry(n, a.with)
        const past = [e1, e2].find((e) => e && e.date < world.today)
        if (e1 && e2 && e1.id === e2.id) say(n, 'It swaps a session with itself.')
        else if (past) say(n, `${past.date} has passed, so nothing can be planned on it.`)
        else if (e1 && e2) {
          warnIntervals(e1)
          warnIntervals(e2)
          ops.push({ op: 'move', entry: e1, to: e2.date }, { op: 'move', entry: e2, to: e1.date })
        }
        return
      }
      case 'replace': {
        const found = entry(n, a.ref)
        if (found?.fromIntervals) say(n, `${found.name} ${FROM_INTERVALS}`)
        else if (found && found.date < world.today) say(n, `${found.date} has passed, so ${found.name} can't be changed.`)
        const e = found && !found.fromIntervals && found.date >= world.today ? found : undefined
        const nm = named(n, a.name)
        const minutes = numberIn(a.minutes, 1, 24 * 60)
        const hasSteps = a.steps.trim() !== ''
        if (!hasSteps && (minutes === undefined || !a.effort)) say(n, `${a.name || 'The new session'} needs steps, or minutes and an effort.`)
        else if (e && nm)
          ops.push({
            op: 'replace',
            entry: e,
            session: { sport: a.sport, name: nm, steps: a.steps.trim(), ...(!hasSteps ? { minutes: Math.round(minutes!), effort: a.effort! } : {}), ...(clean(a.notes) ? { notes: clean(a.notes) } : {}) },
          })
        return
      }
      case 'remove': {
        const e = entry(n, a.ref)
        if (e) warnIntervals(e)
        if (e) ops.push({ op: 'remove', entry: e })
        return
      }
      case 'days_off': {
        const from = realDay(n, a.from)
        const to = realDay(n, a.to)
        if (!from || !to) return
        if (to < from) return void say(n, `The days off end (${to}) before they start (${from}).`)
        const dates = daysFrom(from, to)
        if (dates.length > MAX_DAYS_OFF) return void say(n, `That's more than ${MAX_DAYS_OFF} days off at once.`)
        // a day already marked the same way stays as it is
        const fresh = dates.filter((d) => !world.marks.some((m) => m.date === d && m.kind === a.kind))
        if (fresh.length > 0) ops.push({ op: 'days-off', kind: a.kind, dates: fresh, ...(clean(a.note) ? { note: clean(a.note) } : {}) })
        return
      }
      case 'add_event': {
        const date = realDay(n, a.date)
        const nm = named(n, a.name)
        if (date && nm) ops.push({ op: 'add-event', name: nm, date, priority: a.priority })
        return
      }
      case 'change_event': {
        const m = mark(n, a.ref)
        if (m && m.kind !== 'event') return void say(n, `${a.ref} is a ${MARK_LABEL[m.kind].toLowerCase()}, not an event.`)
        const date = a.date ? realDay(n, a.date) : undefined
        if (a.date && !date) return
        const patch = { ...(date && date !== m?.date ? { date } : {}), ...(clean(a.name) && clean(a.name) !== m?.name ? { name: clean(a.name)!.slice(0, 80) } : {}), ...(a.priority && a.priority !== m?.priority ? { priority: a.priority } : {}) }
        if (m && Object.keys(patch).length === 0) return void say(n, `It doesn't change ${m.name ?? 'the event'}.`)
        if (m) ops.push({ op: 'change-event', mark: m, patch })
        return
      }
      case 'remove_day_mark': {
        const m = mark(n, a.ref)
        if (m) ops.push({ op: 'remove-mark', mark: m })
        return
      }
      case 'log_activity': {
        const date = realDay(n, a.date)
        const nm = named(n, a.name)
        const minutes = numberIn(a.minutes, 1, 24 * 60)
        if (minutes === undefined) say(n, `${a.minutes} minutes isn't an activity's length.`)
        if (date && date > world.today) say(n, `${date} hasn't happened yet: log it on the day, or plan it instead.`)
        const km = numberIn(a.distanceKm, 0.01, 1000)
        if (date && date <= world.today && nm && minutes !== undefined)
          ops.push({ op: 'log', date, session: { sport: a.sport, name: nm, steps: '', minutes: Math.round(minutes), effort: a.effort, ...(clean(a.notes) ? { notes: clean(a.notes) } : {}) }, distanceM: km !== undefined ? Math.round(km * 1000) : null })
        return
      }
      case 'set_thresholds': {
        const before = problems.length
        const out: Extract<Op, { op: 'thresholds' }> = { op: 'thresholds', profile: {} }
        const take = (v: number | null | undefined, lo: number, hi: number, what: string, set: (x: number) => void) => {
          if (v === null || v === undefined) return
          const ok = numberIn(v, lo, hi)
          if (ok === undefined) say(n, `${v} isn't a sensible ${what}.`)
          else set(Math.round(ok * 10) / 10)
        }
        take(a.ftpW, 50, 600, 'FTP in watts', (x) => (out.ftpW = Math.round(x)))
        take(a.lthr, 80, 220, 'threshold heart rate', (x) => (out.profile.lthr = Math.round(x)))
        take(a.maxHr, 100, 240, 'maximum heart rate', (x) => (out.profile.maxHr = Math.round(x)))
        take(a.restHr, 25, 120, 'resting heart rate', (x) => (out.profile.restHr = Math.round(x)))
        take(a.weightKg, 30, 250, 'weight in kg', (x) => (out.profile.weightKg = x))
        const pace = (v: string | null | undefined, lo: number, hi: number, what: string, set: (x: number) => void) => {
          if (!v?.trim()) return
          const s = parsePaceField(v.replace(/\s*\/.*$/, ''))
          if (s === null || s < lo || s > hi) say(n, `"${v}" isn't a ${what} (m:ss).`)
          else set(s)
        }
        pace(a.runThresholdPace, 120, 600, 'run pace per km', (x) => (out.profile.runThresholdPaceSPerKm = x))
        pace(a.swimCss, 45, 300, 'swim pace per 100 m', (x) => (out.profile.swimCssSPer100m = x))
        if (out.ftpW !== undefined || Object.keys(out.profile).length > 0) ops.push(out)
        else if (problems.length === before) say(n, 'It changes no threshold.')
        return
      }
    }
  }
  p.actions.forEach((a, i) => {
    const start = ops.length
    one(a, i + 1)
    const reason = clean(a.why)?.slice(0, 200)
    if (reason) for (let k = start; k < ops.length; k++) ops[k] = { ...ops[k]!, why: reason }
  })
  return { ops, problems, warnings, diff: problems.length === 0 ? calendarDiff(ops, world) : [] }
}

/** Each day the ops change, before and after: sessions added, moved in or out, removed; days off and events. */
export function calendarDiff(ops: readonly Op[], world: ActionWorld): DayDiff[] {
  const days = new Map<DateKey, DayDiff>()
  const at = (date: DateKey) => {
    let d = days.get(date)
    if (!d) {
      d = { date, rows: world.entries.filter((e) => e.date === date).map((e) => ({ name: e.name, sport: e.sport, change: 'same' as const })), marks: [] }
      days.set(date, d)
    }
    return d
  }
  const drop = (e: WorldEntry) => {
    const row = at(e.date).rows.find((r) => r.change === 'same' && r.name === e.name && r.sport === e.sport)
    if (row) row.change = 'removed'
  }
  for (const o of ops) {
    switch (o.op) {
      case 'create':
        if (o.date) at(o.date).rows.push({ name: o.session.name, sport: GROUP[o.session.sport], change: 'added' })
        break
      case 'add-session':
        at(o.date).rows.push({ name: o.session.name, sport: GROUP[o.session.sport], change: 'added' })
        break
      case 'schedule':
        at(o.date).rows.push({ name: o.workout.name, sport: o.workout.sport, change: 'added' })
        break
      case 'move':
        if (o.to === o.entry.date) break
        drop(o.entry)
        at(o.to).rows.push({ name: o.entry.name, sport: o.entry.sport, change: 'added' })
        break
      case 'replace':
        drop(o.entry)
        at(o.entry.date).rows.push({ name: o.session.name, sport: GROUP[o.session.sport], change: 'added' })
        break
      case 'remove':
        drop(o.entry)
        break
      case 'days-off':
        for (const d of o.dates) at(d).marks.push({ label: MARK_LABEL[o.kind], change: 'added' })
        break
      case 'add-event':
        at(o.date).marks.push({ label: o.name, change: 'added' })
        break
      case 'change-event':
        if (o.patch.date) {
          at(o.mark.date).marks.push({ label: o.mark.name ?? 'Event', change: 'removed' })
          at(o.patch.date).marks.push({ label: o.patch.name ?? o.mark.name ?? 'Event', change: 'added' })
        }
        break
      case 'remove-mark':
        at(o.mark.date).marks.push({ label: o.mark.kind === 'event' ? (o.mark.name ?? 'Event') : MARK_LABEL[o.mark.kind], change: 'removed' })
        break
      case 'log':
      case 'thresholds':
        break
    }
  }
  return [...days.values()].filter((d) => d.marks.length > 0 || d.rows.some((r) => r.change !== 'same')).sort((a, b) => a.date.localeCompare(b.date))
}

const SPORT_WORD: Record<ImportSport, string> = { bike: 'ride', run: 'run', swim: 'swim', other: 'session' }
const length = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}` : `${m} min`)
const paceText = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`

/** One line per op, for the card: "Move Threshold 2x20 from Tue 18 Nov to Thu 20 Nov". `day` formats a day. */
export function describeOp(o: Op, day: (d: DateKey) => string): string {
  switch (o.op) {
    case 'create':
      return `Make the ${SPORT_WORD[o.session.sport]} ${o.session.name} and keep it in your library${o.date ? `, on ${day(o.date)}` : ''}`
    case 'add-session':
      return `Plan ${o.session.name}, ${length(o.session.minutes)} ${o.session.effort}, on ${day(o.date)}`
    case 'schedule':
      return `Plan ${o.workout.name} on ${day(o.date)}`
    case 'move':
      return `Move ${o.entry.name} from ${day(o.entry.date)} to ${day(o.to)}`
    case 'replace':
      return `Change ${o.entry.name} on ${day(o.entry.date)} to ${o.session.name}${o.session.minutes ? `, ${length(o.session.minutes)} ${o.session.effort}` : ''}`
    case 'remove':
      return `Take ${o.entry.name} off ${day(o.entry.date)}`
    case 'days-off': {
      const what = MARK_LABEL[o.kind].toLowerCase()
      const first = o.dates[0]!
      const last = o.dates.at(-1)!
      return o.dates.length === 1 ? `Mark ${day(first)} as a ${what}` : `Mark ${o.dates.length} days, ${day(first)} to ${day(last)}, as ${what}s`
    }
    case 'add-event':
      return `Add ${o.name} (${o.priority} event) on ${day(o.date)}`
    case 'change-event': {
      const parts = [o.patch.date ? `move it to ${day(o.patch.date)}` : '', o.patch.name ? `rename it ${o.patch.name}` : '', o.patch.priority ? `make it an ${o.patch.priority} event` : ''].filter(Boolean)
      return `${o.mark.name ?? 'Event'} on ${day(o.mark.date)}: ${parts.join(', ')}`
    }
    case 'remove-mark':
      return o.mark.kind === 'event' ? `Take ${o.mark.name ?? 'the event'} off ${day(o.mark.date)}` : `Clear the ${MARK_LABEL[o.mark.kind].toLowerCase()} on ${day(o.mark.date)}`
    case 'log':
      return `Log ${o.session.name}, ${length(o.session.minutes)} ${o.session.effort}${o.distanceM ? `, ${o.session.sport === 'swim' ? `${o.distanceM} m` : `${Math.round(o.distanceM / 100) / 10} km`}` : ''}, on ${day(o.date)}`
    case 'thresholds': {
      const p = o.profile
      const parts = [
        o.ftpW !== undefined ? `FTP ${o.ftpW} W` : '',
        p.lthr !== undefined ? `threshold heart rate ${p.lthr} bpm` : '',
        p.maxHr !== undefined ? `maximum heart rate ${p.maxHr} bpm` : '',
        p.restHr !== undefined ? `resting heart rate ${p.restHr} bpm` : '',
        p.weightKg !== undefined ? `weight ${p.weightKg} kg` : '',
        p.runThresholdPaceSPerKm !== undefined ? `run threshold pace ${paceText(p.runThresholdPaceSPerKm)}/km` : '',
        p.swimCssSPer100m !== undefined ? `swim CSS ${paceText(p.swimCssSPer100m)}/100m` : '',
      ].filter(Boolean)
      return `Set ${parts.join(', ')} from today`
    }
  }
}

/** What a proposal does to plans that the diff can't show: re-lays after days off or a race moving. */
export function relayNotes(ops: readonly Op[], world: ActionWorld): string[] {
  const notes: string[] = []
  const planDays = new Set(world.entries.filter((e) => e.planId && !e.done).map((e) => e.date))
  const off = ops.flatMap((o) => (o.op === 'days-off' ? o.dates : []))
  const hit = off.filter((d) => planDays.has(d)).length
  if (hit > 0) notes.push(`Plan sessions on ${hit === 1 ? 'that day move' : `${hit} of those days move`} to the next free training day.`)
  if (ops.some((o) => o.op === 'change-event' && o.patch.date)) notes.push('Plans built to this event re-lay to its new date.')
  return notes
}
