// Takes Claude's tool calls from main (mcp.call) and answers each (mcp.result).
// Started once with the app, in the desktop build only.
import { bridge } from '../platform/bridge'
import { loadClaudeChanges } from './changes'
import { runTool } from './tools'

let started = false

export function startClaudeTools(): void {
  if (started) return
  started = true
  void loadClaudeChanges()
  bridge().on('mcp.call', ({ callId, name, args }) => {
    void runTool(name, args).then(
      (answer) => bridge().invoke('mcp.result', { callId, ...answer }),
      (e: unknown) => bridge().invoke('mcp.result', { callId, text: e instanceof Error ? e.message : String(e), isError: true }),
    )
  })
  void bridge().invoke('mcp.ready', {}).catch(() => undefined)
}
