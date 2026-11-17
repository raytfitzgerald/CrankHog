// Provider-neutral AI request types. Providers live in the main process
// (src/main/ai/providers); API keys never reach the renderer.

export type AiProviderId = 'anthropic' | 'openai' | 'grok' | 'ollama'

/** What the call is for; drives model choice, effort, timeout and budget. */
export type AiPurpose = 'quip-pack' | 'live-line' | 'debrief' | 'workout' | 'chat' | 'ride-title' | 'fitness-summary' | 'training-plan' | 'plan-import'

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
}
