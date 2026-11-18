// Claude in CrankHog: the socket server for the add-on, run while the rider
// has Claude turned on, and the hand-off of each tool call to the page, where
// the rider's data lives (src/renderer/src/mcp).
import { randomUUID } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app, shell, type BrowserWindow } from 'electron'
import type { McpStatus } from '@shared/ipc/contract'
import { buildAddon, readOptional } from '../mcp/addon'
import { bridgeCopyPath, McpSocketServer, type McpCallResult } from '../mcp/server'
import type { SettingsStore } from '../store/settings-store'
import { emit, handle } from './register'

/** Longer than any tool takes: a year's plan is checked and saved in seconds. */
const CALL_TIMEOUT_MS = 170_000
/** How long a call waits for a page that's still loading (CrankHog was just opened for it). */
const READY_WAIT_MS = 30_000

/** Where the add-on script and icon ship: resources/ beside the app, or the repo's in development. */
function resourcesDir(): string {
  return app.isPackaged ? join(process.resourcesPath, 'resources') : join(app.getAppPath(), 'resources')
}

/** The CrankHog.app this is, for the add-on to open; null when it isn't one (development). */
function appBundle(): string | null {
  if (!app.isPackaged) return null
  const m = /^(.*?\.app)\/Contents\/MacOS\/[^/]+$/.exec(process.execPath)
  return m?.[1] ?? null
}

/** A path as one shell word in double quotes. */
const quote = (s: string) => `"${s.replace(/(["\\$`])/g, '\\$1')}"`

export function registerMcpHandlers(o: { settings: SettingsStore; window: () => BrowserWindow | null; userData: string }): { pageReset: () => void } {
  const dir = join(o.userData, 'mcp')
  const pending = new Map<string, { resolve: (r: McpCallResult) => void; timer: NodeJS.Timeout }>()
  let ready = false
  const waiters: (() => void)[] = []

  const whenReady = () =>
    ready
      ? Promise.resolve(true)
      : new Promise<boolean>((resolve) => {
          const timer = setTimeout(() => resolve(false), READY_WAIT_MS)
          waiters.push(() => {
            clearTimeout(timer)
            resolve(true)
          })
        })

  const call = async (name: string, args: unknown): Promise<McpCallResult> => {
    const w = o.window()
    if (!w || !(await whenReady())) return { text: "CrankHog's window isn't ready. Try again in a moment.", isError: true }
    const callId = randomUUID()
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        pending.delete(callId)
        resolve({ text: 'CrankHog took too long to answer. Try again.', isError: true })
      }, CALL_TIMEOUT_MS)
      pending.set(callId, { resolve, timer })
      emit(w.webContents, 'mcp.call', { callId, name, args })
    })
  }

  const status = (): McpStatus => {
    const s = server.state()
    return {
      enabled: o.settings.get().claude.enabled,
      ...s,
      claudeCode: `claude mcp add --scope user crankhog -- node ${quote(bridgeCopyPath(dir))} --dir ${quote(dir)}`,
    }
  }

  const server = new McpSocketServer({
    dir,
    bridgeSource: join(resourcesDir(), 'mcp', 'crankhog-mcp.mjs'),
    appPath: appBundle(),
    allowChanges: () => o.settings.get().claude.changes,
    call,
    onChange: () => {
      const w = o.window()
      if (w) emit(w.webContents, 'mcp.status', status())
    },
  })

  handle('mcp.status', () => status())
  handle('mcp.ready', () => {
    ready = true
    for (const w of waiters.splice(0)) w()
    return {}
  })
  handle('mcp.result', ({ callId, text, isError }) => {
    const p = pending.get(callId)
    if (p) {
      pending.delete(callId)
      clearTimeout(p.timer)
      p.resolve({ text, isError })
    }
    return {}
  })
  handle('mcp.installDesktop', async () => {
    if (!o.settings.get().claude.enabled) return { ok: false, error: 'Turn on Claude first.' }
    try {
      mkdirSync(dir, { recursive: true, mode: 0o700 })
      const script = readOptional(join(resourcesDir(), 'mcp', 'crankhog-mcp.mjs'))
      if (!script) return { ok: false, error: "This build of CrankHog is missing its Claude add-on." }
      const file = join(dir, 'CrankHog.mcpb')
      writeFileSync(file, buildAddon({ version: app.getVersion(), dir, script, icon: readOptional(join(resourcesDir(), 'mcp', 'icon.png')) }))
      const error = await shell.openPath(file)
      return error ? { ok: false, error: `Claude Desktop didn't open the add-on (${error}). Is Claude Desktop installed?` } : { ok: true }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  })

  let was = o.settings.get().claude
  if (was.enabled) void server.start()
  o.settings.onChange((s) => {
    const now = s.claude
    if (now.enabled !== was.enabled) void (now.enabled ? server.start() : server.stop(true))
    else if (now.changes !== was.changes) server.toolsChanged()
    was = now
  })
  app.on('will-quit', () => void server.stop(false))

  return {
    /** The page reloaded or crashed: calls wait for the new one, and calls in flight are answered now. */
    pageReset: () => {
      ready = false
      for (const [id, p] of pending) {
        clearTimeout(p.timer)
        pending.delete(id)
        p.resolve({ text: 'CrankHog reloaded while answering. Try again.', isError: true })
      }
    },
  }
}
