import { describe, expect, it } from 'vitest'
import { LineReader, WireRequestSchema } from './wire'

describe('the add-on wire', () => {
  it('reads whole lines across chunks, skipping blank ones', () => {
    const lines: string[] = []
    const r = new LineReader((l) => lines.push(l))
    r.push('{"id":1,"meth')
    r.push('od":"list"}\r\n\n{"id":2')
    expect(lines).toEqual(['{"id":1,"method":"list"}'])
    r.push(',"method":"list"}\n')
    expect(lines).toHaveLength(2)
  })

  it('gives up on a line that never ends', () => {
    const r = new LineReader(() => undefined, 10)
    expect(r.push('12345')).toBe(true)
    expect(r.push('678901')).toBe(false)
  })

  it('takes list and call, and nothing else', () => {
    expect(WireRequestSchema.safeParse({ id: 1, method: 'list' }).success).toBe(true)
    expect(WireRequestSchema.safeParse({ id: 2, method: 'call', name: 'get_training', arguments: {} }).success).toBe(true)
    expect(WireRequestSchema.safeParse({ id: 3, method: 'eval', code: '1' }).success).toBe(false)
    expect(WireRequestSchema.safeParse({ id: 'x', method: 'list' }).success).toBe(false)
  })
})
