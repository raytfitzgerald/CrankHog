// The last gate before anything is shown or spoken. The one rule that holds
// for every line, canned, user-made or AI-written, at every language setting:
// nothing that tells the rider to hurt or kill themselves. The rider's
// Profanity setting decides the swearing. Nothing else is filtered: the
// coaches are allowed to be mean.
//
// Facts are checked too, because workout files are user data: a line like
// "Today's program is {workoutName}" must never render a name that crosses
// that line. Dropping the fact makes that one line ineligible, so the engine
// simply picks another one and no cue is lost.
import { languageAllowed, normalizeForMatching, violatesGuardrails } from '../persona/guardrails'
import { PRIORITY, toProfanity, type CoachData, type CoachLine, type ProfanitySetting } from '../persona/types'

/** Matches raw and normalized text, so leetspeak and accents do not slip through. */
export function matchesAny(text: string, patterns: readonly RegExp[]): boolean {
  if (patterns.length === 0) return false
  const norm = normalizeForMatching(text)
  return patterns.some((p) => p.test(text) || p.test(norm))
}

/** May this text be said: never self-harm, and swearing only as far as the setting allows. */
export function textAllowed(text: string, profanity: ProfanitySetting): boolean {
  if (violatesGuardrails(text) !== null) return false
  const level = toProfanity(profanity)
  return level === 'unhinged' || languageAllowed(text, level)
}

/**
 * The data with every string fact that touches self-harm removed (missing,
 * not blanked: lines that need it become ineligible).
 */
export function sanitizeFacts(data: CoachData): CoachData {
  let out: CoachData | null = null
  for (const [k, v] of Object.entries(data)) {
    if (typeof v !== 'string' || violatesGuardrails(v) === null) continue
    out ??= { ...data }
    delete out[k]
  }
  return out ?? data
}

/** Said when a safety line somehow fails the gate: safety is never dropped. */
export const SAFETY_FALLBACK_TEXT = 'Ease right off and take a breather. Stop if anything feels wrong.'

/** The line as it may be shown and spoken, or null when it must be dropped. */
export function gateLine(line: CoachLine, opts: { profanity: ProfanitySetting }): CoachLine | null {
  if (textAllowed(line.text, opts.profanity)) return line
  if (line.priority === PRIORITY.safety) return { ...line, text: SAFETY_FALLBACK_TEXT, speech: SAFETY_FALLBACK_TEXT }
  return null
}
