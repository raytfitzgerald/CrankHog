import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs'
import { connect } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { McpSocketServer, socketPathFor, type McpCallResult } from './server'

const BRIDGE = join(__dirname, '../../../resources/mcp/crankhog-mcp.mjs')
const dirs: string[] = []
const servers: McpSocketServer[] = []

afterEach(async () => {
  await Promise.all(servers.splice(0).map((s) => s.stop(true)))
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})

function serve(o: { allowChanges?: boolean; call?: (name: string, args: unknown) => Promise<McpCallResult> } = {}) {
  const dir = join(mkdtempSync(join(tmpdir(), 'ch-mcp-')), 'mcp')
  dirs.push(join(dir, '..'))
  let allow = o.allowChanges ?? true
  const calls: { name: string; args: unknown }[] = []
  const server = new McpSocketServer({
    dir,
    bridgeSource: BRIDGE,
    appPath: '/Applications/CrankHog.app',
    allowChanges: () => allow,
    call: o.call ?? (async (name, args) => (calls.push({ name, args }), { text: `ran ${name}`, isError: false })),
  })
  servers.push(server)
  return { server, dir, calls, setAllow: (v: boolean) => (allow = v) }
}

/** A raw client on the socket: send lines, read answers by id, and events. */
async function client(path: string) {
  const s = connect(path)
  s.setEncoding('utf8')
  await new Promise<void>((resolve, reject) => {
    s.once('connect', resolve)
    s.once('error', reject)
  })
  const got: Record<string, unknown>[] = []
  let buf = ''
  s.on('data', (c: string) => {
    buf += c
    let nl
    while ((nl = buf.indexOf('\n')) !== -1) {
      got.push(JSON.parse(buf.slice(0, nl)) as Record<string, unknown>)
      buf = buf.slice(nl + 1)
    }
  })
  const until = async (pred: (m: Record<string, unknown>) => boolean) => {
    for (let i = 0; i < 200; i++) {
      const m = got.find(pred)
      if (m) return m
      await new Promise((r) => setTimeout(r, 10))
    }
    throw new Error('no answer')
  }
  return {
    ask: (msg: { id: number; [k: string]: unknown }) => {
      s.write(`${JSON.stringify(msg)}\n`)
      return until((m) => m.id === msg.id)
    },
    until,
    close: () => s.destroy(),
  }
}

describe('the MCP socket server', () => {
  it('serves a socket and mcp.json that only the rider can open', async () => {
    const { server, dir } = serve()
    await server.start()
    expect(server.state()).toMatchObject({ running: true, error: null })
    expect(statSync(dir).mode & 0o777).toBe(0o700)
    expect(statSync(server.socketPath).mode & 0o777).toBe(0o600)
    const manifest = JSON.parse(readFileSync(join(dir, 'mcp.json'), 'utf8')) as { socket: string; app: string; tools: { name: string }[]; instructions: string }
    expect(manifest.socket).toBe(server.socketPath)
    expect(manifest.app).toBe('/Applications/CrankHog.app')
    expect(manifest.tools.map((t) => t.name)).toContain('make_changes')
    expect(manifest.instructions).toMatch(/get_training/)
    expect(statSync(join(dir, 'mcp.json')).mode & 0o777).toBe(0o600)
    // the add-on's copy for Claude Code
    expect(readFileSync(join(dir, 'crankhog-mcp.mjs'), 'utf8')).toBe(readFileSync(BRIDGE, 'utf8'))
  })

  it('lists tools, and runs a call with its input checked', async () => {
    const { server, calls } = serve()
    await server.start()
    const c = await client(server.socketPath)
    const list = await c.ask({ id: 1, method: 'list' })
    expect((list.tools as unknown[]).length).toBe(8)
    expect(await c.ask({ id: 2, method: 'call', name: 'get_calendar', arguments: { from: '2026-12-01', to: '2026-12-07' } })).toEqual({ id: 2, text: 'ran get_calendar', isError: false })
    expect(calls).toEqual([{ name: 'get_calendar', args: { from: '2026-12-01', to: '2026-12-07' } }])
    const bad = await c.ask({ id: 3, method: 'call', name: 'get_calendar', arguments: { from: 7 } })
    expect(bad).toMatchObject({ id: 3, isError: true })
    expect(String(bad.text)).toMatch(/doesn't fit get_calendar/)
    expect(calls).toHaveLength(1)
    expect(await c.ask({ id: 4, method: 'call', name: 'format_disk' })).toEqual({ id: 4, error: 'CrankHog has no tool named format_disk.' })
    expect(await c.ask({ id: 5, method: 'eval' })).toEqual({ id: 5, error: 'CrankHog did not understand that request.' })
    c.close()
  })

  it('refuses changes the rider has not allowed, and tells connected add-ons when that changes', async () => {
    const { server, calls, setAllow, dir } = serve({ allowChanges: false })
    await server.start()
    const c = await client(server.socketPath)
    const r = await c.ask({ id: 1, method: 'call', name: 'make_changes', arguments: { summary: 'x', actions: [] } })
    expect(r).toMatchObject({ isError: true })
    expect(String(r.text)).toMatch(/has not let Claude change things/)
    expect(calls).toEqual([])
    expect(((await c.ask({ id: 2, method: 'list' })).tools as { name: string }[]).map((t) => t.name)).not.toContain('make_changes')
    setAllow(true)
    server.toolsChanged()
    await c.until((m) => m.event === 'tools-changed')
    expect((JSON.parse(readFileSync(join(dir, 'mcp.json'), 'utf8')) as { tools: { name: string }[] }).tools.map((t) => t.name)).toContain('make_changes')
    c.close()
  })

  it('answers a call that fails with the error, for Claude to read', async () => {
    const { server } = serve({ call: () => Promise.reject(new Error('The calendar is busy')) })
    await server.start()
    const c = await client(server.socketPath)
    expect(await c.ask({ id: 1, method: 'call', name: 'get_training', arguments: {} })).toEqual({ id: 1, text: 'The calendar is busy', isError: true })
    c.close()
  })

  it('turned off, takes the socket and mcp.json away; on quit, keeps mcp.json for the add-on', async () => {
    const a = serve()
    await a.server.start()
    await a.server.stop(false)
    expect(existsSync(a.server.socketPath)).toBe(false)
    expect(existsSync(join(a.dir, 'mcp.json'))).toBe(true)
    await a.server.start()
    await a.server.stop(true)
    expect(existsSync(join(a.dir, 'mcp.json'))).toBe(false)
  })

  it('keeps a socket path macOS can open', () => {
    expect(socketPathFor('/Users/me/Library/Application Support/CrankHog/mcp')).toBe('/Users/me/Library/Application Support/CrankHog/mcp/crankhog.sock')
    const long = socketPathFor(`/Users/${'x'.repeat(120)}/mcp`)
    expect(Buffer.byteLength(long)).toBeLessThanOrEqual(104)
    expect(long).toMatch(/crankhog-[0-9a-f]{12}\.sock$/)
  })
})
