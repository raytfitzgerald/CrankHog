import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sharedTrack, sharedTrackRoute } from '@core/openbikenet/tracks'
import { IDLE_TICK, type PlanTick } from '@core/ride/plan'
import { RoutePlan, type RouteTick } from '@core/ride/route-plan'
import type { SessionState } from '@core/ride/session'
import { syntheticRoute } from '@core/routes/synthetic'
import type { GroupRideState, InvokeReq } from '@shared/ipc/contract'
import { EMPTY_FRAME, type LiveFrame } from '@shared/live'
import { GROUP_RIDE_OFF, GroupRideRuntime, groupRideStore, type GroupRideSession } from './runtime'

const RIDER = { riderKg: 75, bikeKg: 8.5, cda: 0.35, crr: 0.0033 }
const velodrome = sharedTrackRoute(sharedTrack('velodrome-250')!)

class FakeRide implements GroupRideSession {
  currentState: SessionState = 'riding'
  planTick: PlanTick = IDLE_TICK
  readonly options: GroupRideSession['options']
  constructor(
    readonly plan: RoutePlan,
    simulated = false,
  ) {
    this.options = { plan, simulated } as unknown as GroupRideSession['options']
  }
  at(lap: number, distM: number, speedMps: number, finished = false) {
    const tick = this.plan.tick({ now: 0, movingS: 0, dtS: 0, power: null, cadence: null, hr: null })
    this.planTick = { ...tick, route: { ...tick.route, lap, distM, speedMps, finished } } as RouteTick
  }
}

function rig(enabled = true) {
  let begin: ((s: GroupRideSession) => void) | null = null
  let listener: ((s: GroupRideState) => void) | null = null
  const sent: InvokeReq<'groupRide.set'>[] = []
  let frame: LiveFrame = { ...EMPTY_FRAME, power: 230, power3s: 224, cadence: 91, hr: 150 }
  let on = enabled
  const rt = new GroupRideRuntime({
    rides: { onSessionStart: (l) => ((begin = l), () => (begin = null)) },
    live: () => frame,
    enabled: () => on,
    set: (wish) => {
      sent.push(wish)
      return Promise.resolve({ ...GROUP_RIDE_OFF, status: 'connected', route: wish.watch })
    },
    status: () => Promise.resolve({ ...GROUP_RIDE_OFF, status: 'idle' }),
    onState: (l) => ((listener = l), () => (listener = null)),
  })
  rt.start()
  return {
    rt,
    sent,
    begin: (s: GroupRideSession) => begin!(s),
    hear: (s: GroupRideState) => listener!(s),
    setFrame: (f: Partial<LiveFrame>) => (frame = { ...frame, ...f }),
    turn: (v: boolean) => (on = v),
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  groupRideStore.setState(GROUP_RIDE_OFF, true)
})
afterEach(() => {
  vi.useRealTimers()
})

describe('GroupRideRuntime', () => {
  it('keeps the latest word from main in the store', async () => {
    const r = rig()
    await vi.runOnlyPendingTimersAsync()
    expect(groupRideStore.getState().status).toBe('idle')
    r.hear({ ...GROUP_RIDE_OFF, status: 'connected', route: 'velodrome-250' })
    expect(groupRideStore.getState()).toMatchObject({ status: 'connected', route: 'velodrome-250' })
  })

  it('asks to watch a shared track while the dialog shows it, once', () => {
    const r = rig()
    r.rt.browse('velodrome-250')
    r.rt.browse('velodrome-250')
    r.rt.browse(null)
    expect(r.sent).toEqual([
      { watch: 'velodrome-250', rider: null, simulated: false },
      { watch: null, rider: null, simulated: false },
    ])
  })

  it('sends the rider on a shared track every second, with power and heart rate', () => {
    const r = rig()
    const ride = new FakeRide(new RoutePlan(velodrome, { mode: 'reactive', rider: RIDER, laps: 40, segments: 'km' }))
    ride.at(0, 12.5, 9.2)
    r.begin(ride)
    expect(r.sent.at(-1)).toEqual({
      watch: 'velodrome-250',
      rider: { lap: 0, distance: 12.5, speed: 9.2, power: 224, cadence: 91, heartRate: 150 },
      simulated: false,
    })
    ride.at(3, 100, 10)
    vi.advanceTimersByTime(1000)
    expect(r.sent.at(-1)!.rider).toMatchObject({ lap: 3, distance: 100, speed: 10 })
    vi.advanceTimersByTime(3000)
    expect(r.sent).toHaveLength(5)
  })

  it('shows a paused rider standing still, without power', () => {
    const r = rig()
    const ride = new FakeRide(new RoutePlan(velodrome, { mode: 'reactive', rider: RIDER, laps: 4, segments: 'km' }))
    ride.at(1, 50, 8)
    r.begin(ride)
    ride.currentState = 'paused'
    vi.advanceTimersByTime(1000)
    expect(r.sent.at(-1)!.rider).toEqual({ lap: 1, distance: 50, speed: 0, power: null, cadence: null, heartRate: 150 })
  })

  it('takes the rider off the track at the finish, and stops when the ride is over', () => {
    const r = rig()
    const ride = new FakeRide(new RoutePlan(velodrome, { mode: 'reactive', rider: RIDER, laps: 4, segments: 'km' }))
    ride.at(0, 0, 0)
    r.begin(ride)
    ride.at(4, 250, 9, true)
    vi.advanceTimersByTime(1000)
    expect(r.sent.at(-1)).toEqual({ watch: 'velodrome-250', rider: null, simulated: false })
    ride.currentState = 'finished'
    vi.advanceTimersByTime(1000)
    expect(r.sent.at(-1)).toEqual({ watch: null, rider: null, simulated: false })
    const count = r.sent.length
    vi.advanceTimersByTime(5000)
    expect(r.sent).toHaveLength(count)
  })

  it('says when a ride is simulated', () => {
    const r = rig()
    const ride = new FakeRide(new RoutePlan(velodrome, { mode: 'reactive', rider: RIDER }), true)
    ride.at(0, 1, 1)
    r.begin(ride)
    expect(r.sent.at(-1)).toMatchObject({ simulated: true })
  })

  it('leaves other routes alone', () => {
    const r = rig()
    r.begin(new FakeRide(new RoutePlan(syntheticRoute({ name: 'Flat', segments: [{ kind: 'flat', lengthM: 1000 }] }), { mode: 'reactive', rider: RIDER })))
    vi.advanceTimersByTime(5000)
    expect(r.sent).toEqual([])
  })

  it('sends nothing while Ride with others is off', () => {
    const r = rig(false)
    r.rt.browse('velodrome-250')
    const ride = new FakeRide(new RoutePlan(velodrome, { mode: 'reactive', rider: RIDER }))
    ride.at(0, 1, 1)
    r.begin(ride)
    vi.advanceTimersByTime(3000)
    expect(r.sent).toEqual([])
  })
})
