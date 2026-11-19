import { GeneratedSessionSchema, GeneratedWorkoutSchema } from '@core/ai/schemas'
import { draftFromGenerated, sessionRequest, type SessionAsk } from '@core/multisport/ai-draft'
import type { SessionDraft } from '@core/multisport/draft'
import { workoutFromGenerated } from '@core/workout/from-generated'
import type { Workout } from '@core/workout/model'
import { workoutIssues } from '@core/workout/validate'
import { bridge } from '../../platform/bridge'

/** What a "Describe a workout" request came to: the draft and the model that wrote it, or why there isn't one. */
export type AiDraft<T> = { value: T; model: string | null } | { error: string }

/** A bike workout for the builder, through the structured-AI channel (main owns the keys and the prompt). */
export async function draftBikeWorkout(request: string): Promise<AiDraft<Workout>> {
  const r = await bridge().invoke('ai.structured', { purpose: 'workout', input: `The rider's request: ${request}` })
  if (!r.ok) return { error: r.error ?? 'The AI request failed.' }
  const parsed = GeneratedWorkoutSchema.safeParse(r.value)
  if (!parsed.success) return { error: "The AI's answer wasn't a workout CrankHog can read. Try rephrasing the request." }
  const w = workoutFromGenerated(parsed.data, { id: `ai:${crypto.randomUUID()}` })
  const problems = workoutIssues(w).filter((i) => i.severity === 'error')
  if (problems.length > 0) return { error: `The AI's workout can't be ridden as it is: ${problems.slice(0, 3).map((p) => p.message).join(' ')}` }
  return { value: w, model: r.model ?? null }
}

/** A run or swim for the session builder, in its sport and pool, written for the rider's units and thresholds. */
export async function draftSession(ask: SessionAsk): Promise<AiDraft<SessionDraft>> {
  const r = await bridge().invoke('ai.structured', { purpose: 'session-workout', input: sessionRequest(ask) })
  if (!r.ok) return { error: r.error ?? 'The AI request failed.' }
  const parsed = GeneratedSessionSchema.safeParse(r.value)
  if (!parsed.success) return { error: `The AI's answer wasn't a ${ask.sport} CrankHog can read. Try rephrasing the request.` }
  const d = draftFromGenerated(parsed.data, ask)
  if ('error' in d) return { error: `The AI's ${ask.sport} can't be built as it is: ${d.error}` }
  return { value: d.draft, model: r.model ?? null }
}
