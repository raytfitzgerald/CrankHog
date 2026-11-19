import { useEffect, useState } from 'react'
import { CircleAlert, Loader2, Sparkles } from 'lucide-react'
import { bridge } from '../../platform/bridge'
import { Button } from '../../ui/Button'
import { Input } from '../../ui/form'
import type { AiDraft } from './ai-draft'

/** Longest request sent to the model. */
const MAX_REQUEST = 500

/**
 * "Describe a workout": plain English → a draft in the builder (a bike
 * workout, a run or a swim: `ask` sends the request and reads the answer).
 * Shown only when a provider is configured. The draft opens unsaved and is
 * never saved here.
 */
export function AiPanel<T>({ placeholder, ask, onDrafted }: { placeholder: string; ask: (request: string) => Promise<AiDraft<T>>; onDrafted: (value: T, model: string | null) => void }) {
  const [available, setAvailable] = useState(false)
  const [request, setRequest] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    bridge()
      .invoke('ai.status', {})
      .then((s) => {
        if (live) setAvailable(s.provider !== null && s.configured)
      })
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [])

  if (!available) return null

  const draft = async () => {
    const text = request.trim()
    if (!text || busy) return
    setBusy(true)
    setError(null)
    try {
      const r = await ask(text)
      if ('error' in r) setError(r.error)
      else onDrafted(r.value, r.model)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-panel p-4" aria-label="Describe a workout" data-testid="builder-ai">
      <div className="flex items-center gap-2 font-display text-base font-semibold">
        <Sparkles className="size-4 text-accent" aria-hidden /> Describe a workout
      </div>
      <p className="mt-0.5 text-xs text-ink-dim">The AI drafts it here for you to check and adjust. Nothing is saved until you press Save.</p>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void draft()
        }}
      >
        <Input
          value={request}
          onChange={(e) => setRequest(e.target.value.slice(0, MAX_REQUEST))}
          placeholder={placeholder}
          aria-label="Describe the workout you want"
          disabled={busy}
          data-testid="builder-ai-input"
        />
        <Button type="submit" variant="primary" disabled={busy || request.trim() === ''} className="shrink-0" data-testid="builder-ai-draft">
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Sparkles className="size-4" aria-hidden />}
          {busy ? 'Drafting…' : 'Draft it'}
        </Button>
      </form>
      {error && (
        <div role="alert" className="mt-2 flex items-start gap-2 rounded-xl border border-bad/40 bg-bad/10 px-3 py-2 text-xs text-ink" data-testid="builder-ai-error">
          <CircleAlert className="mt-0.5 size-3.5 shrink-0 text-bad" aria-hidden />
          <span>
            <span className="font-medium">Couldn't draft it:</span> {error}
          </span>
        </div>
      )}
    </section>
  )
}
