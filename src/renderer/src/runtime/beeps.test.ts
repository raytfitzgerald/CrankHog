import { afterEach, describe, expect, it, vi } from 'vitest'
import { IntervalCountdown, type Beep } from '@core/ride/countdown'
import { IDLE_TICK, type PlanTick } from '@core/ride/plan'
import { RoutePlan } from '@core/ride/route-plan'
import type { SessionState } from '@core/ride/session'
import type { RideKind } from '@core/ride/types'
import { syntheticRoute } from '@core/routes/synthetic'
import { DEFAULT_SETTINGS, type AppSettings } from '@shared/settings'
import { BeepRuntime, type BeepSession } from './beeps'

/** A ride whose plan tick and state the test moves by hand. */
class FakeRide implements BeepSession {
  currentState: SessionState = 'riding'
  planTick: PlanTick = IDLE_TICK
  constructor(readonly kind: RideKind = 'workout') {}
  at(segmentIndex: number, durationS: number, remainingS: number): void {
    this.planTick = { ...IDLE_TICK, segmentIndex, segmentRemainingS: remainingS, segmentElapsedS: durationS - remainingS }
  }
}

function rig(settings: AppSettings = DEFAULT_SETTINGS, warp = 1) {
  let startSession: ((s: BeepSession) => void) | null = null
  const tickers = new Set<(now: number) => void>()
  const played: [Beep, number][] = []
  let current = settings
  const rt = new BeepRuntime({
    rides: { onSessionStart: (l) => ((startSession = l), () => (startSession = null)) },
    engine: { onTick: (fn) => (tickers.add(fn), () => tickers.delete(fn)) },
    clock: { warp },
    settings: () => current,
    play: (beep, volume) => played.push([beep, volume]),
  })
  rt.start()
  return {
    rt,
    played,
    begin: (s: BeepSession) => startSession!(s),
    tick: () => tickers.forEach((fn) => fn(0)),
    set: (s: AppSettings) => (current = s),
    tickers,
  }
}

/** Counts a step down to its end, then starts the next. */
function countDown(r: ReturnType<typeof rig>, ride: FakeRide): void {
  for (const remaining of [3, 2, 1]) {
    ride.at(0, 60, remaining)
    r.tick()
  }
  ride.at(1, 60, 60)
  r.tick()
}

describe('BeepRuntime', () => {
  it('plays the countdown and the go of a workout at the set volume', () => {
    const r = rig({ ...DEFAULT_SETTINGS, beeps: { enabled: true, volume: 0.4 } })
    const ride = new FakeRide()
    r.begin(ride)
    countDown(r, ride)
    expect(r.played).toEqual([
      ['tick', 0.4],
      ['tick', 0.4],
      ['tick', 0.4],
      ['go', 0.4],
    ])
  })

  it('counts down an FTP test too', () => {
    const r = rig()
    const ride = new FakeRide('ftp-test')
    r.begin(ride)
    countDown(r, ride)
    expect(r.played.map(([b]) => b)).toEqual(['tick', 'tick', 'tick', 'go'])
  })

  it('stays silent on a route, whose km markers are not intervals', () => {
    const plan = new RoutePlan(syntheticRoute({ name: 'Flat', segments: [{ kind: 'flat', lengthM: 3000 }] }), {
      mode: 'reactive',
      rider: { riderKg: 75, bikeKg: 8.5, cda: 0.35, crr: 0.0033, ftpW: 250 },
    })
    const ride: BeepSession & { planTick: PlanTick } = { kind: plan.kind, currentState: 'riding', planTick: IDLE_TICK }
    const r = rig()
    r.begin(ride)
    // the same ticks fed straight to a countdown, to show there was something to beep at
    const bare = new IntervalCountdown()
    const wouldBeep: Beep[] = []
    for (let k = 1; k <= 4 * 600; k++) {
      ride.planTick = plan.tick({ now: k * 250, movingS: k / 4, dtS: 0.25, power: 200, cadence: 90, hr: 140 })
      r.tick()
      wouldBeep.push(...bare.tick({ riding: true, ...ride.planTick }))
    }
    expect(ride.planTick.finished).toBe(true)
    expect(wouldBeep.filter((b) => b === 'go').length).toBeGreaterThanOrEqual(2)
    expect(r.played).toEqual([])
  })

  it('stays silent on a free ride', () => {
    const r = rig()
    const ride = new FakeRide('free')
    r.begin(ride)
    countDown(r, ride)
    expect(r.played).toEqual([])
    expect(r.tickers.size).toBe(0)
  })

  it('stays silent on a time-warped ride, where the beeps would run into each other', () => {
    const r = rig(DEFAULT_SETTINGS, 10)
    const ride = new FakeRide()
    r.begin(ride)
    countDown(r, ride)
    expect(r.played).toEqual([])
  })

  it('plays nothing when switched off, and picks up again mid-ride when switched on', () => {
    const r = rig({ ...DEFAULT_SETTINGS, beeps: { enabled: false, volume: 0.6 } })
    const ride = new FakeRide()
    r.begin(ride)
    ride.at(0, 60, 3)
    r.tick()
    expect(r.played).toEqual([])
    r.set(DEFAULT_SETTINGS)
    ride.at(0, 60, 2)
    r.tick()
    expect(r.played).toEqual([['tick', 0.6]])
  })

  it('stays quiet while the ride is paused', () => {
    const r = rig()
    const ride = new FakeRide()
    r.begin(ride)
    ride.currentState = 'paused'
    ride.at(0, 60, 2)
    r.tick()
    expect(r.played).toEqual([])
  })

  it('follows only the newest ride, and lets go of a finished one', () => {
    const r = rig()
    const first = new FakeRide()
    r.begin(first)
    const second = new FakeRide()
    r.begin(second)
    first.at(0, 60, 2)
    second.at(0, 60, 100)
    r.tick()
    expect(r.played).toEqual([])
    second.currentState = 'finished'
    r.tick()
    expect(r.tickers.size).toBe(0)
  })
})

describe('BeepRuntime.preview', () => {
  afterEach(() => vi.useRealTimers())

  it('plays the countdown a second apart at the volume set when each beep sounds', () => {
    vi.useFakeTimers()
    const r = rig({ ...DEFAULT_SETTINGS, beeps: { enabled: true, volume: 0.5 } })
    r.rt.preview()
    vi.advanceTimersByTime(1500)
    expect(r.played).toEqual([
      ['tick', 0.5],
      ['tick', 0.5],
    ])
    r.set({ ...DEFAULT_SETTINGS, beeps: { enabled: true, volume: 0.2 } })
    vi.advanceTimersByTime(2000)
    expect(r.played.slice(2)).toEqual([
      ['tick', 0.2],
      ['go', 0.2],
    ])
  })

  it('starts over when pressed again, instead of playing two countdowns at once', () => {
    vi.useFakeTimers()
    const r = rig()
    r.rt.preview()
    vi.advanceTimersByTime(1500)
    r.rt.preview()
    vi.advanceTimersByTime(10_000)
    expect(r.played.map(([b]) => b)).toEqual(['tick', 'tick', 'tick', 'tick', 'tick', 'go'])
  })

  it('is cut short when the runtime stops', () => {
    vi.useFakeTimers()
    const r = rig()
    r.rt.preview()
    r.rt.stop()
    vi.advanceTimersByTime(10_000)
    expect(r.played).toEqual([])
  })
})
