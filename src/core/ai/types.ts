// Provider-neutral AI request types. Providers live in the main process
// (src/main/ai/providers); API keys never reach the renderer.
import type { z } from 'zod'

export type AiProviderId = 'anthropic' | 'openai' | 'grok' | 'ollama'

/** What the call is for; drives model choice, effort, timeout and budget. */
export type AiPurpose = 'quip-pack' | 'live-line' | 'debrief' | 'workout' | 'chat' | 'ride-title' | 'fitness-summary' | 'training-plan' | 'plan-import' | 'plan-outline' | 'plan-weeks'

/** A tool the model may call: what it does, and its input's schema. The coach chat's are in coach-tools.ts. */
export interface AiTool {
  name: string
  description: string
  schema: z.ZodType
}

/** A call the model made. The input is the model's, unchecked: whoever acts on it validates it. */
export interface AiToolCall {
  name: string
  input: unknown
}

export interface AiMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface AiRequest {
  /** Stable instructions (cached by providers that support prompt caching). */
  system: string
  messages: AiMessage[]
  maxTokens?: number
  effort?: 'low' | 'medium' | 'high'
  /** Room a local model keeps for the reply in its context window (Ollama), when it needs more than the usual 4,096 tokens. Hosted models size their own. */
  replyTokens?: number
  /** Tools the model may call: natively where the provider has tool calling, else written as a fenced block (text-tools.ts). */
  tools?: readonly AiTool[]
}

export interface AiUsage {
  inputTokens?: number
  outputTokens?: number
  cacheReadTokens?: number
}

export interface AiResult {
  text: string
  usage?: AiUsage
  model: string
  /** The tools the model called, in order, when the request offered any. */
  toolCalls?: AiToolCall[]
}

export class AiError extends Error {
  constructor(
    message: string,
    readonly code: 'not-configured' | 'timeout' | 'cancelled' | 'refusal' | 'invalid-output' | 'rate-limited' | 'auth' | 'network' | 'circuit-open' | 'budget' | 'provider',
  ) {
    super(message)
    this.name = 'AiError'
  }
}

/** Defaults per purpose: tight limits for in-ride calls, generous ones for analysis. */
export const PURPOSE_DEFAULTS: Record<AiPurpose, { timeoutMs: number; maxTokens: number; effort: 'low' | 'medium' | 'high'; replyTokens?: number }> = {
  'quip-pack': { timeoutMs: 45_000, maxTokens: 8000, effort: 'low' },
  'live-line': { timeoutMs: 8_000, maxTokens: 1500, effort: 'low' },
  debrief: { timeoutMs: 180_000, maxTokens: 16_000, effort: 'medium' },
  workout: { timeoutMs: 120_000, maxTokens: 16_000, effort: 'medium' },
  chat: { timeoutMs: 180_000, maxTokens: 16_000, effort: 'medium' },
  'ride-title': { timeoutMs: 20_000, maxTokens: 1500, effort: 'low' },
  'fitness-summary': { timeoutMs: 90_000, maxTokens: 4000, effort: 'low' },
  // a plan's weeks of sessions, as JSON
  'training-plan': { timeoutMs: 180_000, maxTokens: 16_000, effort: 'medium', replyTokens: 8192 },
  // a part of a plan document can hold a few weeks of sessions, steps and all: 60-80 sessions are 6-10k tokens of JSON.
  // The output room is for thinking models too (a model that allows less is asked again at its own limit)
  'plan-import': { timeoutMs: 300_000, maxTokens: 32_000, effort: 'medium', replyTokens: 12_288 },
  // a coach-drafted plan's outline: a line or two a week, up to 52 weeks
  'plan-outline': { timeoutMs: 240_000, maxTokens: 16_000, effort: 'medium', replyTokens: 8192 },
  // a block of a coach-drafted plan: a few weeks of sessions, steps and all, as the plan import's parts
  'plan-weeks': { timeoutMs: 300_000, maxTokens: 32_000, effort: 'medium', replyTokens: 12_288 },
}
