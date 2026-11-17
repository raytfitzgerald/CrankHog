import { describe, expect, it } from 'vitest'
import { PLAN_IMPORT_SYSTEM } from '@core/ai/prompts'
import { PURPOSE_DEFAULTS } from '@core/ai/types'
import { CHUNK_MAX, chunkDocument, planImportInput } from '@core/plan-import/chunk'
import { contextWindow, sizes } from './ollama'

const req = (chars: number, maxTokens?: number) => ({ system: 'x'.repeat(1000), messages: [{ role: 'user' as const, content: 'x'.repeat(chars) }], maxTokens })

describe('contextWindow', () => {
  it('asks for at least 8k tokens', () => {
    expect(contextWindow(req(100, 1500))).toBe(8192)
  })

  it('makes room for a long prompt and a reply, in powers of two', () => {
    // 41 000 characters is about 13 700 tokens, plus 4096 for the reply
    expect(contextWindow(req(40_000, 16_000))).toBe(32_768)
  })

  it('stops at 64k', () => {
    expect(contextWindow(req(1_000_000))).toBe(65_536)
  })
})

describe('a plan document part', () => {
  const { maxTokens, replyTokens } = PURPOSE_DEFAULTS['plan-import']
  /** The request for a document's last part, as readWithAi sends it: with the document's start as context when there's more than one. */
  const part = (text: string) => {
    const { context, chunks } = chunkDocument(text)
    const input = planImportInput({ fileName: 'plan.pdf', today: '2027-01-01', chunk: chunks.at(-1)!, part: chunks.length, parts: chunks.length, context })
    return { system: PLAN_IMPORT_SYSTEM, messages: [{ role: 'user' as const, content: input }], maxTokens, replyTokens }
  }
  const week = (n: number, chars: number) => `Week ${n}\n${'Tue: sweet spot 3x12 at 90 %. Sat: long ride 3h. '.repeat(Math.ceil(chars / 50))}`.slice(0, chars)

  it('gets room for its long answer: 32k for a full part, 16k for a short document', () => {
    const full = part([`Coach plan. ${'Notes on the plan. '.repeat(120)}`, week(1, CHUNK_MAX - 100), week(2, CHUNK_MAX - 100)].join('\n\n'))
    expect(full.messages[0]!.content.length).toBeGreaterThan(CHUNK_MAX)
    expect(contextWindow(full)).toBe(32_768)
    expect(contextWindow(part(week(1, 2000)))).toBe(16_384)
  })

  it('asks for no more reply than the window has left, so a reply that won’t fit stops cleanly', () => {
    const short = part(week(1, 2000))
    const { num_ctx, num_predict } = sizes(short, 8192)
    expect(num_ctx).toBe(16_384)
    expect(num_predict).toBeLessThan(maxTokens)
    expect(num_predict + Math.ceil((short.system.length + short.messages[0]!.content.length) / 3)).toBe(num_ctx)
    // a short call asks what it always did
    expect(sizes({ system: 'x', messages: [], maxTokens: 1500 }, 2048)).toEqual({ num_ctx: 8192, num_predict: 1500 })
    expect(sizes({ system: 'x', messages: [] }, 2048)).toEqual({ num_ctx: 8192, num_predict: 2048 })
  })
})
