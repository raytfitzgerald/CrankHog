// FlatRoadLayer: virtual speed for a ride with no road of its own (a free
// ride, a workout or an FTP test without a journey). The rider's power moves
// them along a flat road with the same physics as routes and journeys
// (physics/bike.ts), so the speed and distance follow the watts. They don't
// depend on the gear, as a trainer's flywheel speed does in ERG, or on whether
// the trainer reports a speed at all. The speed goes into the ride's records,
// and so into its distance, FIT file and uploads, and onto the HUD.
//
// No power reading leaves the tick alone: a bike with only a speed sensor
// keeps its wheel speed. A route sets its own speed and passes through. Unlike
// a journey this road never freewheels past auto-pause, so a workout stopped
// for a bottle stops its clock after 3 s, as it always has.
import { DEFAULT_BIKE, stepSpeed, type BikeParams } from '../physics/bike'
import type { PlanLayer } from '../journeys/layer'
import type { PlanInput, PlanTick } from './plan'

/** The rider and bike: the athlete snapshot's weight, plus the bike mass, CdA and Crr from the trainer prefs. */
export type FlatRoadRider = Partial<Pick<BikeParams, 'riderKg' | 'bikeKg' | 'cda' | 'crr'>>

const positiveOr = (v: number | undefined, fallback: number) => (v !== undefined && Number.isFinite(v) && v > 0 ? v : fallback)

export class FlatRoadLayer implements PlanLayer {
  private readonly bike: BikeParams
  private lastMovingS = 0
  private speedMps = 0

  constructor(rider: FlatRoadRider = {}) {
    this.bike = {
      ...DEFAULT_BIKE,
      riderKg: positiveOr(rider.riderKg, DEFAULT_BIKE.riderKg),
      bikeKg: positiveOr(rider.bikeKg, DEFAULT_BIKE.bikeKg),
      cda: positiveOr(rider.cda, DEFAULT_BIKE.cda),
      crr: positiveOr(rider.crr, DEFAULT_BIKE.crr),
    }
  }

  tick(input: PlanInput, base: PlanTick): PlanTick {
    if (base.speed !== undefined) return base
    const t = input.movingS
    const dt = Number.isFinite(t) ? Math.max(0, t - this.lastMovingS) : 0
    if (dt > 0) this.lastMovingS = t
    if (input.power === null || !Number.isFinite(input.power)) return base
    // 0 W rolls to a stop, as on the road; a long gap (a stall) shouldn't fling the rider forward
    if (dt > 0) this.speedMps = stepSpeed(this.speedMps, Math.max(0, input.power), 0, Math.min(dt, 2), this.bike)
    return { ...base, speed: this.speedMps }
  }
}
