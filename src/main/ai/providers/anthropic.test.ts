import { describe, expect, it } from 'vitest'
import { toolCallsOf } from './anthropic'

describe('toolCallsOf', () => {
  it('takes the tool_use blocks from a reply, in order, and nothing else', () => {
    const content = [
      { type: 'thinking', thinking: '…' },
      { type: 'text', text: 'Here you go.' },
      { type: 'tool_use', id: 'tu_1', name: 'propose_changes', input: { summary: 's', actions: [] } },
      { type: 'tool_use', id: 'tu_2', name: 'draft_plan', input: { name: 'Plan' } },
    ]
    expect(toolCallsOf(content)).toEqual([
      { name: 'propose_changes', input: { summary: 's', actions: [] } },
      { name: 'draft_plan', input: { name: 'Plan' } },
    ])
    expect(toolCallsOf([{ type: 'text' }])).toEqual([])
  })
})

describe('the coach chat’s tools on Claude', () => {
  it('are offered as tools, and a streamed tool_use comes back as a tool call', async () => {
    const { createServer } = await import('node:http')
    const { COACH_TOOLS } = await import('@core/ai/coach-tools')
    const { AnthropicProvider } = await import('./anthropic')
    let body: { tools?: { name: string; input_schema: { type: string } }[]; tool_choice?: unknown } = {}
    const input = JSON.stringify({ summary: 'Rest', actions: [{ type: 'days_off', kind: 'rest', from: '2026-11-20', to: '2026-11-20' }] })
    const events: [string, unknown][] = [
      ['message_start', { type: 'message_start', message: { id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-opus-5-5', content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 0 } } }],
      ['content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }],
      ['content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Take Friday off.' } }],
      ['content_block_stop', { type: 'content_block_stop', index: 0 }],
      ['content_block_start', { type: 'content_block_start', index: 1, content_block: { type: 'tool_use', id: 'tu_1', name: 'propose_changes', input: {} } }],
      ['content_block_delta', { type: 'content_block_delta', index: 1, delta: { type: 'input_json_delta', partial_json: input.slice(0, 20) } }],
      ['content_block_delta', { type: 'content_block_delta', index: 1, delta: { type: 'input_json_delta', partial_json: input.slice(20) } }],
      ['content_block_stop', { type: 'content_block_stop', index: 1 }],
      ['message_delta', { type: 'message_delta', delta: { stop_reason: 'tool_use', stop_sequence: null }, usage: { output_tokens: 40 } }],
      ['message_stop', { type: 'message_stop' }],
    ]
    const server = createServer((req, res) => {
      let raw = ''
      req.on('data', (c: Buffer) => (raw += c.toString()))
      req.on('end', () => {
        body = JSON.parse(raw) as typeof body
        res.setHeader('content-type', 'text/event-stream')
        for (const [name, data] of events) res.write(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`)
        res.end()
      })
    })
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
    const before = process.env.ANTHROPIC_BASE_URL
    process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${(server.address() as { port: number }).port}`
    try {
      const deltas: string[] = []
      const out = await new AnthropicProvider({ apiKey: 'sk-ant-test' }).stream(
        { system: 's', messages: [{ role: 'user', content: 'I need a rest' }], tools: COACH_TOOLS },
        { model: 'claude-opus-5-5', signal: new AbortController().signal, timeoutMs: 5000 },
        (d) => deltas.push(d),
      )
      expect(body.tools?.map((t) => [t.name, t.input_schema.type])).toEqual([
        ['propose_changes', 'object'],
        ['draft_plan', 'object'],
        ['revise_plan', 'object'],
      ])
      expect(body.tool_choice).toEqual({ type: 'auto' })
      expect(deltas).toEqual(['Take Friday off.'])
      expect(out.text).toBe('Take Friday off.')
      expect(out.toolCalls).toEqual([{ name: 'propose_changes', input: JSON.parse(input) }])
    } finally {
      if (before === undefined) delete process.env.ANTHROPIC_BASE_URL
      else process.env.ANTHROPIC_BASE_URL = before
      await new Promise((r) => server.close(r))
    }
  })
})
