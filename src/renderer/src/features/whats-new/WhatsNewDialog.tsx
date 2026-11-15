import { useStore } from 'zustand'
import { releaseNotesUrl } from '@core/whats-new/notes'
import { bridge } from '../../platform/bridge'
import { Button } from '../../ui/Button'
import { Dialog } from '../../ui/Dialog'
import { closeWhatsNew, whatsNewStore } from './whats-new'

// The short release notes after an update. whats-new.ts decides when.

export function WhatsNewDialog() {
  const entries = useStore(whatsNewStore, (s) => s.entries)
  const latest = entries[0]
  if (!latest) return null
  const several = entries.length > 1
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) void closeWhatsNew()
      }}
      title={several ? "What's new in CrankHog" : `What's new in CrankHog ${latest.version}`}
      footer={
        <>
          <Button variant="ghost" onClick={() => void bridge().invoke('files.openUrl', { url: releaseNotesUrl(latest.version) })}>
            Read the full notes
          </Button>
          <Button variant="primary" onClick={() => void closeWhatsNew()} data-testid="whats-new-close">
            Close
          </Button>
        </>
      }
    >
      <div className="max-h-[60vh] space-y-5 overflow-auto" data-testid="whats-new">
        {entries.map((n) => (
          <section key={n.version}>
            {several && <div className="eyebrow mb-1 text-ink-faint">{n.version}</div>}
            <p className="font-display text-base font-semibold text-ink">{n.title}</p>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink-dim">
              {n.points.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Dialog>
  )
}
