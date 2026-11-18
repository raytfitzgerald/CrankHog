import { useEffect, useState } from 'react'
import { CheckCircle2, Copy } from 'lucide-react'
import type { McpStatus } from '@shared/ipc/contract'
import { undoChange, useClaudeChanges } from '../../mcp/changes'
import { bridge } from '../../platform/bridge'
import { patchSettings, useSettings } from '../../stores/settings'
import { Button } from '../../ui/Button'
import { Field, Section, Switch } from '../../ui/form'

const when = (ms: number) => new Date(ms).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

/** Claude Desktop and Claude Code on this Mac, using CrankHog through its add-on (src/main/mcp). Desktop app only. */
export function ClaudeSection() {
  const claude = useSettings((s) => s.claude)
  const changes = useClaudeChanges()
  const [status, setStatus] = useState<McpStatus | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let live = true
    void bridge()
      .invoke('mcp.status', {})
      .then((s) => live && setStatus(s))
      .catch(() => undefined)
    const off = bridge().on('mcp.status', (s) => live && setStatus(s))
    return () => {
      live = false
      off()
    }
  }, [])

  const install = async () => {
    setMsg(null)
    const r = await bridge().invoke('mcp.installDesktop', {})
    setMsg(r.ok ? 'Claude Desktop is asking you to install the CrankHog add-on. Install it there, then ask Claude about your training.' : (r.error ?? "The add-on didn't open."))
  }

  const copy = () => {
    if (!status) return
    void navigator.clipboard
      ?.writeText(status.claudeCode)
      .then(() => setCopied(true))
      .catch(() => undefined)
  }

  const undo = async (id: string) => {
    setMsg(null)
    try {
      await undoChange(id)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e))
    }
  }

  const connected = status?.clients ?? 0

  return (
    <Section
      title="Claude"
      description="Use your training in Claude Desktop and Claude Code on this Mac: ask about it, change your calendar, and build plans together. Claude gets what the coach chat gets, never your name or Strava data. CrankHog has to be open, and Claude opens it when it needs it."
    >
      <Field label="Let Claude use CrankHog" hint="Only apps on this Mac, under your account, can reach it.">
        <Switch checked={claude.enabled} onChange={(v) => void patchSettings({ claude: { ...claude, enabled: v } })} label={claude.enabled ? 'On' : 'Off'} />
        {claude.enabled && status && (
          <div className="mt-2 flex items-center gap-2 text-xs text-ink-dim" data-testid="claude-status">
            {status.error ? (
              <span className="text-bad">It couldn't start: {status.error}</span>
            ) : status.running ? (
              <>
                <CheckCircle2 className="size-3.5 text-good" />
                {connected === 0 ? 'Ready for Claude.' : `Claude is connected${connected > 1 ? ` (${connected})` : ''}.`}
              </>
            ) : (
              'Starting…'
            )}
          </div>
        )}
      </Field>
      <Field label="Claude can make changes" hint="To the calendar, workouts, days off, events, thresholds and plans. Claude asks you before each one, and you can undo any of them below. Off: Claude only reads.">
        <Switch checked={claude.changes} disabled={!claude.enabled} onChange={(v) => void patchSettings({ claude: { ...claude, changes: v } })} label={claude.changes ? 'On' : 'Off'} />
      </Field>
      <Field label="Claude Desktop" hint="Opens the CrankHog add-on in Claude Desktop, which asks you to install it. Once is enough.">
        <div className="pt-1">
          <Button size="sm" variant="primary" disabled={!claude.enabled || !status?.running} onClick={() => void install()} data-testid="claude-install">
            Add to Claude Desktop
          </Button>
        </div>
      </Field>
      <Field label="Claude Code" hint="Run this once in Terminal, and CrankHog is in every Claude Code session. Claude Code runs the add-on with Node.js.">
        {status && (
          <div className="flex items-start gap-2 pt-1">
            <code className="block min-w-0 flex-1 break-all rounded-lg bg-panel-2 px-3 py-2 font-mono text-xs text-ink-dim" data-testid="claude-code-command">
              {status.claudeCode}
            </code>
            <Button size="sm" variant="ghost" onClick={copy} disabled={!claude.enabled} aria-label="Copy the Claude Code command">
              <Copy className="size-4" /> {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
        )}
      </Field>
      {msg && <div className="pb-2 text-sm text-ink-dim">{msg}</div>}
      {changes.length > 0 && (
        <Field label="Changes from Claude" hint="Newest first. Undo takes a change back off your calendar and library.">
          <ul className="space-y-2 pt-1" data-testid="claude-changes">
            {changes.slice(0, 10).map((c) => (
              <li key={c.id} className="flex items-start justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <div className={c.undone ? 'text-ink-faint line-through' : ''}>{c.summary}</div>
                  <div className="text-xs text-ink-faint">{when(c.at)}</div>
                </div>
                {c.undone ? (
                  <span className="shrink-0 pt-0.5 text-xs text-ink-faint">Undone</span>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => void undo(c.id)}>
                    Undo
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </Field>
      )}
    </Section>
  )
}
