import { describe, expect, it } from 'vitest'
import { contextWindow } from './ollama'

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
