// Ride with others (beta), on the page. Created once in the composition root
// (Mac app only: the connection lives in main). It tells main what the rider
// wants: a shared track to see (the route dialog), and, while a ride on one
// is running, where the rider is, once a second. Main answers with who else
// is there, kept in groupRideStore.
import { createStore, useStore } from 'zustand'
import { sharedTrackForRoute } from '@core/openbikenet/tracks'
import { isRouteTick, RoutePlan } from '@core/ride/route-plan'
import type { RideSession } from '@core/ride/session'
import type { GroupRideState, InvokeReq } from '@shared/ipc/contract'
import type { LiveFrame } from '@shared/live'

export const GROUP_RIDE_OFF: GroupRideState = { status: 'off', route: null, riders: [], riding: false, hold: null, problem: null, retryAt: null }

export const groupRideStore = createStore<GroupRideState>(() => GROUP_RIDE_OFF)

export function useGroupRide<T>(selector: (s: GroupRideState) => T): T {
  return useStore(groupRideStore, selector)
}

type Wish = InvokeReq<'groupRide.set'>
export type GroupRideSession = Pick<RideSession, 'options' | 'currentState' | 'planTick'>

export interface GroupRideDeps {
  rides: { onSessionStart(listener: (session: GroupRideSession) => void): () => void }
  /** The latest engine frame: power, cadence and heart rate. */
  live: () => LiveFrame
  /** Ride with others is switched on. */
  enabled: () => boolean
  set: (wish: Wish) => Promise<GroupRideState>
  status: () => Promise<GroupRideState>
  onState: (listener: (s: GroupRideState) => void) => () => void
}

/** Position updates while riding a shared track, ms (main sends at most one a second). */
export const PUSH_EVERY_MS = 1000

const NOTHING: Wish = { watch: null, rider: null, simulated: false }

export class GroupRideRuntime {
  private offStart: (() => void) | null = null
  private offState: (() => void) | null = null
  private timer: ReturnType<typeof setInterval> | null = null
  private riding: { session: GroupRideSession; track: string } | null = null
  private browsing: string | null = null
  private sent = JSON.stringify(NOTHING)

  constructor(private readonly deps: GroupRideDeps) {}

  start(): void {
    if (this.offStart) return
    this.offState = this.deps.onState((s) => groupRideStore.setState(s, true))
    void this.deps
      .status()
      .then((s) => groupRideStore.setState(s, true))
      .catch(() => undefined)
    this.offStart = this.deps.rides.onSessionStart((s) => this.follow(s))
  }

  stop(): void {
    this.offStart?.()
    this.offState?.()
    this.offStart = this.offState = null
    this.release()
  }

  /** The route dialog is showing a shared track (its OpenBikeNet ID), or nothing. */
  browse(track: string | null): void {
    this.browsing = track
    this.push()
  }

  private follow(session: GroupRideSession): void {
    const plan = session.options.plan
    const track = plan instanceof RoutePlan ? sharedTrackForRoute(plan.routeId) : null
    if (!track) return
    this.release()
    this.riding = { session, track: track.obnId }
    this.push()
    this.timer = setInterval(() => this.push(), PUSH_EVERY_MS)
  }

  private release(): void {
    if (this.timer !== null) clearInterval(this.timer)
    this.timer = null
    this.riding = null
  }

  /** What the rider wants now. While riding, sent every second even if nothing moved (main drops a rider it stops hearing about). */
  private wish(): Wish {
    if (!this.deps.enabled()) return NOTHING
    const r = this.riding
    if (r && r.session.currentState === 'finished') this.release()
    const riding = this.riding
    if (!riding) return { watch: this.browsing, rider: null, simulated: false }
    const tick = riding.session.planTick
    const progress = isRouteTick(tick) ? tick.route : null
    // past the finish the rider is spinning down off the track
    if (!progress || progress.finished) return { watch: riding.track, rider: null, simulated: riding.session.options.simulated }
    const moving = riding.session.currentState === 'riding'
    const f = this.deps.live()
    return {
      watch: riding.track,
      rider: {
        lap: Math.max(0, Math.floor(progress.lap)),
        distance: Math.max(0, progress.distM),
        speed: moving ? Math.max(0, progress.speedMps) : 0,
        power: moving ? (f.power3s ?? f.power) : null,
        cadence: moving ? f.cadence : null,
        heartRate: f.hr,
      },
      simulated: riding.session.options.simulated,
    }
  }

  /** A rider goes every time (main drops one it stops hearing about); anything else only when it changes. */
  private push(): void {
    const wish = this.wish()
    const text = JSON.stringify(wish)
    if (wish.rider === null && text === this.sent) return
    this.sent = text
    void this.deps
      .set(wish)
      .then((s) => groupRideStore.setState(s, true))
      .catch(() => undefined)
  }
}
