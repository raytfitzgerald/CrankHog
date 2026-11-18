import { describe, expect, it } from 'vitest'
import { COACH_TOOLS, toolJsonSchema } from './coach-tools'
import { extractToolCalls, textToolsPrompt, ToolBlockFilter } from './text-tools'

const call = { tool: 'propose_changes', input: { summary: 'Rest', actions: [{ type: 'days_off', kind: 'rest', from: '2026-11-20', to: '2026-11-20' }] } }

describe('the coach tools', () => {
  it('each have an object input schema a provider takes', () => {
    for (const t of COACH_TOOLS) {
      const s = toolJsonSchema(t)
      expect(s.type).toBe('object')
      expect(s).not.toHaveProperty('$schema')
    }
    expect(COACH_TOOLS.map((t) => t.name)).toEqual(['propose_changes', 'draft_plan', 'revise_plan'])
    // the proposal's actions are told apart by type
    expect(JSON.stringify(toolJsonSchema(COACH_TOOLS[0]!))).toContain('"const":"set_thresholds"')
  })

  it('are written into the prompt of a model without tool calling, with how to call one', () => {
    const p = textToolsPrompt(COACH_TOOLS)
    expect(p).toContain('```crankhog-tool')
    expect(p).toContain('## draft_plan')
    expect(p).toContain('Input schema: {')
  })
})

describe('extractToolCalls', () => {
  it('takes the call out of the reply', () => {
    const text = `Take tomorrow off.\n\n\`\`\`crankhog-tool\n${JSON.stringify(call)}\n\`\`\`\n`
    expect(extractToolCalls(text, COACH_TOOLS)).toEqual({ text: 'Take tomorrow off.', calls: [{ name: 'propose_changes', input: call.input }] })
  })

  it('reads an unclosed block, a json block holding a call, and arguments as a string', () => {
    expect(extractToolCalls(`Here.\n\`\`\`crankhog-tool\n${JSON.stringify(call)}`, COACH_TOOLS).calls).toHaveLength(1)
    const json = `Here.\n\`\`\`json\n${JSON.stringify({ name: 'draft_plan', arguments: JSON.stringify({ name: 'Plan' }) })}\n\`\`\``
    expect(extractToolCalls(json, COACH_TOOLS)).toEqual({ text: 'Here.', calls: [{ name: 'draft_plan', input: { name: 'Plan' } }] })
  })

  it('leaves other code alone, and drops a tool block it cannot read', () => {
    const code = 'Steps:\n```\n- 10m 60%\n```\n```json\n{"a":1}\n```'
    expect(extractToolCalls(code, COACH_TOOLS)).toEqual({ text: code, calls: [] })
    expect(extractToolCalls('Hi\n```crankhog-tool\n{nope\n```', COACH_TOOLS)).toEqual({ text: 'Hi', calls: [] })
    expect(extractToolCalls(`\`\`\`crankhog-tool\n{"tool":"rm_rf","input":{}}\n\`\`\``, COACH_TOOLS).calls).toEqual([])
  })
})

describe('ToolBlockFilter', () => {
  const run = (deltas: string[]) => {
    const f = new ToolBlockFilter()
    return deltas.map((d) => f.push(d)).join('') + f.flush()
  }

  it('streams the reply and holds back the block, however it is split', () => {
    const text = `Take tomorrow off.\n\n\`\`\`crankhog-tool\n${JSON.stringify(call)}\n\`\`\``
    for (const size of [1, 3, 7, 50]) {
      const parts = text.match(new RegExp(`[\\s\\S]{1,${size}}`, 'g'))!
      expect(run(parts)).toBe('Take tomorrow off.\n\n')
    }
  })

  it('lets other fences and a trailing backtick through', () => {
    expect(run(['Steps:\n``', '`\n- 10m 60%\n```'])).toBe('Steps:\n```\n- 10m 60%\n```')
    expect(run(['ends with `'])).toBe('ends with `')
  })
})
