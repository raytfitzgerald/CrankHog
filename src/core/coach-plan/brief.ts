// What the coach learns before it drafts a plan: the race, the days and hours
// the rider has, their long days, and their specifics in their own words.
// The coach asks for these in the chat and hands them over with draft_plan;
// CrankHog checks them here and works out the plan's span (its first Monday
// and how many weeks) before anything is written.
import { z } from 'zod'
import { mondayOf } from '../plan-import/model'
import { isRealDay, nextMonday } from '../workout/plan'
import { addDays, dateKeyToMs, type DateKey } from '../workout/schedule'

const day = z.string().describe('A day, YYYY-MM-DD')
const sport = z.enum(['bike', 'run', 'swim', 'other'])
const weekday = z.number().describe('0 = Monday … 6 = Sunday')

export const PlanBriefSchema = z.object({
  name: z.string().describe('The plan\'s name, short and plain: "Ironman Barcelona 2027"'),
  race: z
    .object({
      name: z.string(),
      date: day,
      kind: z.string().describe('What the race is, with its distances: "full-distance triathlon (3.8 km swim, 180 km bike, 42.2 km run)", "marathon", "gran fondo, 160 km, 2,500 m of climbing"'),
    })
    .nullish()
    .describe('The race the plan builds to; leave out for a plan without one'),
  startDate: day.nullish().describe('The day the plan starts; leave out for next Monday'),
  weeks: z.number().nullish().describe('How many weeks, for a plan without a race only'),
  sports: z.array(sport).describe('The sports in the plan; other is strength, mobility, yoga'),
  hoursPerWeek: z.object({ start: z.number().describe('Hours a week the plan starts at'), peak: z.number().describe('Hours in its biggest week') }),
  days: z
    .array(z.object({ weekday, maxMinutes: z.number().describe('The most training that day, in minutes'), note: z.string().nullish().describe('"pool before 7 am only", "commute ride"') }))
    .describe('Every weekday the rider can train, with how long'),
  longRideDay: weekday.nullish(),
  longRunDay: weekday.nullish(),
  athlete: z
    .string()
    .describe("The rider's specifics in a few sentences, from what they told you and the data: current fitness and recent volume per sport, swim ability, pool access and length, injuries, other races, strength work, preferences"),
  away: z
    .array(z.object({ from: day, to: day, note: z.string().nullish().describe('"no training", "hotel gym and running only"') }))
    .nullish()
    .describe("Dates the rider can't train, or can only train lightly"),
})
export type PlanBrief = z.infer<typeof PlanBriefSchema>

export const PlanRevisionSchema = z.object({
  feedback: z.string().describe('What the rider wants changed, plainly: "less swimming, about 2 h a week"'),
  brief: PlanBriefSchema.nullish().describe("The whole brief again, updated, when the change is to the rider's specifics (days, hours, long days, race date, time away); leave out otherwise"),
  weeks: z.array(z.number()).nullish().describe('The plan weeks the change is about, when it is about some weeks only'),
})
export type PlanRevision = z.infer<typeof PlanRevisionSchema>

/** The longest plan the coach drafts. */
export const MAX_PLAN_WEEKS = 52

export interface PlanSpan {
  /** The Monday of week 1. */
  start: DateKey
  weeks: number
  raceDate?: DateKey
}

const SPORT_ALIASES: Record<string, string> = { ride: 'bike', cycling: 'bike', running: 'run', swimming: 'swim', strength: 'other', mobility: 'other', yoga: 'other' }

/** The tool's input with sports read in any case ("Cycling" is bike), so a near miss isn't a failure. */
function tidy(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw
  const r = raw as Record<string, unknown>
  return Array.isArray(r.sports) ? { ...r, sports: [...new Set(r.sports.map((s) => (typeof s === 'string' ? (SPORT_ALIASES[s.trim().toLowerCase()] ?? s.trim().toLowerCase()) : s)))] } : r
}

export type BriefCheck = { ok: true; brief: PlanBrief; span: PlanSpan; notes: string[] } | { ok: false; error: string }

/**
 * The brief, checked, and the plan's span: from its start (or next Monday)
 * to the race's week, or for its number of weeks. A plan to a race more than
 * a year off covers its last 52 weeks. `notes` says what was assumed.
 */
export function checkBrief(raw: unknown, today: DateKey): BriefCheck {
  const parsed = PlanBriefSchema.safeParse(tidy(raw))
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { ok: false, error: `The coach's plan brief didn't make sense (${first ? `${first.path.join('.') || 'it'}: ${first.message}` : 'unreadable'}).` }
  }
  const b = parsed.data
  const notes: string[] = []
  if (b.sports.length === 0) return { ok: false, error: 'The plan brief names no sport.' }
  const days = [...new Map(b.days.filter((d) => Number.isInteger(d.weekday) && d.weekday >= 0 && d.weekday <= 6 && d.maxMinutes > 0).map((d) => [d.weekday, { ...d, maxMinutes: Math.min(Math.round(d.maxMinutes), 600) }])).values()].sort(
    (a, c) => a.weekday - c.weekday,
  )
  if (days.length === 0) return { ok: false, error: 'The plan brief gives no day to train on.' }
  const hours = { start: clampHours(b.hoursPerWeek.start), peak: clampHours(Math.max(b.hoursPerWeek.peak, b.hoursPerWeek.start)) }
  if (hours.start === 0) return { ok: false, error: 'The plan brief gives no hours a week.' }
  const race = b.race && isRealDay(b.race.date.trim()) ? { ...b.race, date: b.race.date.trim(), name: b.race.name.trim() || 'Race' } : undefined
  if (b.race && !race) return { ok: false, error: `The race date "${b.race.date}" isn't a day.` }
  if (race && race.date <= today) return { ok: false, error: `The race date ${race.date} isn't after today.` }
  const asked = b.startDate?.trim()
  if (asked && !isRealDay(asked)) return { ok: false, error: `The start date "${asked}" isn't a day.` }
  let start = asked ? mondayOf(asked) : nextMonday(dateKeyToMs(today) + 43_200_000)
  if (start < mondayOf(today)) start = mondayOf(today)
  let weeks: number
  if (race) {
    const raceMonday = mondayOf(race.date)
    if (start > raceMonday) start = raceMonday
    weeks = Math.round((dateKeyToMs(raceMonday) - dateKeyToMs(start)) / (7 * 86_400_000)) + 1
    if (weeks > MAX_PLAN_WEEKS) {
      start = addDays(raceMonday, -7 * (MAX_PLAN_WEEKS - 1))
      weeks = MAX_PLAN_WEEKS
      notes.push(`The race is more than ${MAX_PLAN_WEEKS} weeks away, so the plan covers its last ${MAX_PLAN_WEEKS} weeks.`)
    }
  } else {
    const n = typeof b.weeks === 'number' && Number.isFinite(b.weeks) ? Math.round(b.weeks) : 0
    if (n < 1) return { ok: false, error: 'A plan without a race needs a number of weeks.' }
    weeks = Math.min(n, MAX_PLAN_WEEKS)
  }
  const away = (b.away ?? []).filter((a) => isRealDay(a.from.trim()) && isRealDay(a.to.trim()) && a.to.trim() >= a.from.trim()).map((a) => ({ ...a, from: a.from.trim(), to: a.to.trim() }))
  const weekdayOk = (d: number | null | undefined) => (typeof d === 'number' && days.some((x) => x.weekday === d) ? d : null)
  const brief: PlanBrief = {
    ...b,
    name: b.name.trim().slice(0, 80) || race?.name || 'Training plan',
    race,
    startDate: start,
    weeks,
    hoursPerWeek: hours,
    days,
    longRideDay: weekdayOk(b.longRideDay),
    longRunDay: weekdayOk(b.longRunDay),
    athlete: b.athlete.trim().slice(0, 3000),
    away,
  }
  return { ok: true, brief, span: { start, weeks, ...(race ? { raceDate: race.date } : {}) }, notes }
}

function clampHours(h: number): number {
  return Number.isFinite(h) ? Math.min(Math.max(Math.round(h * 2) / 2, 0), 40) : 0
}

/** The Monday of a plan week. */
export const weekStart = (span: Pick<PlanSpan, 'start'>, week: number): DateKey => addDays(span.start, 7 * (week - 1))

/** Whether two briefs differ in what shapes every week's sessions: sports, days, hours, long days, the race, time away. */
export function reshapes(a: PlanBrief, b: PlanBrief): boolean {
  const key = (x: PlanBrief) => JSON.stringify([x.sports, x.days.map((d) => [d.weekday, d.maxMinutes]), x.hoursPerWeek, x.longRideDay ?? null, x.longRunDay ?? null, x.race?.date ?? null, x.startDate ?? null, x.weeks ?? null])
  return key(a) !== key(b)
}
