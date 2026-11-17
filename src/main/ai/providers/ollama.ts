// Local models via Ollama (free, offline). One client per request so an
// abort only cancels that request (Ollama's abort() kills a client's streams).
import { Ollama } from 'ollama'
import { z } from 'zod'
import { AiError, type AiRequest, type AiResult } from '@core/ai/types'
import type { AiProvider, CallOpts, ProviderConfig } from '../provider'

export const OLLAMA_DEFAULT_HOST = 'http://127.0.0.1:11434'

/**
 * The context window to ask Ollama for. Its default is a few thousand tokens
 * and it silently cuts the front off anything longer: the system prompt, and
 * the coach chat's training data with it. Room for the prompt (about three
 * characters a token, for JSON) and a reply, in powers of two so the model
 * isn't reloaded for every size.
 */
export function contextWindow(req: AiRequest): number {
  const chars = req.system.length + req.messages.reduce((n, m) => n + m.content.length, 0)
  const need = Math.ceil(chars / 3) + Math.min(req.maxTokens ?? 4096, 4096)
  let ctx = 8192
  while (ctx < need && ctx < 65_536) ctx *= 2
  return ctx
}

export class OllamaProvider implements AiProvider {
  readonly id = 'ollama' as const
  private readonly host: string

  constructor(cfg: ProviderConfig) {
    this.host = cfg.baseUrl || OLLAMA_DEFAULT_HOST
  }

  private client(): Ollama {
    return new Ollama({ host: this.host })
  }

  async listModels(signal: AbortSignal): Promise<string[]> {
    const c = this.client()
    const res = await withAbort(c, signal, () => c.list())
    return res.models.map((m) => m.name).sort()
  }

  private messages(req: AiRequest) {
    return [{ role: 'system', content: req.system }, ...req.messages.map((m) => ({ role: m.role, content: m.content }))]
  }

  async complete(req: AiRequest, opts: CallOpts): Promise<AiResult> {
    const c = this.client()
    const r = await withAbort(c, opts.signal, () =>
      c.chat({ model: opts.model, messages: this.messages(req), stream: false, options: { num_predict: req.maxTokens ?? 2048, num_ctx: contextWindow(req) } }),
    )
    return { text: r.message.content, model: r.model, usage: { inputTokens: r.prompt_eval_count, outputTokens: r.eval_count } }
  }

  async stream(req: AiRequest, opts: CallOpts, onDelta: (text: string) => void): Promise<AiResult> {
    const c = this.client()
    const it = await withAbort(c, opts.signal, () =>
      c.chat({ model: opts.model, messages: this.messages(req), stream: true, options: { num_predict: req.maxTokens ?? 4096, num_ctx: contextWindow(req) } }),
    )
    const onAbort = () => it.abort()
    opts.signal.addEventListener('abort', onAbort, { once: true })
    let text = ''
    try {
      for await (const part of it) {
        if (part.message?.content) {
          text += part.message.content
          onDelta(part.message.content)
        }
      }
    } catch (e) {
      if (opts.signal.aborted) throw new AiError('Cancelled', 'cancelled')
      throw mapError(e)
    } finally {
      opts.signal.removeEventListener('abort', onAbort)
    }
    return { text, model: opts.model }
  }

  async structured(req: AiRequest, schema: z.ZodType, _name: string, opts: CallOpts) {
    const c = this.client()
    const r = await withAbort(c, opts.signal, () =>
      c.chat({ model: opts.model, messages: this.messages(req), stream: false, format: z.toJSONSchema(schema), options: { temperature: 0.4, num_ctx: contextWindow(req) } }),
    )
    let value: unknown
    try {
      value = JSON.parse(r.message.content)
    } catch {
      value = null
    }
    return { value, raw: r.message.content, model: r.model }
  }
}

async function withAbort<T>(c: Ollama, signal: AbortSignal, fn: () => Promise<T>): Promise<T> {
  if (signal.aborted) throw new AiError('Cancelled', 'cancelled')
  const onAbort = () => c.abort()
  signal.addEventListener('abort', onAbort, { once: true })
  try {
    return await fn()
  } catch (e) {
    if (signal.aborted) throw new AiError('Cancelled or timed out', signal.reason instanceof DOMException && signal.reason.name === 'TimeoutError' ? 'timeout' : 'cancelled')
    throw mapError(e)
  } finally {
    signal.removeEventListener('abort', onAbort)
  }
}

function mapError(e: unknown): Error {
  if (e instanceof AiError) return e
  const msg = e instanceof Error ? e.message : String(e)
  if (/ECONNREFUSED|fetch failed/i.test(msg)) return new AiError('Ollama is not running (start it, or check the host in Settings → AI)', 'network')
  if (/not found/i.test(msg)) return new AiError(`Ollama model not found: ${msg}`, 'provider')
  return new AiError(msg, 'provider')
}
