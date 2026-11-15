// Countdown beeps during rides. Created once in the composition root, it
// follows each workout or FTP test's plan tick and plays what
// @core/ride/countdown asks for. It is separate from the coach on purpose:
// muting or switching off the coach leaves the beeps on.
import { IntervalCountdown, type Beep } from '@core/ride/countdown'
import type { RideSession } from '@core/ride/session'
import type { RideKind } from '@core/ride/types'
import type { Clock } from '@core/time/clock'
import type { AppSettings } from '@shared/settings'

export type BeepSession = Pick<RideSession, 'planTick' | 'currentState' | 'kind'>

/**
 * The rides with intervals worth counting down. A route's segments are its km
 * markers (or laps) and their "remaining" is an arrival estimate: counting
 * those down would beep every couple of minutes for nothing.
 */
const COUNTED: ReadonlySet<RideKind> = new Set(['workout', 'ftp-test'])

/** The countdown as it sounds in a ride: three ticks a second apart, then the go. */
const PREVIEW: readonly Beep[] = ['tick', 'tick', 'tick', 'go']
const PREVIEW_GAP_MS = 1000

export interface BeepRuntimeDeps {
  rides: { onSessionStart(listener: (session: BeepSession) => void): () => void }
  engine: { onTick(fn: (now: number) => void): () => void }
  /** Time-warped rides stay silent: their seconds go by faster than a beep lasts. */
  clock: Pick<Clock, 'warp'>
  settings: () => AppSettings
  play: (beep: Beep, volume: number) => void
}

export class BeepRuntime {
  private offStart: (() => void) | null = null
  private offTick: (() => void) | null = null
  private previewTimers: ReturnType<typeof setTimeout>[] = []

  constructor(private readonly deps: BeepRuntimeDeps) {}

  start(): void {
    if (this.offStart) return
    this.offStart = this.deps.rides.onSessionStart((s) => this.follow(s))
  }

  stop(): void {
    this.offStart?.()
    this.offStart = null
    this.release()
    this.stopPreview()
  }

  /** The settings page's Test: the countdown at the set volume. Pressed again, it starts over rather than overlapping. */
  preview(): void {
    this.stopPreview()
    this.previewTimers = PREVIEW.map((b, i) => setTimeout(() => this.deps.play(b, this.deps.settings().beeps.volume), i * PREVIEW_GAP_MS))
  }

  private stopPreview(): void {
    for (const t of this.previewTimers) clearTimeout(t)
    this.previewTimers = []
  }

  private follow(session: BeepSession): void {
    this.release()
    if (!COUNTED.has(session.kind) || this.deps.clock.warp > 1) return
    const countdown = new IntervalCountdown()
    this.offTick = this.deps.engine.onTick(() => {
      const state = session.currentState
      const tick = session.planTick
      // always fed, so switching the beeps on mid-ride picks up cleanly
      const beeps = countdown.tick({
        riding: state === 'riding',
        finished: tick.finished,
        segmentIndex: tick.segmentIndex,
        segmentRemainingS: tick.segmentRemainingS,
        segmentElapsedS: tick.segmentElapsedS,
      })
      const prefs = this.deps.settings().beeps
      if (prefs.enabled) for (const b of beeps) this.deps.play(b, prefs.volume)
      if (state === 'finished') this.release()
    })
  }

  private release(): void {
    this.offTick?.()
    this.offTick = null
  }
}
