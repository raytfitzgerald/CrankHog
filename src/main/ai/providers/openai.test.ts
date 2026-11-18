import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { GROK, OPENAI, OpenAiProvider } from './openai'

describe('OpenAI-compatible flavours', () => {
  it('keeps each service to its own chat models', () => {
    const ids = ['gpt-5', 'gpt-image-1', 'o4-mini', 'grok-4.7', 'grok-imagine-image', 'grok-2-vision', 'text-embedding-3']
    expect(ids.filter(OPENAI.chatModel)).toEqual(['gpt-5', 'o4-mini'])
    expect(ids.filter(GROK.chatModel)).toEqual(['grok-4.7'])
  })

  it('points Grok at xAI and names it in errors', () => {
    expect(GROK.baseURL).toBe('https://api.x.ai/v1')
    expect(new OpenAiProvider({ apiKey: 'xai-test' }, GROK).id).toBe('grok')
    expect(() => new OpenAiProvider({}, GROK)).toThrow(/xAI/)
    expect(new OpenAiProvider({ apiKey: 'sk-test' }).id).toBe('openai')
  })
})

describe('a model that allows less output than asked', () => {
  it('is asked once more at the limit its refusal names', async () => {
    const asked: number[] = []
    const server = createServer((req, res) => {
      let body = ''
      req.on('data', (c: Buffer) => (body += c.toString()))
      req.on('end', () => {
        const max = (JSON.parse(body) as { max_output_tokens: number }).max_output_tokens
        asked.push(max)
        res.setHeader('content-type', 'application/json')
        if (max > 16_384) {
          res.statusCode = 400
          res.end(JSON.stringify({ error: { message: `max_output_tokens is too large: ${max}. This model supports at most 16384 completion tokens, whereas you provided ${max}.`, type: 'invalid_request_error', param: 'max_output_tokens', code: null } }))
          return
        }
        const text = JSON.stringify({ name: 'Tempo' })
        res.end(JSON.stringify({ id: 'resp_1', object: 'response', created_at: 0, model: 'gpt-4o-mini', status: 'completed', output: [{ type: 'message', id: 'msg_1', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text, annotations: [] }] }] }))
      })
    })
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
    try {
      const p = new OpenAiProvider({ apiKey: 'sk-test', baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1` })
      const out = await p.structured({ system: 's', messages: [{ role: 'user', content: 'hi' }], maxTokens: 32_000 }, z.object({ name: z.string() }), 'plan_import', { model: 'gpt-4o-mini', signal: new AbortController().signal, timeoutMs: 5000 })
      expect(out.value).toEqual({ name: 'Tempo' })
      expect(asked).toEqual([32_000, 16_384])
    } finally {
      await new Promise((r) => server.close(r))
    }
  })
})

describe('the coach chat’s tools', () => {
  it('are offered as functions, and a streamed function call comes back as a tool call', async () => {
    const { COACH_TOOLS } = await import('@core/ai/coach-tools')
    let body: { tools?: { type: string; name: string; strict: boolean; parameters: { type: string } }[] } = {}
    const events = [
      { type: 'response.output_text.delta', item_id: 'msg_1', output_index: 0, content_index: 0, delta: 'Moving it.', sequence_number: 1, logprobs: [] },
      {
        type: 'response.output_item.done',
        output_index: 1,
        sequence_number: 2,
        item: { type: 'function_call', id: 'fc_1', call_id: 'call_1', name: 'propose_changes', arguments: '{"summary":"Move","actions":[{"type":"move","ref":"c1","to":"2026-11-20"}]}', status: 'completed' },
      },
      { type: 'response.completed', sequence_number: 3, response: { id: 'resp_1', object: 'response', created_at: 0, model: 'gpt-5', status: 'completed', output: [] } },
    ]
    const server = createServer((req, res) => {
      let raw = ''
      req.on('data', (c: Buffer) => (raw += c.toString()))
      req.on('end', () => {
        body = JSON.parse(raw) as typeof body
        res.setHeader('content-type', 'text/event-stream')
        for (const e of events) res.write(`event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`)
        res.end()
      })
    })
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
    try {
      const p = new OpenAiProvider({ apiKey: 'sk-test', baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1` })
      const deltas: string[] = []
      const out = await p.stream({ system: 's', messages: [{ role: 'user', content: 'move it' }], tools: COACH_TOOLS }, { model: 'gpt-5', signal: new AbortController().signal, timeoutMs: 5000 }, (d) => deltas.push(d))
      expect(body.tools?.map((t) => [t.type, t.name, t.strict, t.parameters.type])).toEqual([
        ['function', 'propose_changes', false, 'object'],
        ['function', 'draft_plan', false, 'object'],
        ['function', 'revise_plan', false, 'object'],
      ])
      expect(deltas).toEqual(['Moving it.'])
      expect(out).toMatchObject({ text: 'Moving it.', model: 'gpt-5', toolCalls: [{ name: 'propose_changes', input: { summary: 'Move', actions: [{ type: 'move' }] } }] })
    } finally {
      await new Promise((r) => server.close(r))
    }
  })
})
