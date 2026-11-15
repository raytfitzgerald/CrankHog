import { useEffect, useState } from 'react'
import { CalendarArrowDown } from 'lucide-react'
import { importFromIntervals } from '../../plan/intervals-import'
import { bridge } from '../../platform/bridge'
import { Button } from '../../ui/Button'

/** Brings planned rides from the rider's intervals.icu calendar onto this one (Mac app, with an API key set up). */
export function IntervalsImport({ onNotice }: { onNotice: (n: { tone: 'good' | 'bad'; text: string }) => void }) {
  const [configured, setConfigured] = useState(false)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let live = true
    void bridge()
      .invoke('intervals.status', {})
      .then((s) => live && setConfigured(s.configured))
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [])
  if (!configured) return null
  const run = async () => {
    setBusy(true)
    try {
      const r = await importFromIntervals()
      const changed = r.added + r.updated
      onNotice({
        tone: 'good',
        text:
          changed === 0 && r.removed === 0
            ? 'Nothing planned on intervals.icu for the next four weeks.'
            : `${changed} workout${changed === 1 ? '' : 's'} from intervals.icu${r.removed ? `, ${r.removed} removed` : ''}${r.skipped ? `. Skipped ${r.skipped} that aren't structured rides` : ''}.`,
      })
    } catch (e) {
      onNotice({ tone: 'bad', text: `Couldn't import from intervals.icu: ${e instanceof Error ? e.message : String(e)}` })
    } finally {
      setBusy(false)
    }
  }
  return (
    <Button size="sm" onClick={() => void run()} disabled={busy} data-testid="intervals-import" title="Last week and the next four weeks of planned rides">
      <CalendarArrowDown className="size-3.5" /> {busy ? 'Importing…' : 'Import from intervals.icu'}
    </Button>
  )
}
