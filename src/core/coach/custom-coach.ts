// Custom coaches: a rider's own coach, made in Settings → Coach. The rider
// gives it a name, a photo, a description of who it is, and (if they like)
// lines of their own. With an AI provider set up, the AI writes a pack of
// ride lines from the description when the coach is saved, and the
// description goes along with every chat, debrief and ride's fresh lines, so
// the coach sounds like itself everywhere.
//
// Stored coaches come back through parseCustomCoaches (a backup can carry
// anything), and every line passes the same guardrails as the built-in
// packs: a line that touches a banned topic is refused when it's typed and
// skipped if it ever turns up stored.
import { z } from 'zod'
import { personaInstruction } from '../ai/prompts'
import { clampSpice } from '../persona/engine'
import { detectProfanity, guardrailMatch, type GuardrailCategory } from '../persona/guardrails'
import { bracesBalanced, placeholdersOf } from '../persona/template'
import { isDataKey, toProfanity, type CoachLineTemplate, type CoachTrigger, type PersonaMeta, type PersonaPack, type ProfanitySetting } from '../persona/types'
import { MAX_LINE_CHARS } from '../persona/validate'
import { MAX_AI_LINES, QUIP_TRIGGERS, UNSPEAKABLE, quipLinesFromPack } from './ai-quips'

export const CUSTOM_COACH_PREFIX = 'custom-'
export const MAX_CUSTOM_COACHES = 20
export const MAX_COACH_NAME = 40
export const MAX_PERSONA_CHARS = 800
export const MAX_PHRASES = 40
/** A 160 px JPEG data URL is 10–20 kB; this leaves room for a PNG without letting a backup bloat the database. */
export const MAX_PHOTO_CHARS = 300_000

/** When one of the rider's own lines may be said. */
export const PHRASE_MOMENTS = ['any', 'start', 'hard', 'struggling', 'done'] as const
export type PhraseMoment = (typeof PHRASE_MOMENTS)[number]

const MOMENT_TRIGGERS: Record<PhraseMoment, readonly CoachTrigger[]> = {
  any: ['idle_banter', 'halfway', 'last_minute'],
  start: ['ride_start'],
  hard: ['countdown_10s', 'segment_start'],
  struggling: ['under_target', 'cadence_sag', 'segment_end_failed', 'wbal_low'],
  done: ['segment_end_success', 'pr', 'workout_complete'],
}

/** The rider's own lines carry more weight than the AI's, so they come up often. */
const PHRASE_WEIGHT = 3

const PhraseSchema = z.object({
  text: z.string().trim().min(1).max(MAX_LINE_CHARS),
  moment: z.enum(PHRASE_MOMENTS),
})

const AiLineSchema = z.object({
  trigger: z.enum(QUIP_TRIGGERS),
  text: z.string().trim().min(3).max(MAX_LINE_CHARS),
})

export const CustomCoachSchema = z.object({
  id: z.string().regex(/^custom-[a-z0-9]{6,24}$/),
  name: z.string().trim().min(1).max(MAX_COACH_NAME),
  /** A small square picture as a data: URL, or null for a monogram. */
  photo: z
    .string()
    .max(MAX_PHOTO_CHARS)
    .regex(/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/)
    .nullable(),
  /** Who the coach is, in the rider's words. */
  persona: z.string().trim().max(MAX_PERSONA_CHARS),
  phrases: z.array(PhraseSchema).max(MAX_PHRASES),
  /** Lines the AI wrote from the persona, already filtered. */
  aiLines: z.array(AiLineSchema).max(MAX_AI_LINES),
  createdAt: z.number(),
  updatedAt: z.number(),
})

export type CustomCoach = z.infer<typeof CustomCoachSchema>
export type CustomCoachPhrase = CustomCoach['phrases'][number]

export function isCustomCoachId(id: string): boolean {
  return id.startsWith(CUSTOM_COACH_PREFIX)
}

/** A fresh id: `custom-` and 10 base-36 characters from the given random source. */
export function newCustomCoachId(random: () => number): string {
  let s = ''
  for (let i = 0; i < 10; i++) s += Math.floor(random() * 36).toString(36)
  return `${CUSTOM_COACH_PREFIX}${s}`
}

/** Keeps the lines of a stored coach that parse, so one bad line (say, from a newer version's backup) costs only that line. */
function salvageLines(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null) return raw
  const c = raw as Record<string, unknown>
  const keep = (v: unknown, schema: z.ZodType) => (Array.isArray(v) ? v.filter((x) => schema.safeParse(x).success) : v)
  return { ...c, phrases: keep(c.phrases, PhraseSchema), aiLines: keep(c.aiLines, AiLineSchema) }
}

/** The stored list, keeping only coaches that parse (later duplicates of an id are dropped). */
export function parseCustomCoaches(value: unknown): CustomCoach[] {
  if (!Array.isArray(value)) return []
  const out: CustomCoach[] = []
  const seen = new Set<string>()
  for (const raw of value) {
    const r = CustomCoachSchema.safeParse(salvageLines(raw))
    if (!r.success || seen.has(r.data.id)) continue
    seen.add(r.data.id)
    out.push(r.data)
    if (out.length >= MAX_CUSTOM_COACHES) break
  }
  return out
}

const TOPIC: Record<GuardrailCategory, string> = {
  'self-harm': 'self-harm',
  violence: 'violence',
  ethnicity: 'ethnicity',
  religion: 'religion',
  sexuality: 'sexuality',
  gender: 'gender',
  health: 'health',
  body: 'bodies and weight',
  politics: 'politics',
}

/** Why a line can't be used, in words for the rider, or null when it's fine. */
export function phraseProblem(text: string): string | null {
  const t = text.trim()
  if (t.length === 0) return 'Write something for the coach to say.'
  if (t.length > MAX_LINE_CHARS) return `Keep it under ${MAX_LINE_CHARS} characters: it's read out mid-effort.`
  if (!bracesBalanced(t)) return 'A { or } is out of place. Placeholders look like {power}.'
  const unknown = placeholdersOf(t).find((k) => !isDataKey(k))
  if (unknown !== undefined) return `{${unknown}} isn't something the app knows. Try {power}, {targetW}, {cadence}, {hr} or {remainingS}.`
  if (UNSPEAKABLE.test(t)) return 'No links or emoji: lines are read aloud.'
  const hit = guardrailMatch(t)
  if (hit) return `CrankHog coaches leave ${TOPIC[hit.category]} alone, so this line can't be used.`
  return null
}

/** Why a name can't be used, or null. */
export function coachNameProblem(name: string): string | null {
  const t = name.trim()
  if (t.length === 0) return 'Give your coach a name.'
  if (t.length > MAX_COACH_NAME) return `Keep the name under ${MAX_COACH_NAME} characters.`
  const hit = guardrailMatch(t)
  return hit ? `CrankHog coaches leave ${TOPIC[hit.category]} alone. Try another name.` : null
}

/** The first sentence of the description, short enough for a tile; or a plain stand-in. */
export function customTagline(persona: string): string {
  const first = persona.trim().split(/(?<=[.!?])\s/)[0]?.trim() ?? ''
  if (first.length === 0 || guardrailMatch(first)) return 'Your own coach.'
  return first.length <= 90 ? first : `${first.slice(0, 87).trimEnd()}…`
}

/** The coach's persona meta, as the engine and the AI prompts see it. */
export function customCoachMeta(c: Pick<CustomCoach, 'id' | 'name' | 'persona'>): PersonaMeta {
  return { id: c.id, name: c.name.trim(), tagline: customTagline(c.persona), ...(c.persona.trim() ? { persona: c.persona.trim() } : {}) }
}

/**
 * The coach as a persona pack: the rider's lines at the moments they picked,
 * then the AI's. Every line is usable at any spice (the persona sets the
 * tone), swearing is flagged so the Profanity setting still applies, and
 * nothing is said at a warm-up that was meant for an interval. Triggers the
 * pack has no line for fall back to Professional, as with any thin pack.
 */
export function customCoachPack(c: CustomCoach): PersonaPack {
  const lines: CoachLineTemplate[] = []
  const add = (id: string, text: string, triggers: readonly CoachTrigger[], weight?: number) => {
    const profanity = detectProfanity(text) !== null
    const plain = triggers.filter((t) => t !== 'segment_start')
    const base = { text, spice: 1 as const, ...(profanity ? { profanity: true } : {}), ...(weight ? { weight } : {}) }
    if (plain.length > 0) lines.push({ id, ...base, triggers: plain })
    if (triggers.includes('segment_start')) lines.push({ id: `${id}.hard`, ...base, triggers: ['segment_start'], criteria: [{ key: 'hard', op: '==', value: true }] })
  }
  c.phrases.forEach((p, i) => {
    const text = p.text.replace(/\s+/g, ' ').trim()
    if (phraseProblem(text) === null) add(`${c.id}.own.${i + 1}`, text, MOMENT_TRIGGERS[p.moment], PHRASE_WEIGHT)
  })
  c.aiLines.forEach((l, i) => {
    const text = l.text.replace(/\s+/g, ' ').trim()
    // not `ai.` ids: stored lines get the engine's topic check like any canned line
    if (phraseProblem(text) === null) add(`${c.id}.written.${i + 1}`, text, [l.trigger])
  })
  return { meta: customCoachMeta(c), lines }
}

/** The user message for the 'ai.structured' quip-pack request that writes a coach's stored lines. */
export function customCoachLinesPrompt(meta: PersonaMeta, opts: { spice: number; profanity: ProfanitySetting }): string {
  return [
    personaInstruction({ name: meta.name, tagline: meta.tagline, persona: meta.persona, spice: clampSpice(opts.spice), profanity: toProfanity(opts.profanity) }),
    'Ride: any ride. These lines are kept and reused on every ride from now on, so keep them general: no workout names, distances or durations.',
    'Write two or three lines for every trigger, 40 to 55 lines in all.',
  ].join('\n')
}

/** The lines of an AI reply that may be stored: the quip-pack rules, then the guardrails. */
export function customCoachLinesFromPack(value: unknown, opts: { meta: PersonaMeta; spice: number; profanity: ProfanitySetting }): CustomCoach['aiLines'] {
  const { lines } = quipLinesFromPack(value, { persona: opts.meta, spice: opts.spice, profanity: opts.profanity })
  return lines.filter((l) => phraseProblem(l.text) === null).map((l) => ({ trigger: l.triggers[0] as CustomCoach['aiLines'][number]['trigger'], text: l.text }))
}
