// The tools the coach chat may call. None of them changes anything: each one
// hands CrankHog something to show the rider as a card (proposed changes, or
// a plan to draft or revise), and only the rider's click on the card acts.
// Providers with tool calling get these as tools; Ollama gets them written
// into its prompt (text-tools.ts). Either way the renderer re-checks the
// input with these schemas before it shows a thing.
import { z } from 'zod'
import { ProposalSchema } from '../coach-actions/actions'
import { PlanBriefSchema, PlanRevisionSchema } from '../coach-plan/brief'
import { BIKE_STEPS, SESSION_STEPS } from './prompts'
import type { AiTool } from './types'

export const PROPOSE_CHANGES = 'propose_changes'
export const DRAFT_PLAN = 'draft_plan'
export const REVISE_PLAN = 'revise_plan'

const PROPOSE = `Propose changes to the rider's CrankHog: their calendar, workouts, days off, events, history or thresholds. CrankHog shows the rider a card listing exactly what changes, each with your why, its sessions' length and load before and after, and the calendar before and after; nothing happens until they press Apply, and they can undo it. Every change for one request goes in one call, in order. CrankHog refuses a session done already, a day that has passed, and rewriting (replace) a session imported from intervals.icu.

Actions, by type:
- create_workout: a new workout with steps, kept in the rider's library (a bike workout in Custom workouts, a run or swim with their sessions), and planned on date when you give one.
- add_session: a session with no steps on a day, as minutes and effort ("Squash", 60, hard).
- schedule_workout: a workout from the rider's library, by its name, on a day.
- move, swap, remove: planned sessions, by ref.
- replace: a planned session changed in place, same day: new steps, or minutes and effort, or another sport. Use it to lighten or harden a session.
- days_off: rest, sick or travel days, from one day to another (the same day for one).
- add_event; change_event (moving it re-lays the plans built to it); remove_day_mark (an event or a day off).
- log_activity: something the rider has done, for their history. Today or earlier only.
- set_thresholds: FTP, LTHR, maximum or resting heart rate, weight, threshold run pace per km, swim CSS per 100 m. Only what changes.

${BIKE_STEPS}. Open a structured workout with a warm-up and end it with a cool-down.

${SESSION_STEPS}`

const DRAFT = `Start drafting a training plan from what the rider told you. Call it only once you've asked about their specifics and have the answers. CrankHog outlines the plan, writes every session week by week (bike workouts with power targets, runs and swims with paces or heart rate, strength), and shows the rider the draft to review. Nothing is saved until they accept it. Days are YYYY-MM-DD; weekdays 0 = Monday … 6 = Sunday.`

const REVISE = `Revise the draft plan (planDraft in the data) with the rider's feedback. CrankHog changes the outline as asked and rewrites the weeks that change, then shows the rider the new draft. Give the whole brief again only when the rider's specifics changed (days, hours, long days, race date, time away).`

export const COACH_TOOLS: readonly AiTool[] = [
  { name: PROPOSE_CHANGES, description: PROPOSE, schema: ProposalSchema },
  { name: DRAFT_PLAN, description: DRAFT, schema: PlanBriefSchema },
  { name: REVISE_PLAN, description: REVISE, schema: PlanRevisionSchema },
]

/** A tool's input schema as JSON Schema, for a provider's tool definition. */
export function toolJsonSchema(tool: AiTool): Record<string, unknown> {
  const { $schema: _s, ...schema } = z.toJSONSchema(tool.schema, { io: 'input', unrepresentable: 'any' }) as Record<string, unknown>
  return schema
}
