// A plan the coach drafts in the chat, before the rider accepts it. It is
// written in two steps, so a 36-week plan never has to come back in one
// answer: an outline (each week's phase, focus, hours per sport and key
// sessions), then the sessions a few weeks at a time, each block from the
// brief and the whole outline. Sessions come back in the plan-document
// import's shape (ImportItem: week, weekday, sport, name, steps), so the
// import's checks, dating and saving (src/renderer/src/plan/doc-import.ts)
// make the plan once it's accepted.
//
// A revision changes the outline as the rider asks, and rewrites only the
// weeks whose outline changed (or all of them, when the brief changed what
// every week looks like).
import type { PlanOutlineOutput, PlanWeeksOutput } from '../ai/schemas'
import { fromAiOutput, WEEKDAY_SHORT, type ImportItem } from '../plan-import/model'
import { weekdayOf } from '../workout/plan'
import { addDays, type DateKey } from '../workout/schedule'
import { weekStart, type PlanBrief, type PlanSpan } from './brief'

export type OutlinePhase = 'base' | 'build' | 'peak' | 'taper' | 'recovery'
export const OUTLINE_PHASES: readonly OutlinePhase[] = ['base', 'build', 'peak', 'taper', 'recovery']

export interface WeekHours {
  swim: number
  bike: number
  run: number
  other: number
}

export interface OutlineWeek {
  week: number
  phase: OutlinePhase
  focus: string
  hours: WeekHours
  keySessions: string[]
}

export interface PlanOutline {
  notes: string
  weeks: OutlineWeek[]
}

/** A drafted plan, as the chat's plan card shows it. Nothing of it is saved in the rider's plans until they accept it. */
export interface PlanDraft {
  id: string
  /** 1 for the first draft, one more for each revision. */
  version: number
  brief: PlanBrief
  span: PlanSpan
  outline: PlanOutline
  /** Every session, with its plan week and weekday. */
  items: ImportItem[]
  /** Blocks of weeks the AI couldn't write: those weeks have no sessions. */
  problems: { where: string; reason: string }[]
  /** What CrankHog assumed about the brief ("covers its last 52 weeks"). */
  notes: string[]
  createdAt: number
}

/** Weeks written in one call: a few weeks of a full-distance triathlon plan is 30-50 sessions, steps and all. */
export const BLOCK_WEEKS = 4

const phaseOf = (s: string): OutlinePhase => {
  const t = s.trim().toLowerCase()
  if ((OUTLINE_PHASES as readonly string[]).includes(t)) return t as OutlinePhase
  if (/recover|rest|deload/.test(t)) return 'recovery'
  if (/taper|race/.test(t)) return 'taper'
  if (/peak|special|sharpen/.test(t)) return 'peak'
  if (/build/.test(t)) return 'build'
  return 'base'
}
const hoursOf = (h: number) => (Number.isFinite(h) ? Math.min(Math.max(Math.round(h * 4) / 4, 0), 30) : 0)

/**
 * The AI's outline, one entry per plan week from 1 to `weeks`. A week it
 * left out is copied from the week before (or after), so the plan never has
 * a hole; null when it gave fewer than half the weeks, which is no outline.
 */
export function fromOutline(out: PlanOutlineOutput, weeks: number): PlanOutline | null {
  const given = new Map<number, OutlineWeek>()
  for (const w of out.weeks) {
    const n = Math.round(w.week)
    if (n < 1 || n > weeks || given.has(n)) continue
    given.set(n, {
      week: n,
      phase: phaseOf(w.phase),
      focus: w.focus.trim().slice(0, 200),
      hours: { swim: hoursOf(w.hours.swim), bike: hoursOf(w.hours.bike), run: hoursOf(w.hours.run), other: hoursOf(w.hours.other) },
      keySessions: w.keySessions.map((k) => k.trim().slice(0, 80)).filter(Boolean).slice(0, 5),
    })
  }
  if (given.size * 2 < weeks) return null
  const list: OutlineWeek[] = []
  for (let n = 1; n <= weeks; n++) {
    const near = given.get(n) ?? list.at(-1) ?? [...given.values()].sort((a, b) => a.week - b.week)[0]!
    list.push({ ...near, week: n })
  }
  return { notes: out.notes.trim().slice(0, 600), weeks: list }
}

/** The weeks whose outline changed: phase, focus, hours or key sessions. */
export function changedWeeks(before: PlanOutline, after: PlanOutline): number[] {
  const key = (w: OutlineWeek | undefined) => (w ? JSON.stringify([w.phase, w.focus, w.hours, w.keySessions]) : '')
  const old = new Map(before.weeks.map((w) => [w.week, w]))
  return after.weeks.filter((w) => key(w) !== key(old.get(w.week))).map((w) => w.week)
}

/** Weeks in blocks of at most `size`, each a run of weeks in a row: [[1,4],[5,8],[12,12]]. */
export function blocksOf(weeks: readonly number[], size = BLOCK_WEEKS): [number, number][] {
  const sorted = [...new Set(weeks)].sort((a, b) => a - b)
  const out: [number, number][] = []
  for (const w of sorted) {
    const last = out.at(-1)
    if (last && w === last[1] + 1 && w - last[0] < size) last[1] = w
    else out.push([w, w])
  }
  return out
}

/**
 * One block's AI answer as sessions: each checked as an imported session is
 * (a sport CrankHog doesn't have is other; a weekday out of range is dropped
 * and the session spread over its week), and only the block's own weeks kept.
 */
export function fromWeeks(out: PlanWeeksOutput, block: readonly [number, number]): ImportItem[] {
  const doc = fromAiOutput({ planName: null, raceName: null, raceDate: null, startDate: null, countdown: false, items: out.items.map((i) => ({ ...i, date: null })), skipped: [] })
  return doc.items.filter((i) => i.week !== undefined && i.week >= block[0] && i.week <= block[1] && i.name !== '')
}

/** The draft's sessions with the block's weeks swapped for `fresh`, in week and weekday order. */
export function replaceWeeks(items: readonly ImportItem[], block: readonly [number, number], fresh: readonly ImportItem[]): ImportItem[] {
  const kept = items.filter((i) => i.week === undefined || i.week < block[0] || i.week > block[1])
  return [...kept, ...fresh].sort((a, b) => (a.week ?? 0) - (b.week ?? 0) || (a.weekday ?? 0) - (b.weekday ?? 0))
}

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const

/** The brief as the planner reads it: plain lines, with the dates worked out. */
function briefLines(today: DateKey, brief: PlanBrief, span: PlanSpan): string[] {
  const race = brief.race ? `${brief.race.name}, ${brief.race.kind}, on ${brief.race.date} (${WEEKDAYS[weekdayOf(brief.race.date)]}), in week ${span.weeks}` : 'none'
  return [
    `Today is ${today}.`,
    `Plan: ${brief.name}. ${span.weeks} weeks, week 1 starting Monday ${span.start}, week ${span.weeks} starting Monday ${weekStart(span, span.weeks)}.`,
    `Race: ${race}.`,
    `Sports: ${brief.sports.join(', ')}.`,
    `Hours a week: about ${brief.hoursPerWeek.start} at the start, ${brief.hoursPerWeek.peak} in the biggest week.`,
    `Training days: ${brief.days.map((d) => `${WEEKDAYS[d.weekday]} (weekday ${d.weekday}) up to ${d.maxMinutes} min${d.note ? `, ${d.note}` : ''}`).join('; ')}. No other days.`,
    ...(brief.longRideDay !== null && brief.longRideDay !== undefined ? [`Long ride: ${WEEKDAYS[brief.longRideDay]}.`] : []),
    ...(brief.longRunDay !== null && brief.longRunDay !== undefined ? [`Long run: ${WEEKDAYS[brief.longRunDay]}.`] : []),
    ...((brief.away ?? []).length > 0 ? [`Away: ${brief.away!.map((a) => `${a.from} to ${a.to}${a.note ? ` (${a.note})` : ''}`).join('; ')}.`] : []),
    `The athlete: ${brief.athlete}`,
  ]
}

/** What the outline is written from: the brief, the rider's numbers, and for a revision the outline now and what to change. */
export function outlineInput(o: { today: DateKey; brief: PlanBrief; span: PlanSpan; athlete: string; current?: PlanOutline; feedback?: string }): string {
  const lines = [...briefLines(o.today, o.brief, o.span), `The rider's numbers from CrankHog (JSON): ${o.athlete}`]
  if (o.current && o.feedback) {
    lines.push(
      '',
      `The outline now (JSON): ${JSON.stringify(o.current)}`,
      `The rider's feedback: ${o.feedback}`,
      `Return the whole outline, all ${o.span.weeks} weeks, changed as the feedback asks; keep every week it doesn't touch exactly as it is.`,
    )
  } else lines.push('', `Outline all ${o.span.weeks} weeks.`)
  return lines.join('\n')
}

/** A session in one line, for the planner and the chat: "Tue bike Sweet spot 3x12". */
export const sessionLine = (i: ImportItem): string => `${i.weekday !== undefined ? WEEKDAY_SHORT[i.weekday] : '?'} ${i.sport} ${i.name}`

/** What one block of weeks is written from: the brief, the whole outline, the week before it, and for a revision these weeks now and what to change. */
export function weeksInput(o: {
  today: DateKey
  brief: PlanBrief
  span: PlanSpan
  athlete: string
  outline: PlanOutline
  block: readonly [number, number]
  /** The week before the block, so one block follows on from the last. */
  before: readonly ImportItem[]
  current?: readonly ImportItem[]
  feedback?: string
}): string {
  const [a, b] = o.block
  const weeks = a === b ? `week ${a}` : `weeks ${a} to ${b}`
  const dates = Array.from({ length: b - a + 1 }, (_, k) => `week ${a + k} starts Monday ${weekStart(o.span, a + k)}`).join('; ')
  const lines = [
    ...briefLines(o.today, o.brief, o.span),
    `The rider's numbers from CrankHog (JSON): ${o.athlete}`,
    '',
    `The plan's approach: ${o.outline.notes}`,
    `The outline (JSON, every week): ${JSON.stringify(o.outline.weeks.map((w) => ({ week: w.week, phase: w.phase, focus: w.focus, hours: w.hours, key: w.keySessions })))}`,
  ]
  if (o.before.length > 0) lines.push(`Week ${a - 1}, before these, has: ${o.before.map(sessionLine).join('; ')}.`)
  if (o.current && o.feedback) {
    lines.push('', `The sessions in ${weeks} now (JSON): ${JSON.stringify(o.current.map((i) => ({ week: i.week, weekday: i.weekday, sport: i.sport, name: i.name, steps: i.steps, minutes: i.minutes ?? null, effort: i.effort ?? null })))}`)
    lines.push(`The rider's feedback on the plan: ${o.feedback}`, `Rewrite ${weeks} as the feedback and the outline ask, keeping what they don't change.`)
  }
  lines.push('', `Write every session of ${weeks} (${dates}), and only those.${a === 1 ? ` Nothing before today (${o.today}).` : ''}`)
  return lines.join('\n')
}

/** The day a draft session falls on. */
export const itemDay = (span: Pick<PlanSpan, 'start'>, i: Pick<ImportItem, 'week' | 'weekday'>): DateKey | undefined =>
  i.week !== undefined ? addDays(span.start, 7 * (i.week - 1) + (i.weekday ?? 0)) : undefined

/** Sessions sent back at once to be written again. */
export const MAX_REPAIR = 40

/**
 * Sessions CrankHog couldn't read, sent back to be written again: the same
 * day, sport, name and purpose, with steps it can read. The brief comes too,
 * so the rewrite still fits the rider's days and minutes.
 */
export function repairInput(o: { today: DateKey; brief: PlanBrief; span: PlanSpan; failed: readonly { item: ImportItem; reason: string }[] }): string {
  return [
    ...briefLines(o.today, o.brief, o.span),
    '',
    "These sessions from the rider's plan couldn't be read: CrankHog's reason is with each (a line number counts from the first step). Write each one again, with the same week, weekday, sport, name and purpose and the same length, and steps CrankHog can read. Only these sessions.",
    JSON.stringify(o.failed.slice(0, MAX_REPAIR).map((f) => ({ week: f.item.week, weekday: f.item.weekday, sport: f.item.sport, name: f.item.name, steps: f.item.steps, minutes: f.item.minutes ?? null, effort: f.item.effort ?? null, reason: f.reason }))),
  ].join('\n')
}

/** Characters of the draft the coach chat reads: the outline in full, sessions for as many weeks as fit. */
const DRAFT_BUDGET = 12_000

/**
 * The draft as the coach chat reads it: the brief, the outline, and each
 * week's sessions in a line while they fit. The coach revises from this.
 */
export function draftFacts(d: PlanDraft, status: string, budget = DRAFT_BUDGET) {
  const byWeek = new Map<number, ImportItem[]>()
  for (const i of d.items) if (i.week !== undefined) byWeek.set(i.week, [...(byWeek.get(i.week) ?? []), i])
  let used = 0
  const weeks = d.outline.weeks.map((w) => {
    const sessions = (byWeek.get(w.week) ?? []).map(sessionLine).join('; ')
    used += sessions.length + 160
    return { week: w.week, from: weekStart(d.span, w.week), phase: w.phase, focus: w.focus, hours: w.hours, ...(used <= budget ? { sessions } : { sessionCount: byWeek.get(w.week)?.length ?? 0 }) }
  })
  return {
    status,
    version: d.version,
    name: d.brief.name,
    race: d.brief.race ? { name: d.brief.race.name, date: d.brief.race.date } : undefined,
    firstMonday: d.span.start,
    weeks: d.span.weeks,
    brief: d.brief,
    approach: d.outline.notes,
    outline: weeks,
    missingWeeks: d.problems.length > 0 ? d.problems.map((p) => p.where) : undefined,
  }
}
