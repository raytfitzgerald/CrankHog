// CrankHog's side of the Claude add-on: a Unix socket the add-on connects
// to (resources/mcp/crankhog-mcp.mjs), and the mcp.json beside it that tells
// the add-on where the socket is, what the tools are, and which app to open.
//
// It is a door into the rider's training, so:
//  * off until the rider turns Claude on in Settings; turning it off removes
//    the socket and mcp.json
//  * a Unix socket in a folder only the rider's account can open (0700), the
//    socket itself 0600: nothing on the network, nothing another user reaches
//  * every message checked with zod, every tool input against its schema, and
//    a tool that changes things refused unless the rider allows changes
import { createHash } from 'node:crypto'
import { chmodSync, copyFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { createServer, type Server, type Socket } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MCP_INSTRUCTIONS, mcpTool, mcpToolList, readInput } from '@core/mcp/tools'
import { LineReader, WireRequestSchema } from '@core/mcp/wire'

export interface McpCallResult {
  text: string
  isError: boolean
}

export interface McpServerOptions {
  /** userData/mcp: mcp.json, the add-on's copy for Claude Code, and the socket when its path is short enough. */
  dir: string
  /** The add-on script shipped with the app (resources/mcp/crankhog-mcp.mjs). */
  bridgeSource: string
  /** The CrankHog.app the add-on opens when CrankHog is closed; null in development. */
  appPath: string | null
  allowChanges: () => boolean
  /** Runs a tool in the page, its input already checked. */
  call: (name: string, args: unknown) => Promise<McpCallResult>
  onChange?: () => void
}

export interface McpServerState {
  running: boolean
  clients: number
  error: string | null
}

/** macOS keeps a socket path under 104 bytes. */
const MAX_SOCKET_PATH = 100

/** The socket's path: in the folder when it fits, else in the rider's own temp folder. */
export function socketPathFor(dir: string): string {
  const inDir = join(dir, 'crankhog.sock')
  if (Buffer.byteLength(inDir) <= MAX_SOCKET_PATH) return inDir
  return join(tmpdir(), `crankhog-${createHash('sha256').update(dir).digest('hex').slice(0, 12)}.sock`)
}

/** The add-on's copy for Claude Code, kept in the folder so its path never changes with the app's. */
export const bridgeCopyPath = (dir: string) => join(dir, 'crankhog-mcp.mjs')

export class McpSocketServer {
  private server: Server | null = null
  private readonly sockets = new Set<Socket>()
  private error: string | null = null
  readonly socketPath: string

  constructor(private readonly o: McpServerOptions) {
    this.socketPath = socketPathFor(o.dir)
  }

  state(): McpServerState {
    return { running: this.server !== null, clients: this.sockets.size, error: this.error }
  }

  async start(): Promise<void> {
    if (this.server) return
    try {
      mkdirSync(this.o.dir, { recursive: true, mode: 0o700 })
      chmodSync(this.o.dir, 0o700)
      copyFileSync(this.o.bridgeSource, bridgeCopyPath(this.o.dir))
      // one CrankHog per profile (the single-instance lock), so a socket left here is from a crash
      rmSync(this.socketPath, { force: true })
      const server = createServer((s) => this.accept(s))
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject)
        server.listen(this.socketPath, () => {
          server.off('error', reject)
          resolve()
        })
      })
      chmodSync(this.socketPath, 0o600)
      server.on('error', (e) => {
        this.error = e.message
        this.o.onChange?.()
      })
      this.server = server
      this.error = null
      this.writeManifest()
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e)
      console.error('[mcp] could not start', e)
    }
    this.o.onChange?.()
  }

  /**
   * Stops serving. `off`: the rider turned Claude off, so mcp.json goes too
   * and the add-on says so rather than opening CrankHog. On quit it stays, so
   * the add-on can open CrankHog when Claude next needs it.
   */
  async stop(off: boolean): Promise<void> {
    const server = this.server
    this.server = null
    for (const s of this.sockets) s.destroy()
    this.sockets.clear()
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()))
    rmSync(this.socketPath, { force: true })
    if (off) rmSync(join(this.o.dir, 'mcp.json'), { force: true })
    this.o.onChange?.()
  }

  /** What Claude may do changed: mcp.json is rewritten and connected add-ons told to list the tools again. */
  toolsChanged(): void {
    if (!this.server) return
    this.writeManifest()
    for (const s of this.sockets) s.write(`${JSON.stringify({ event: 'tools-changed' })}\n`)
  }

  private writeManifest(): void {
    const manifest = { socket: this.socketPath, app: this.o.appPath, instructions: MCP_INSTRUCTIONS, tools: mcpToolList(this.o.allowChanges()) }
    writeFileSync(join(this.o.dir, 'mcp.json'), JSON.stringify(manifest), { mode: 0o600 })
  }

  private accept(s: Socket): void {
    this.sockets.add(s)
    this.o.onChange?.()
    s.setEncoding('utf8')
    const reader = new LineReader((line) => void this.onLine(s, line))
    s.on('data', (chunk: string) => {
      if (!reader.push(chunk)) s.destroy()
    })
    s.on('error', () => undefined)
    s.on('close', () => {
      this.sockets.delete(s)
      this.o.onChange?.()
    })
  }

  private async onLine(s: Socket, line: string): Promise<void> {
    const write = (msg: object) => {
      if (!s.destroyed) s.write(`${JSON.stringify(msg)}\n`)
    }
    let raw: unknown
    try {
      raw = JSON.parse(line)
    } catch {
      return
    }
    const req = WireRequestSchema.safeParse(raw)
    if (!req.success) {
      const id = typeof (raw as { id?: unknown })?.id === 'number' ? (raw as { id: number }).id : null
      if (id !== null) write({ id, error: 'CrankHog did not understand that request.' })
      return
    }
    const { id } = req.data
    if (req.data.method === 'list') return write({ id, tools: mcpToolList(this.o.allowChanges()), instructions: MCP_INSTRUCTIONS })
    const { name } = req.data
    const tool = mcpTool(name, this.o.allowChanges())
    if (!tool) {
      const known = mcpTool(name, true)
      return known
        ? write({ id, text: 'The athlete has not let Claude change things in CrankHog. They can allow it in CrankHog: Settings, AI, Claude.', isError: true })
        : write({ id, error: `CrankHog has no tool named ${name}.` })
    }
    const args = readInput(tool, req.data.arguments)
    if (!args.ok) return write({ id, text: args.error, isError: true })
    try {
      write({ id, ...(await this.o.call(name, args.value)) })
    } catch (e) {
      write({ id, text: e instanceof Error ? e.message : String(e), isError: true })
    }
  }
}
