import type { z } from 'zod'
import type { AiProviderId, AiRequest, AiResult } from '@core/ai/types'

export interface CallOpts {
  model: string
  signal: AbortSignal
  timeoutMs: number
}

export interface AiProvider {
  readonly id: AiProviderId
  listModels(signal: AbortSignal): Promise<string[]>
  complete(req: AiRequest, opts: CallOpts): Promise<AiResult>
  stream(req: AiRequest, opts: CallOpts, onDelta: (text: string) => void): Promise<AiResult>
  /** Provider-native structured output. The service re-validates with zod regardless. */
  structured(req: AiRequest, schema: z.ZodType, schemaName: string, opts: CallOpts): Promise<{ value: unknown; raw: string; model: string }>
}

/** A model's output limit when its refusal doesn't name it: gpt-4o's and gpt-4o-mini's. */
const OUTPUT_LIMIT_FALLBACK = 16_384

/**
 * The output limit a provider's refusal names, when the request asked a model
 * for more output than it allows ("supports at most 16384 completion tokens",
 * "Expected a value <= 16384", "> 8192, which is the maximum allowed"), or
 * null when the refusal is about something else or the limit is no lower.
 */
export function outputLimitIn(message: string, asked: number): number | null {
  if (!/max_(?:output_)?tokens|(?:output|completion) tokens/i.test(message)) return null
  const m = /at most (\d+)|<=\s*(\d+)|(\d+),? which is the maximum/i.exec(message)
  const limit = m ? Number(m[1] ?? m[2] ?? m[3]) : OUTPUT_LIMIT_FALLBACK
  return limit > 0 && limit < asked ? limit : null
}

/**
 * The call, and if the model refused it for asking more output than it
 * allows, the call once more at the model's own limit. Models' limits differ
 * and change, and the model lists are live, so this asks rather than keeps a
 * table. `refusal` is the provider's bad-request message, or null.
 */
export async function withinOutputLimit<T>(req: AiRequest, call: (req: AiRequest) => Promise<T>, refusal: (e: unknown) => string | null): Promise<T> {
  try {
    return await call(req)
  } catch (e) {
    const message = refusal(e)
    const limit = message !== null && req.maxTokens ? outputLimitIn(message, req.maxTokens) : null
    if (limit === null) throw e
    return call({ ...req, maxTokens: limit })
  }
}

export interface ProviderConfig {
  apiKey?: string
  baseUrl?: string
}

/** Sensible default model per provider. Anthropic per current guidance; others resolved live. */
export const DEFAULT_MODEL: Record<AiProviderId, string> = {
  anthropic: 'claude-opus-5-5',
  openai: '',
  grok: '',
  ollama: '',
}
