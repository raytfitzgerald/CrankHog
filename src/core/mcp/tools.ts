// What Claude (Claude Desktop, Claude Code) can do with CrankHog over MCP.
// CrankHog serves these on a private socket on the Mac; the CrankHog add-on
// in Claude speaks MCP and passes tool calls through (resources/mcp). Reads
// get what the coach chat gets (athlete-context.ts: never Strava data, never
// the rider's name). Changes go through the coach chat's own checks and
// repos (coach-actions, plan import) and apply at once: Claude asks the
// rider before each call, and every change can be undone, in CrankHog or by
// Claude.
import { z } from 'zod'
import { ProposalSchema, readProposal } from '../coach-actions/actions'
import { BIKE_STEPS, SESSION_STEPS } from '../ai/prompts'
import { McpPlanSchema } from './plan'

export type McpToolName = 'get_training' | 'get_calendar' | 'list_workouts' | 'check_changes' | 'make_changes' | 'check_plan' | 'save_plan' | 'undo_change'

export interface McpTool {
  name: McpToolName
  title: string
  description: string
  schema: z.ZodType
  /** Writes to the rider's CrankHog: listed only while Settings allows Claude to make changes. */
  changes: boolean
  /** Can take something away (a session, a plan): Claude should be sure. */
  destructive?: boolean
  /** Reads the input when the schema alone isn't enough: the coach chat's proposal reader, which tidies case and aliases ("Ride"). */
  read?: (raw: unknown) => InputRead
}

export type InputRead = { ok: true; value: unknown } | { ok: false; error: string }

const readChanges = (raw: unknown): InputRead => {
  const r = readProposal(raw)
  return r.ok ? { ok: true, value: r.proposal } : { ok: false, error: r.error.replace("The coach's proposal", 'That').replace('The coach proposed', 'That has') }
}

const day = z.string().describe('A day, YYYY-MM-DD')

export const CalendarQuerySchema = z.object({
  from: day.describe('The first day, YYYY-MM-DD'),
  to: day.describe('The last day, YYYY-MM-DD; at most 400 days after from'),
  steps: z.boolean().nullish().describe("Include each session's steps (longer)"),
})
export type CalendarQuery = z.infer<typeof CalendarQuerySchema>

export const WorkoutQuerySchema = z.object({
  sport: z.enum(['bike', 'run', 'swim', 'other']).nullish(),
  search: z.string().max(80).nullish().describe('Words in the name or tags: "sweet spot", "vo2", "threshold"'),
})
export type WorkoutQuery = z.infer<typeof WorkoutQuerySchema>

export const UndoSchema = z.object({
  id: z.string().max(40).nullish().describe('The id make_changes or save_plan gave; leave out for the latest change'),
})

const STEPS = `${BIKE_STEPS}. Open a structured workout with a warm-up and end it with a cool-down.

${SESSION_STEPS}`

const CHANGES = `Actions, by type:
- create_workout: a new workout with steps, kept in the athlete's library (a bike workout in Custom workouts, a run or swim with their sessions), and planned on date when you give one.
- add_session: a session with no steps on a day, as minutes and effort ("Squash", 60, hard).
- schedule_workout: a workout from the library (list_workouts), by its name, on a day.
- move, swap, remove: planned sessions, by ref.
- replace: a planned session changed in place, same day: new steps, or minutes and effort, or another sport. Use it to lighten or harden a session.
- days_off: rest, sick or travel days, from one day to another (the same day for one).
- add_event; change_event (moving it re-lays the plans built to it); remove_day_mark (an event or a day off).
- log_activity: something the athlete has done, for their history. Today or earlier only.
- set_thresholds: FTP, LTHR, maximum or resting heart rate, weight, threshold run pace per km, swim CSS per 100 m. Only what changes.

CrankHog refuses a session done already, a day that has passed, and rewriting (replace) a session imported from intervals.icu. A change to a session applies to that day only.

${STEPS}`

export const MCP_TOOLS: readonly McpTool[] = [
  {
    name: 'get_training',
    title: "Read the athlete's training",
    description:
      "Everything CrankHog knows about the athlete, as JSON: profile and thresholds, FTP history, fitness, fatigue and form, recent rides (with laps) and other sports, training plans, the calendar from 4 weeks ago to 12 weeks ahead (planned, done and missed, with the next days' steps), events and days off, and their own workouts. Calendar entries, events, days off and plans carry a ref, which changes use to name them. Read it before you advise or change anything.",
    schema: z.object({}),
    changes: false,
  },
  {
    name: 'get_calendar',
    title: 'Read the calendar',
    description: 'The calendar for any span of days: each session planned or done with its ref, sport, length, load and plan, whether it was done or missed, and the events and days off with their refs.',
    schema: CalendarQuerySchema,
    changes: false,
  },
  {
    name: 'list_workouts',
    title: 'List workouts',
    description: "The workouts in CrankHog's library, CrankHog's own and the athlete's, with their length and load: what schedule_workout puts on a day by name.",
    schema: WorkoutQuerySchema,
    changes: false,
  },
  {
    name: 'check_changes',
    title: 'Check changes',
    description: `What a set of changes would do, without making them: each change in words with the sessions before and after, the calendar days it touches, and anything CrankHog can't do. Takes the same input as make_changes.\n\n${CHANGES}`,
    schema: ProposalSchema,
    changes: false,
    read: readChanges,
  },
  {
    name: 'make_changes',
    title: "Change the athlete's training",
    description: `Change the athlete's CrankHog: their calendar, workouts, days off, events, history or thresholds. Every change for one request goes in one call, in order, and they apply together or not at all. Plans re-lay, and intervals.icu and Google Calendar follow. Returns what changed and an id; undo_change takes it back, and so can the athlete in CrankHog (Settings, AI).\n\n${CHANGES}`,
    schema: ProposalSchema,
    changes: true,
    destructive: true,
    read: readChanges,
  },
  {
    name: 'check_plan',
    title: 'Check a training plan',
    description: `Check a whole training plan without saving it: CrankHog reads every session's steps as it would on save, and says what it can't read and what it leaves out, with the weeks, sessions and hours by sport. Takes the same input as save_plan.\n\n${STEPS}`,
    schema: McpPlanSchema,
    changes: false,
  },
  {
    name: 'save_plan',
    title: 'Save a training plan',
    description: `Save a training plan you wrote with the athlete onto their calendar, every session on its day. Agree it with them first: ask about their race, days, hours and specifics, show them the plan, and save once they accept. Bike sessions become ERG workouts filed in the plan; runs, swims and strength become sessions. With a race, it goes on the calendar as an A event and the plan counts back from it. If any session can't be read, nothing is saved and you're told what to fix. Returns an id for undo_change.\n\n${STEPS}`,
    schema: McpPlanSchema,
    changes: true,
  },
  {
    name: 'undo_change',
    title: 'Undo a change',
    description: 'Take back a change made with make_changes or save_plan: the latest, or the one with this id.',
    schema: UndoSchema,
    changes: true,
    destructive: true,
  },
]

/** What every connection is told first: how to use CrankHog's tools. */
export const MCP_INSTRUCTIONS = `CrankHog is the athlete's training app on their Mac: an indoor bike trainer with a training calendar for bike, run, swim and strength. Read get_training before you advise or change anything; it has today's date, their thresholds and the calendar with refs. Days are YYYY-MM-DD in the athlete's time zone; weekdays 0 = Monday … 6 = Sunday. Name calendar entries, events, days off and plans by their ref, never by an id you made up. Use check_changes or check_plan when you're unsure a change will go through. CrankHog never gets the athlete's name or Strava data, and neither should you ask for them.`

/** A tool as MCP lists it. */
export interface McpToolJson {
  name: string
  title: string
  description: string
  inputSchema: Record<string, unknown>
  annotations: { title: string; readOnlyHint: boolean; destructiveHint: boolean; idempotentHint: boolean; openWorldHint: boolean }
}

/** A tool's input schema as JSON Schema. */
export function inputJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const { $schema: _s, ...json } = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) as Record<string, unknown>
  return json
}

/** The tools Claude is offered: the reads, and the changes when the rider allows them. */
export function mcpToolList(allowChanges: boolean): McpToolJson[] {
  return MCP_TOOLS.filter((t) => allowChanges || !t.changes).map((t) => ({
    name: t.name,
    title: t.title,
    description: t.description,
    inputSchema: inputJsonSchema(t.schema),
    annotations: { title: t.title, readOnlyHint: !t.changes, destructiveHint: t.destructive === true, idempotentHint: !t.changes, openWorldHint: false },
  }))
}

/** A call's input, checked: by the tool's reader, or against its schema, with what doesn't fit in words. */
export function readInput(tool: McpTool, raw: unknown): InputRead {
  if (tool.read) return tool.read(raw ?? {})
  const parsed = tool.schema.safeParse(raw ?? {})
  if (parsed.success) return { ok: true, value: parsed.data }
  const issues = parsed.error.issues.slice(0, 8).map((i) => `${i.path.join('.') || 'input'}: ${i.message}`)
  return { ok: false, error: `That input doesn't fit ${tool.name}: ${issues.join('; ')}` }
}

/** The tool of that name, if Claude may call it now. */
export function mcpTool(name: string, allowChanges: boolean): McpTool | undefined {
  return MCP_TOOLS.find((t) => t.name === name && (allowChanges || !t.changes))
}
