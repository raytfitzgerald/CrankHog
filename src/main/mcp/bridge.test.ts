// The Claude add-on (resources/mcp/crankhog-mcp.mjs) driven by the official
// MCP client, as Claude Desktop and Claude Code drive it: over stdio, with
// the initialize handshake, against the app's real socket server.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { EmptyResultSchema, ToolListChangedNotificationSchema } from '@modelcontextprotocol/sdk/types.js'
import { afterEach, describe, expect, it } from 'vitest'
import { McpSocketServer } from './server'

const BRIDGE = join(__dirname, '../../../resources/mcp/crankhog-mcp.mjs')
const cleanups: (() => Promise<void> | void)[] = []

afterEach(async () => {
  for (const c of cleanups.splice(0).reverse()) await c()
})

function folder(): string {
  const root = mkdtempSync(join(tmpdir(), 'ch-bridge-'))
  cleanups.push(() => rmSync(root, { recursive: true, force: true }))
  return join(root, 'mcp')
}

async function claude(dir: string): Promise<Client> {
  const transport = new StdioClientTransport({ command: process.execPath, args: [BRIDGE, '--dir', dir], stderr: 'pipe' })
  const c = new Client({ name: 'test-claude', version: '1.0.0' })
  await c.connect(transport)
  cleanups.push(() => c.close())
  return c
}

async function app(dir: string, allow = true) {
  const calls: { name: string; args: unknown }[] = []
  let allowChanges = allow
  const server = new McpSocketServer({
    dir,
    bridgeSource: BRIDGE,
    appPath: null,
    allowChanges: () => allowChanges,
    call: async (name, args) => {
      calls.push({ name, args })
      return name === 'make_changes' ? { text: 'Nothing was changed. That day has passed.', isError: true } : { text: `{"tool":"${name}"}`, isError: false }
    },
  })
  await server.start()
  cleanups.push(() => server.stop(true))
  return { server, calls, allow: (v: boolean) => (allowChanges = v) }
}

describe('the Claude add-on', () => {
  it('shakes hands, lists the tools and passes calls to CrankHog', async () => {
    const dir = folder()
    const { calls } = await app(dir)
    const c = await claude(dir)
    expect(c.getServerVersion()).toMatchObject({ name: 'crankhog', title: 'CrankHog' })
    expect(c.getServerCapabilities()?.tools).toEqual({ listChanged: true })
    expect(c.getInstructions()).toMatch(/get_training/)
    const { tools } = await c.listTools()
    expect(tools.map((t) => t.name)).toEqual(['get_training', 'get_calendar', 'list_workouts', 'check_changes', 'make_changes', 'check_plan', 'save_plan', 'undo_change'])
    expect(tools.find((t) => t.name === 'get_training')?.annotations?.readOnlyHint).toBe(true)

    const r = await c.callTool({ name: 'get_calendar', arguments: { from: '2026-12-01', to: '2026-12-31', steps: true } })
    expect(r).toEqual({ content: [{ type: 'text', text: '{"tool":"get_calendar"}' }], isError: false })
    expect(calls).toEqual([{ name: 'get_calendar', args: { from: '2026-12-01', to: '2026-12-31', steps: true } }])

    // a tool's own failure is a result Claude reads, not a protocol error
    const failed = await c.callTool({ name: 'make_changes', arguments: { summary: 'Rest', actions: [{ type: 'days_off', kind: 'rest', from: '2026-01-01', to: '2026-01-01' }] } })
    expect(failed).toMatchObject({ isError: true, content: [{ type: 'text', text: 'Nothing was changed. That day has passed.' }] })

    await expect(c.callTool({ name: 'no_such_tool', arguments: {} })).rejects.toThrow(/no tool named no_such_tool/)
    await expect(c.ping()).resolves.toBeDefined()
  })

  it('tells Claude when the rider changes what it may do', async () => {
    const dir = folder()
    const { server, allow } = await app(dir, false)
    const c = await claude(dir)
    expect((await c.listTools()).tools.map((t) => t.name)).not.toContain('make_changes')
    const changed = new Promise<void>((resolve) => c.setNotificationHandler(ToolListChangedNotificationSchema, () => resolve()))
    // the add-on connects after the handshake; give it a moment
    await new Promise((r) => setTimeout(r, 200))
    allow(true)
    server.toolsChanged()
    await changed
    expect((await c.listTools()).tools.map((t) => t.name)).toContain('make_changes')
  })

  it('with CrankHog closed, still lists its tools and says to open it', async () => {
    const dir = folder()
    const { server } = await app(dir)
    await server.stop(false) // quit: mcp.json stays, the socket goes
    const c = await claude(dir)
    expect((await c.listTools()).tools).toHaveLength(8)
    const r = await c.callTool({ name: 'get_training', arguments: {} })
    expect(r.isError).toBe(true)
    expect(JSON.stringify(r.content)).toMatch(/isn't open/)
  })

  it('with Claude turned off in CrankHog, offers nothing and says where to turn it on', async () => {
    const dir = folder()
    const c = await claude(dir)
    expect((await c.listTools()).tools).toEqual([])
    const r = await c.callTool({ name: 'get_training', arguments: {} })
    expect(JSON.stringify(r.content)).toMatch(/turned off in CrankHog/)
  })

  it('answers a method it does not know at once, as a newer client probing expects', async () => {
    const dir = folder()
    const c = await claude(dir)
    await expect(c.request({ method: 'server/discover', params: {} }, EmptyResultSchema)).rejects.toThrow(/Method not found/)
  })
})
