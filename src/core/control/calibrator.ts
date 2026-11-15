// The app's spin-down calibration, one at a time: made for the connected
// trainer, refused while a ride is recording, and ended when that trainer
// goes, whether it drops off, is disconnected or forgotten, or another
// trainer connects in its place. A trainer that asks for a spin down itself
// is passed on once, and never while one is running.
import { canSpinDown, type TrainerDriver } from '../devices/driver'
import type { DeviceManager } from '../devices/manager'
import type { Clock } from '../time/clock'
import { SpinDown, type SpinDownFailure } from './spin-down'

export interface CalibratorDeps {
  devices: Pick<DeviceManager, 'trainer' | 'subscribe'>
  clock: Clock
  /** True while a ride is recording: no calibration starts then. */
  riding(): boolean
  /**
   * A calibration is starting: let go of any target held with no ride
   * recording (a free ride left on), and keep the controller off the trainer,
   * or its next command would land in the middle of the spin down.
   */
  hold(): void
  /** That calibration has ended: the controller may drive the trainer again. The trainer dropped its load for it, so what was last sent no longer holds. */
  ended(): void
  /** The trainer asked for a spin down. Called once. */
  requested(): void
}

export class Calibrator {
  private current: SpinDown | null = null
  /** The trainer the current calibration runs on. */
  private driver: TrainerDriver | null = null
  /** The trainer listened to for requests. */
  private heard: TrainerDriver | null = null
  private offRequests: (() => void) | null = null
  private asked = false

  constructor(private readonly deps: CalibratorDeps) {
    deps.devices.subscribe(() => this.follow())
  }

  get running(): boolean {
    return this.current?.running ?? false
  }

  /** A fresh calibration for the connected trainer (cancelling the last one), or why there can't be one. */
  create(): SpinDown | SpinDownFailure {
    const driver = this.deps.devices.trainer()
    // no trainer, or it's still reconnecting
    if (!driver) return 'disconnected'
    if (!canSpinDown(driver)) return 'unsupported'
    this.current?.cancel()
    const sd = new SpinDown(driver, this.deps.clock, { busy: () => this.deps.riding() })
    let ran = false
    sd.subscribe((s) => {
      // 'starting' is set before the spin down Start is queued, so the controller lets go first
      if (s.phase === 'starting') {
        if (!ran) this.deps.hold()
        ran = true
      } else if (ran && !sd.running) {
        // every hold is ended, even for a calibration a newer one replaced
        ran = false
        this.deps.ended()
      }
    })
    this.current = sd
    this.driver = driver
    return sd
  }

  /** Every device change: a calibration whose trainer has gone is lost, and requests come from the trainer now connected. */
  private follow(): void {
    const trainer = this.deps.devices.trainer()
    if (this.current && trainer !== this.driver) this.current.lost()
    if (trainer === this.heard) return
    this.offRequests?.()
    this.offRequests = null
    this.heard = trainer
    if (canSpinDown(trainer)) this.offRequests = trainer.onSpinDownStatus((u) => u === 'requested' && this.onRequested())
  }

  private onRequested(): void {
    if (this.asked || this.running) return
    this.asked = true
    this.deps.requested()
  }
}
