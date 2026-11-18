import { describe, expect, it } from 'vitest'
import { MCP_INSTRUCTIONS, MCP_TOOLS, mcpTool, mcpToolList, readInput } from './tools'

// Claude Code cuts a server's instructions and each tool's description at 4,096 characters.
const CLAUDE_CODE_LIMIT = 4096

describe('MCP tools', () => {
  it('lists the reads only, until the rider allows changes', () => {
    expect(mcpToolList(false).map((t) => t.name)).toEqual(['get_training', 'get_calendar', 'list_workouts', 'check_changes', 'check_plan'])
    expect(mcpToolList(true).map((t) => t.name)).toEqual(MCP_TOOLS.map((t) => t.name))
  })

  it('finds a tool only when it may be called', () => {
    expect(mcpTool('make_changes', false)).toBeUndefined()
    expect(mcpTool('make_changes', true)?.name).toBe('make_changes')
    expect(mcpTool('get_training', false)?.name).toBe('get_training')
    expect(mcpTool('rm_rf', true)).toBeUndefined()
  })

  it('gives every tool an object input schema and honest hints', () => {
    for (const t of mcpToolList(true)) {
      expect(t.name).toMatch(/^[a-z_]{1,64}$/)
      expect(t.inputSchema.type).toBe('object')
      expect(t.inputSchema.$schema).toBeUndefined()
      const def = MCP_TOOLS.find((d) => d.name === t.name)!
      expect(t.annotations.readOnlyHint).toBe(!def.changes)
      expect(t.annotations.openWorldHint).toBe(false)
    }
    const hint = (name: string) => mcpToolList(true).find((t) => t.name === name)!.annotations
    expect(hint('make_changes').destructiveHint).toBe(true)
    expect(hint('undo_change').destructiveHint).toBe(true)
    expect(hint('save_plan').destructiveHint).toBe(false)
  })

  it("fits within Claude Code's limits", () => {
    expect(MCP_INSTRUCTIONS.length).toBeLessThanOrEqual(CLAUDE_CODE_LIMIT)
    for (const t of MCP_TOOLS) expect(t.description.length, t.name).toBeLessThanOrEqual(CLAUDE_CODE_LIMIT)
  })

  it("reads changes as the coach chat does, tidying case and aliases", () => {
    const r = readInput(mcpTool('make_changes', true)!, { summary: 'Squash', actions: [{ type: 'Add_Session', date: '2026-12-01', sport: 'Ride', name: 'Spin', minutes: 45, effort: 'Easy' }] })
    expect(r).toMatchObject({ ok: true, value: { actions: [{ type: 'add_session', sport: 'bike', effort: 'easy' }] } })
    expect(readInput(mcpTool('make_changes', true)!, { summary: 'Nothing', actions: [] })).toEqual({ ok: false, error: 'That has no changes.' })
    expect(readInput(mcpTool('get_calendar', true)!, { from: 1 })).toMatchObject({ ok: false, error: expect.stringMatching(/^That input doesn't fit get_calendar: from/) })
  })

  it('checks inputs with the coach chat and plan schemas', () => {
    expect(mcpTool('make_changes', true)!.schema.safeParse({ summary: 'Rest', actions: [{ type: 'days_off', kind: 'rest', from: '2026-12-01', to: '2026-12-01' }] }).success).toBe(true)
    expect(mcpTool('make_changes', true)!.schema.safeParse({ actions: 'everything' }).success).toBe(false)
    expect(mcpTool('save_plan', true)!.schema.safeParse({ name: 'Base', sessions: [] }).success).toBe(false)
    expect(mcpTool('get_calendar', true)!.schema.safeParse({ from: '2026-12-01', to: '2026-12-31' }).success).toBe(true)
  })
})
