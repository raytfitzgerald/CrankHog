import { useEffect, useRef, useState } from 'react'
import type { SpinDown, SpinDownFailure, SpinDownState } from '@core/control/spin-down'
import { formatSpeedKmh, speedUnit } from '@core/units'
import { useLive } from '../../stores/live'
import { useRide } from '../../stores/ride'
import { useSettings } from '../../stores/settings'
import { Button } from '../../ui/Button'
import { Dialog } from '../../ui/Dialog'

/** What happened, and what to do next. */
const FAILURE: Record<SpinDownFailure, { heading: string; text: string }> = {
  unsupported: { heading: 'No spin-down on this trainer', text: "This trainer doesn't offer one. Many direct-drive trainers calibrate themselves." },
  'not-permitted': { heading: 'Another app has the trainer', text: 'Zwift, the Wahoo app or a head unit has control of it. Close that app, then try again.' },
  rejected: { heading: 'The trainer refused', text: "It wouldn't start a spin-down. Stop pedalling, wait for the flywheel to stop, then try again." },
  'no-answer': { heading: "The trainer didn't answer", text: "Check that it's still connected, then try again." },
  'trainer-error': { heading: 'The coast-down failed', text: "The trainer couldn't measure it. Once it asks you to stop pedalling, keep your legs still until it finishes." },
  timeout: { heading: 'The trainer never finished', text: 'Speed up a little past the target, then stop pedalling completely.' },
  'control-lost': { heading: 'Another app took the trainer', text: 'Zwift, the Wahoo app or a head unit took control partway through, which stopped the calibration. Close that app, then try again.' },
  'trainer-reset': { heading: 'The trainer reset', text: 'It reset itself partway through, which stopped the calibration. Wait a few seconds, then try again.' },
  disconnected: { heading: "The trainer isn't connected", text: 'Wait for it to reconnect, then try again.' },
  busy: { heading: 'A ride is recording', text: "Finish your ride first. The trainer can't be calibrated while a ride holds it." },
}

/**
 * Spin-down calibration, step by step: warm up, speed up into the trainer's
 * window, stop pedalling and let the flywheel coast, then the result.
 * `create` gives a fresh calibration for the connected trainer.
 */
export function SpinDownDialog({
  open,
  onOpenChange,
  create,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  create: () => SpinDown | SpinDownFailure
}) {
  const [state, setState] = useState<SpinDownState>({ phase: 'idle' })
  const run = useRef<{ sd: SpinDown; off: () => void } | null>(null)
  const busy = useRide((s) => s.active)
  // a free-ride target still held with nothing recording, which starting lets go
  const holding = useLive((f) => f.trainer.mode !== 'idle') && !busy

  const stop = () => {
    run.current?.off()
    run.current?.sd.cancel()
    run.current = null
    setState({ phase: 'idle' })
  }
  useEffect(() => () => stop(), [])

  const start = async () => {
    stop()
    const sd = create()
    if (typeof sd === 'string') return setState({ phase: 'failed', reason: sd })
    run.current = { sd, off: sd.subscribe(setState) }
    await sd.start()
  }

  const close = (o: boolean) => {
    if (!o) stop()
    onOpenChange(o)
  }

  const running = state.phase === 'starting' || state.phase === 'speedUp' || state.phase === 'coast'
  return (
    <Dialog
      open={open}
      onOpenChange={close}
      title="Calibrate trainer"
      description="A spin-down measures how your trainer's flywheel slows down, so its power readings stay accurate."
      footer={
        <>
          <Button variant="ghost" onClick={() => close(false)}>
            {running ? 'Cancel' : 'Close'}
          </Button>
          {state.phase === 'idle' && (
            <Button variant="primary" onClick={() => void start()} disabled={busy}>
              Start calibration
            </Button>
          )}
          {state.phase === 'failed' && state.reason !== 'unsupported' && (
            <Button variant="primary" onClick={() => void start()} disabled={busy}>
              Try again
            </Button>
          )}
        </>
      }
    >
      <div className="min-h-40" data-testid="spin-down">
        <Step state={state} busy={busy} holding={holding} />
      </div>
    </Dialog>
  )
}

function Step({ state, busy, holding }: { state: SpinDownState; busy: boolean; holding: boolean }) {
  switch (state.phase) {
    case 'idle':
      return (
        <div className="space-y-2 text-sm">
          <p>Warm up for 10 minutes first: a cold trainer reads differently. Then start the calibration, speed up to the speed it asks for, and stop pedalling when it says so.</p>
          <p className="text-ink-dim">Wheel-on trainers need this after every change of tyre pressure.</p>
          {busy && <p className="text-bad">{FAILURE.busy.text}</p>}
          {holding && <p className="text-ink-dim">The trainer is still holding your free-ride target. Starting the calibration lets it go.</p>}
        </div>
      )
    case 'starting':
      return <Heading>Asking the trainer…</Heading>
    case 'speedUp':
      return <SpeedUp targetKmh={state.targets?.highKmh ?? null} />
    case 'coast':
      return (
        <div className="space-y-2">
          <Heading>Stop pedalling</Heading>
          <p className="text-sm text-ink-dim">Keep your legs still and let the flywheel coast. The trainer is measuring.</p>
        </div>
      )
    case 'done':
      return (
        <div className="space-y-2">
          <Heading>Calibrated</Heading>
          <p className="text-sm text-ink-dim">The trainer has saved the result. Power readings now account for it.</p>
        </div>
      )
    case 'failed':
      return (
        <div className="space-y-2">
          <Heading>{FAILURE[state.reason].heading}</Heading>
          <p className="text-sm text-ink-dim">{FAILURE[state.reason].text}</p>
        </div>
      )
  }
}

function SpeedUp({ targetKmh }: { targetKmh: number | null }) {
  const units = useSettings((s) => s.speedUnit)
  const kmh = useLive((f) => f.speedKmh)
  const unit = speedUnit(units)
  const pct = targetKmh && kmh !== null ? Math.min(100, (kmh / targetKmh) * 100) : 0
  return (
    <div className="space-y-3">
      <Heading>{targetKmh === null ? 'Speed up' : `Speed up to ${formatSpeedKmh(targetKmh, units)} ${unit}`}</Heading>
      <div className="flex items-baseline gap-2">
        <span className="font-display text-5xl font-semibold tabular" data-testid="spin-down-speed">
          {formatSpeedKmh(kmh, units) ?? '—'}
        </span>
        <span className="eyebrow text-ink-faint">{unit}</span>
      </div>
      {targetKmh !== null && (
        <div className="h-2 rounded-full bg-panel-3" aria-hidden>
          <div className="h-2 rounded-full bg-accent transition-[width]" style={{ width: `${pct}%` }} />
        </div>
      )}
      <p className="text-sm text-ink-dim">{targetKmh === null ? 'Keep going until the trainer tells you to stop.' : 'Go a little past it. The trainer tells you when to stop.'}</p>
    </div>
  )
}

function Heading({ children }: { children: string }) {
  return (
    <h3 className="font-display text-2xl font-semibold" data-testid="spin-down-step">
      {children}
    </h3>
  )
}
