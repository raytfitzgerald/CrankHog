// A training plan Claude writes in full and hands CrankHog over MCP: every
// session on its day. Unlike the coach chat's drafts, nothing here is written
// by CrankHog's own AI; Claude is the coach, and CrankHog checks what it was
// given (the days, then each session's steps with the plan import's readers)
// before anything is saved.
import { z } from 'zod'
import { MAX_IMPORT_WEEKS, mondayOf, type ImportDoc, type ImportItem } from '../plan-import/model'
import { isRealDay } from '../workout/plan'
import { addDays, type DateKey } from '../workout/schedule'

const day = z.string().describe('A day, YYYY-MM-DD')

/** The most sessions one plan may hold: two a day for a year, and some. */
export const MAX_PLAN_SESSIONS = 800

export const McpPlanSchema = z.object({
  name: z.string().min(1).max(80).describe('The plan\'s name, short and plain: "Ironman Barcelona 2027"'),
  race: z
    .object({ name: z.string().min(1).max(80), date: day })
    .nullish()
    .describe('The race the plan builds to. It goes on the calendar as an A event (or the event already there that day is used), and the plan follows it if it moves. Leave out for a plan without one.'),
  sessions: z
    .array(
      z.object({
        date: day,
        sport: z.enum(['bike', 'run', 'swim', 'other']).describe('other is strength, mobility, yoga'),
        name: z.string().min(1).max(80).describe('Short and plain: "Sweet spot 3x12", "Long run", "CSS 10x100"'),
        steps: z.string().max(6000).nullish().describe('The session\'s steps, one a line (see the step formats). Leave out for a session planned as minutes and effort.'),
        minutes: z.number().nullish().describe('For a session without steps: how long'),
        effort: z.enum(['easy', 'moderate', 'hard', 'max']).nullish().describe('For a session without steps: how hard'),
        notes: z.string().max(2000).nullish().describe('What the session is for, and how it should feel'),
      }),
    )
    .min(1)
    .max(MAX_PLAN_SESSIONS)
    .describe('Every session of the plan, each on its day, in any order. Nothing on or after race day: the race is the plan\'s last day.'),
})
export type McpPlan = z.infer<typeof McpPlanSchema>

export interface McpPlanDoc {
  /** The sessions as the plan import reads them. */
  doc: ImportDoc
  /** The Monday of the plan's first week. */
  start: DateKey
  raceDate?: DateKey
  /** What's wrong with the plan as a whole or its days; with any, nothing is checked further or saved. */
  problems: string[]
}

/** The plan as a document the plan import can check and save, and anything wrong with its days. */
export function planDoc(plan: McpPlan, today: DateKey): McpPlanDoc {
  const problems: string[] = []
  const race = plan.race ?? undefined
  if (race && !isRealDay(race.date)) problems.push(`The race date "${race.date}" isn't a day: write it YYYY-MM-DD.`)
  else if (race && race.date <= today) problems.push(`The race is on ${race.date}, which isn't after today (${today}).`)
  const items: ImportItem[] = []
  for (const s of plan.sessions) {
    const where = `${s.date}, ${s.name}`
    if (!isRealDay(s.date)) {
      problems.push(`${where}: "${s.date}" isn't a day; write it YYYY-MM-DD.`)
      continue
    }
    if (s.date < today) {
      problems.push(`${where}: that day has passed (today is ${today}).`)
      continue
    }
    if (!s.steps?.trim() && !s.minutes) problems.push(`${where}: give it steps, or minutes and an effort.`)
    items.push({
      where,
      date: s.date,
      sport: s.sport,
      name: s.name.trim(),
      steps: s.steps?.trim() ?? '',
      ...(s.minutes ? { minutes: Math.round(s.minutes) } : {}),
      ...(s.effort ? { effort: s.effort } : {}),
      ...(s.notes?.trim() ? { notes: s.notes.trim() } : {}),
    })
  }
  const first = items.map((i) => i.date!).sort()[0] ?? today
  const start = mondayOf(first)
  const last = [race?.date, ...items.map((i) => i.date!)].filter((d): d is DateKey => !!d && isRealDay(d)).sort().at(-1) ?? first
  if (last > addDays(start, MAX_IMPORT_WEEKS * 7 - 1)) problems.push(`The plan runs from ${start} to ${last}: at most ${MAX_IMPORT_WEEKS} weeks.`)
  return {
    doc: { name: plan.name, ...(race && isRealDay(race.date) ? { race: { name: race.name, date: race.date } } : {}), items, skipped: [] },
    start,
    ...(race && isRealDay(race.date) ? { raceDate: race.date } : {}),
    problems,
  }
}
