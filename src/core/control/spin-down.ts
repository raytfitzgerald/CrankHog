// Spin-down calibration. A trainer measures how fast its flywheel coasts
// down from a set speed, and corrects its power readings for the bearings,
// belt and temperature it finds. Wheel-on trainers need it after every
// tyre-pressure change, and direct-drive trainers drift without it, which
// skews ERG and every FTP test.
//
// The FTMS procedure (v1.0 §4.16.2.20 and Table 4.27):
//   1. Spin Down Control (Start): the trainer answers with the speed window
//      the rider has to reach.
//   2. The rider speeds up. Once the flywheel is fast enough the trainer
//      sends Spin Down Status "stop pedalling".
//   3. The rider stops and the flywheel coasts. The trainer sends "success",
//      or "error" (for example if the rider kept pedalling).
//
// This class only follows that procedure and keeps time; the trainer does
// the measuring. Run it with no ride on, so nothing else writes to the
// trainer in the middle. When the app gives up first (the rider cancels, or
// a step takes too long) it tells the trainer to stop, or the trainer could
// stay in its spin down and ignore the next ride's targets.
import type { SpinDownTargets } from '../ble/codecs'
import type { SpinDownCapable, SpinDownStart, SpinDownUpdate } from '../devices/driver'
import type { Cancel, Clock } from '../time/clock'

export type { SpinDownStart }
export type SpinDownTrainer = SpinDownCapable

export type SpinDownFailure =
  /** The trainer has no spin down. */
  | 'unsupported'
  /** Another app holds control of the trainer. */
  | 'not-permitted'
  /** The trainer refused to start one. */
  | 'rejected'
  /** The trainer did not answer the request. */
  | 'no-answer'
  /** The trainer reported that the spin down failed. */
  | 'trainer-error'
  /** The speed was never reached, or the coast never finished. */
  | 'timeout'
  /** Another app took control of the trainer partway through. */
  | 'control-lost'
  /** The trainer reset itself partway through. */
  | 'trainer-reset'
  /** The trainer dropped off, or is not connected (still reconnecting). */
  | 'disconnected'
  /** A ride is recording, and holds the trainer. */
  | 'busy'

export type SpinDownState =
  | { phase: 'idle' }
  | { phase: 'starting' }
  /** Speed up into the window (null when the trainer did not give one: speed up until told to stop). */
  | { phase: 'speedUp'; targets: SpinDownTargets | null }
  | { phase: 'coast' }
  | { phase: 'done' }
  | { phase: 'failed'; reason: SpinDownFailure }

export interface SpinDownOptions {
  /** How long the rider has to reach the speed. */
  speedUpTimeoutMs?: number
  /** How long the coast may take. */
  coastTimeoutMs?: number
  /** True while something else holds the trainer (a ride): start() fails with "busy". */
  busy?: () => boolean
}

const START_FAILURE: Record<Exclude<SpinDownStart['result'], 'ok'>, SpinDownFailure> = {
  unsupported: 'unsupported',
  'not-permitted': 'not-permitted',
  rejected: 'rejected',
  timeout: 'no-answer',
  disconnected: 'disconnected',
}

export class SpinDown {
  private current: SpinDownState = { phase: 'idle' }
  private readonly listeners = new Set<(s: SpinDownState) => void>()
  private offStatus: (() => void) | null = null
  private timer: Cancel | null = null
  /** Bumped by every start and cancel, so an answer to an old request is ignored. */
  private run = 0
  private readonly speedUpTimeoutMs: number
  private readonly coastTimeoutMs: number
  private readonly busy: () => boolean

  constructor(
    private readonly trainer: SpinDownTrainer,
    private readonly clock: Clock,
    opts: SpinDownOptions = {},
  ) {
    this.speedUpTimeoutMs = opts.speedUpTimeoutMs ?? 90_000
    this.coastTimeoutMs = opts.coastTimeoutMs ?? 60_000
    this.busy = opts.busy ?? (() => false)
  }

  get state(): SpinDownState {
    return this.current
  }

  /** From start() until the trainer reports the result or the calibration ends otherwise. */
  get running(): boolean {
    const p = this.current.phase
    return p === 'starting' || p === 'speedUp' || p === 'coast'
  }

  /** Calls `listener` with the current state now, and with every change. */
  subscribe(listener: (s: SpinDownState) => void): () => void {
    this.listeners.add(listener)
    listener(this.current)
    return () => this.listeners.delete(listener)
  }

  async start(): Promise<void> {
    this.release()
    const run = ++this.run
    if (this.busy()) return this.fail('busy')
    this.set({ phase: 'starting' })
    // listen before asking, so a status that follows the answer closely is not lost
    this.offStatus = this.trainer.onSpinDownStatus((u) => run === this.run && this.onUpdate(u))
    const reply = await this.trainer.startSpinDown()
    if (run !== this.run || this.current.phase !== 'starting') return
    // no answer in time: the trainer may have started one anyway
    if (reply.result === 'timeout') return this.abandon('no-answer')
    if (reply.result !== 'ok') return this.fail(START_FAILURE[reply.result])
    this.set({ phase: 'speedUp', targets: reply.targets })
    this.arm(this.speedUpTimeoutMs)
  }

  /** The trainer dropped off, or another one replaced it. */
  lost(): void {
    if (this.running) this.fail('disconnected')
  }

  /** The rider closed the calibration. A trainer still running it is told to stop. */
  cancel(): void {
    const running = this.running
    this.run++
    this.release()
    if (running) this.stopTrainer()
    this.set({ phase: 'idle' })
  }

  private onUpdate(update: SpinDownUpdate): void {
    if (!this.running) return
    switch (update) {
      case 'stopPedaling':
        if (this.current.phase === 'coast') return
        this.set({ phase: 'coast' })
        this.arm(this.coastTimeoutMs)
        return
      case 'success':
        this.release()
        this.set({ phase: 'done' })
        return
      case 'error':
        this.fail('trainer-error')
        return
      case 'requested':
        // the trainer asking for a spin down while one is running: nothing to do
        return
      // either ends the spin down on the trainer, and it is no longer ours to stop
      case 'controlLost':
        this.fail('control-lost')
        return
      case 'reset':
        this.fail('trainer-reset')
        return
    }
  }

  private arm(ms: number): void {
    this.timer?.()
    this.timer = this.clock.after(ms, () => this.abandon('timeout'))
  }

  private fail(reason: SpinDownFailure): void {
    this.release()
    this.set({ phase: 'failed', reason })
  }

  /** Fails a spin down the trainer may still be running, and tells it to stop. */
  private abandon(reason: SpinDownFailure): void {
    this.release()
    // queued before anyone hears of the failure, so whatever they send next follows it
    this.stopTrainer()
    this.set({ phase: 'failed', reason })
  }

  private stopTrainer(): void {
    void this.trainer.stopSpinDown().catch(() => undefined)
  }

  private release(): void {
    this.timer?.()
    this.timer = null
    this.offStatus?.()
    this.offStatus = null
  }

  private set(s: SpinDownState): void {
    this.current = s
    for (const l of this.listeners) l(s)
  }
}
