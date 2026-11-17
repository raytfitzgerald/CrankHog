import { describe, expect, it } from 'vitest'
import type { AiRequest } from '@core/ai/types'
import { outputLimitIn, withinOutputLimit } from './provider'
import { sizes } from './providers/ollama'

describe('outputLimitIn', () => {
  it('reads the limit a provider names when a model allows less output than was asked', () => {
    expect(outputLimitIn('400 max_output_tokens is too large: 32000. This model supports at most 16384 completion tokens, whereas you provided 32000.', 32_000)).toBe(16_384)
    expect(outputLimitIn("400 Invalid 'max_output_tokens': integer above maximum value. Expected a value <= 16384, but got 32000 instead.", 32_000)).toBe(16_384)
    expect(outputLimitIn('400 max_tokens: 32000 > 8192, which is the maximum allowed number of output tokens for claude-3-5-haiku-20241022', 32_000)).toBe(8192)
    // the refusal is about output tokens but names no number: gpt-4o's limit
    expect(outputLimitIn('400 max_output_tokens is too large for this model', 32_000)).toBe(16_384)
  })

  it('is null for any other refusal, or a limit no lower than what was asked', () => {
    expect(outputLimitIn("400 Invalid schema for response_format 'plan_import'", 32_000)).toBeNull()
    expect(outputLimitIn('400 max_output_tokens is too large: 20000. This model supports at most 16384 completion tokens', 16_000)).toBeNull()
  })
})

describe('withinOutputLimit', () => {
  const req: AiRequest = { system: 's', messages: [], maxTokens: 32_000 }
  const refusal = (e: unknown) => (e instanceof Error && e.name === 'BadRequest' ? e.message : null)
  const tooMuch = Object.assign(new Error('max_output_tokens is too large: 32000. This model supports at most 16384 completion tokens'), { name: 'BadRequest' })

  it('asks once more at the model’s own limit', async () => {
    const asked: (number | undefined)[] = []
    const out = await withinOutputLimit(
      req,
      async (q) => {
        asked.push(q.maxTokens)
        if (q.maxTokens! > 16_384) throw tooMuch
        return 'read'
      },
      refusal,
    )
    expect(out).toBe('read')
    expect(asked).toEqual([32_000, 16_384])
  })

  it('throws any other error as it is, and asks again only once', async () => {
    const other = Object.assign(new Error('Invalid schema'), { name: 'BadRequest' })
    let calls = 0
    await expect(withinOutputLimit(req, async () => (calls++, Promise.reject(other)), refusal)).rejects.toBe(other)
    expect(calls).toBe(1)
    calls = 0
    await expect(withinOutputLimit(req, async () => (calls++, Promise.reject(tooMuch)), refusal)).rejects.toBe(tooMuch)
    expect(calls).toBe(2)
  })
})

describe('Ollama sizes', () => {
  it('gives the answer its room, and the context window only a call that asks for one', () => {
    expect(sizes({ maxTokens: 32_000, contextTokens: 32_768 })).toEqual({ num_predict: 32_000, num_ctx: 32_768 })
    expect(sizes({ maxTokens: 8000 })).toEqual({ num_predict: 8000 })
  })
})
