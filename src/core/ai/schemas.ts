// Output schemas for structured AI calls. Providers enforce them natively
// (JSON schema / structured outputs) and we ALWAYS re-validate with zod,
// because providers may drop constraints such as min/max.
import { z } from 'zod'
import { MAX_AI_WEEKS, PHASES, SESSION_TYPES, type Phase, type SessionType } from '../workout/plan-builder'

const power = z.number().min(0.2).max(3).describe('Fraction of FTP, e.g. 0.88 for 88 %')
const duration = z.number().int().min(5).max(4 * 3600).describe('Seconds')
const cadence = z.number().int().min(50).max(130).optional().describe('Target rpm, optional')

export const GeneratedSegmentSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('steady'), durationS: duration, power, cadence, label: z.string().max(60).optional() }),
  z.object({
    kind: z.literal('ramp'),
    role: z.enum(['warmup', 'cooldown', 'ramp']),
    durationS: duration,
    from: power,
    to: power,
    label: z.string().max(60).optional(),
  }),
  z.object({
    kind: z.literal('intervals'),
    repeat: z.number().int().min(1).max(50),
    onS: duration,
    onPower: power,
    offS: duration,
    offPower: power,
    onCadence: cadence,
    label: z.string().max(60).optional(),
  }),
  z.object({ kind: z.literal('freeride'), durationS: duration, label: z.string().max(60).optional() }),
  z.object({ kind: z.literal('maxeffort'), durationS: z.number().int().min(5).max(600), label: z.string().max(60).optional() }),
])

export const GeneratedWorkoutSchema = z.object({
  name: z.string().min(3).max(80),
  description: z.string().max(600),
  tags: z.array(z.string().max(30)).max(8),
  segments: z.array(GeneratedSegmentSchema).min(1).max(120),
  cues: z
    .array(z.object({ atS: z.number().int().min(0), message: z.string().max(140) }))
    .max(40)
    .describe('Optional on-screen coaching cues at absolute seconds'),
})
export type GeneratedWorkout = z.infer<typeof GeneratedWorkoutSchema>

export const QuipPackSchema = z.object({
  lines: z
    .array(
      z.object({
        trigger: z.string().max(40),
        text: z.string().min(3).max(220),
      }),
    )
    .min(5)
    .max(80),
})
export type QuipPack = z.infer<typeof QuipPackSchema>

export const RideTitleSchema = z.object({
  title: z.string().min(3).max(60),
  description: z.string().max(600),
})
export type RideTitle = z.infer<typeof RideTitleSchema>

/** A training plan outline: weeks of typed sessions. CrankHog fills each session with a workout (src/core/workout/plan-builder.ts). */
export const PlanSkeletonSchema = z.object({
  weeks: z
    .array(
      z.object({
        phase: z.enum(PHASES as [Phase, ...Phase[]]).describe('base, build, specialty, taper, or recovery'),
        sessions: z
          .array(
            z.object({
              day: z.number().int().min(0).max(6).describe('Weekday, 0 = Monday … 6 = Sunday'),
              type: z.enum(SESSION_TYPES as [SessionType, ...SessionType[]]),
              minutes: z.number().int().min(20).max(360),
              intent: z.string().max(160).describe('One line: what the session is for'),
            }),
          )
          .max(7),
      }),
    )
    .min(1)
    .max(MAX_AI_WEEKS),
})
export type PlanSkeletonOutput = z.infer<typeof PlanSkeletonSchema>

/**
 * A plan document read into sessions (src/core/plan-import). The schema only
 * fixes the shape: no enums, ranges or lengths, which would fail a whole part
 * over one odd session. CrankHog checks each session's sport, day, weekday
 * and steps itself (fromAiOutput, then its importers), and reports or drops
 * the one that's wrong. Optional values are null, not left out, which every
 * provider's strict mode accepts.
 */
export const PlanImportSchema = z.object({
  planName: z.string().nullable().describe("The plan's name, as the document gives it"),
  raceName: z.string().nullable().describe('The race or event the plan builds to'),
  raceDate: z.string().nullable().describe('The race day, YYYY-MM-DD'),
  startDate: z.string().nullable().describe("The plan's first day, YYYY-MM-DD, when the document gives it"),
  countdown: z.boolean().nullable().describe('True when the document numbers its weeks down to the race (16 weeks out … 1 week out), false when up from its first, null when it has no week numbers'),
  items: z.array(
    z.object({
      date: z.string().nullable().describe('YYYY-MM-DD, when the document dates the session'),
      week: z.number().nullable().describe("The document's own week number for the session"),
      weekday: z.number().nullable().describe('0 = Monday … 6 = Sunday'),
      sport: z.string().describe('bike, run, swim or other'),
      name: z.string(),
      steps: z.string().describe('Bike: intervals.icu workout text. Run, swim, other: CrankHog session steps. Empty for a session given only by its length'),
      minutes: z.number().nullable().describe('A session with no steps: how long it lasts'),
      effort: z.string().nullable().describe('A session with no steps: how hard, easy, moderate, hard or max'),
      notes: z.string().nullable(),
    }),
  ),
  skipped: z.array(z.object({ text: z.string(), reason: z.string() })).describe('What in the document could not be read as a session, and why'),
})
export type PlanImportOutput = z.infer<typeof PlanImportSchema>

/**
 * A coach-drafted plan's outline (src/core/coach-plan/draft.ts): each week's
 * phase, focus, hours per sport and key sessions. Shape only, as for the plan
 * import; fromOutline checks the values.
 */
export const PlanOutlineSchema = z.object({
  notes: z.string().describe("The plan's approach in two or three sentences: how it builds, where the recovery weeks fall, the taper"),
  weeks: z.array(
    z.object({
      week: z.number().describe('The plan week, 1 = the first'),
      phase: z.string().describe('base, build, peak, taper or recovery'),
      focus: z.string().describe('What the week is for, in a line'),
      hours: z.object({ swim: z.number(), bike: z.number(), run: z.number(), other: z.number() }).describe('Hours of each sport that week; other is strength and mobility'),
      keySessions: z.array(z.string()).describe("The week's two or three key sessions, a few words each"),
    }),
  ),
})
export type PlanOutlineOutput = z.infer<typeof PlanOutlineSchema>

/** Some weeks of a coach-drafted plan's sessions, in the plan import's item shape without dates. */
export const PlanWeeksSchema = z.object({
  items: z.array(
    z.object({
      week: z.number().describe('The plan week'),
      weekday: z.number().describe('0 = Monday … 6 = Sunday'),
      sport: z.string().describe('bike, run, swim or other'),
      name: z.string(),
      steps: z.string().describe('Bike: intervals.icu workout text. Run, swim, other: CrankHog session steps. Empty for a session given only by its length and effort'),
      minutes: z.number().nullable().describe('A session with no steps: how long it lasts'),
      effort: z.string().nullable().describe('A session with no steps: easy, moderate, hard or max'),
      notes: z.string().nullable(),
    }),
  ),
})
export type PlanWeeksOutput = z.infer<typeof PlanWeeksSchema>

export const AI_SCHEMAS = {
  workout: GeneratedWorkoutSchema,
  'training-plan': PlanSkeletonSchema,
  'plan-import': PlanImportSchema,
  'plan-outline': PlanOutlineSchema,
  'plan-weeks': PlanWeeksSchema,
  'quip-pack': QuipPackSchema,
  'ride-title': RideTitleSchema,
} as const
export type AiSchemaId = keyof typeof AI_SCHEMAS
