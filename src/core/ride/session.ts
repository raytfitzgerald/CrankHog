// RideSession: one ride, from start to finish. Hooks into the engine tick,
// records 1 Hz records, journals them for crash safety, keeps live metrics,
// runs the plan (workout/route/test) and handles pauses and laps.
//
// start() only arms the ride ('waiting'): the trainer is told the plan's first
// target but holds the paused load, and the clock, the recorder and the journal
// wait for the first pedal stroke (or a manual start), so time spent getting on
// the bike isn't ridden and ERG's soft start begins with the riding.
import type { AthleteSnapshot, RideKind } from './types'
import { scaledErgTarget, type TrainerController } from '../control/trainer-controller'
import { COGGAN_POWER, HrDriftAccumulator, NormalizedPowerAccumulator, RollingMean, TimeInZones, WPrimeBalance, intensityFactor, trainingStressScore } from '../metrics'
import type { SensorHub } from '../sensors/hub'
import type { Clock } from '../time/clock'
import type { LiveRide, RideCommand } from '../../shared/live'
import { encodeEvent, encodeMeta, encodeRecord, type JournalEvent } from './journal'
import { IDLE_TICK, type PlanTick, type RescueOffer, type RidePlan, freeRidePlan } from './plan'
import type { PlanLayer } from '../journeys/layer'
import { RideRecorder, type RideRecord } from './recorder'

export type SessionState = 'ready' | 'waiting' | 'riding' | 'paused' | 'finished'
export type PauseReason = 'user' | 'auto' | 'system' | 'sensor-lost'

export interface JournalSink {
  begin(rideId: string, metaLine: string): Promise<void>
  /** Idempotent per seq; resolves with the durable seq. */
  append(rideId: string, seq: number, lines: string[]): Promise<number>
  close(rideId: string): Promise<void>
}

export interface SessionOptions {
  rideId: string
  name: string
  kind: RideKind
  simulated: boolean
  athlete: AthleteSnapshot
  autoPause: boolean
  plan?: RidePlan
  /** Applied on top of each plan tick: a journey's road, position and milestones. */
  layer?: PlanLayer
  /** Best powers before this ride, for live PR detection. */
  bests?: Partial<Record<number, number>>
}

export interface SessionDeps {
  clock: Clock
  hub: SensorHub
  controller: TrainerController
  journal: JournalSink
  /** Tells the engine/controller that we're paused (ERG release). */
  setPaused: (paused: boolean) => void
}

export type SessionEvent =
  | { type: 'state'; state: SessionState; reason?: PauseReason }
  | { type: 'segment'; index: number; label: string | null; kind: string | null }
  | { type: 'cue'; text: string }
  | { type: 'pr'; durationS: number; watts: number; previous: number | null }
  | { type: 'plan-finished' }
  | { type: 'rescue'; offer: RescueOffer }
  | { type: 'journal-error'; message: string }

const AUTO_PAUSE_ZERO_MS = 3000
const SENSOR_LOST_MS = 30_000
/** While waiting, a stroke has to last this long to start the clock: a foot on a pedal or trainer noise doesn't. */
const START_HOLD_MS = 2000
/** Less than this is noise from the trainer, not someone pedaling. */
const START_POWER_W = 20
/** A bike without power or cadence starts on its wheel: about 7 km/h. */
const START_SPEED_MPS = 2
/** On a virtual road, a rider still rolling faster than this (about 3 km/h) is coasting, not stopped. */
const ROLLING_MPS = 3 / 3.6
const PR_DURATIONS = [5, 60, 300, 1200]

export class RideSession {
  readonly rideId: string
  readonly options: SessionOptions
  private readonly recorder: RideRecorder
  private readonly plan: RidePlan
  private state: SessionState = 'ready'
  private pausedBy: PauseReason | null = null
  private startedAtMono = 0
  private startedAtWall = 0
  private zeroSince: number | null = null
  private silentSince: number | null = null
  /** While waiting: when the stroke that may start the ride began (by its samples). */
  private strokeSince: number | null = null
  /** Events logged while waiting, journaled with the first stroke's time once the ride begins. */
  private waitingEvents: JournalEvent[] = []
  private lastTick: PlanTick = IDLE_TICK
  /** liveTick's copy of lastTick with the speed at 0, kept so a paused screen doesn't re-render every tick. */
  private stoppedTick: { from: PlanTick; tick: PlanTick } | null = null
  private lastSegment: number | null = null
  private planFinished = false
  private readonly listeners = new Set<(e: SessionEvent) => void>()
  readonly records: RideRecord[] = []
  readonly events: JournalEvent[] = []

  // journal batching
  private seq = 0
  private pendingLines: string[] = []
  private unacked: { seq: number; lines: string[] }[] = []
  /** The append loop in progress, if any: finish() waits for it before closing the journal. */
  private flushRun: Promise<void> | null = null
  private journalStarted: Promise<void> | null = null

  // live metrics
  private readonly np = new NormalizedPowerAccumulator()
  private readonly wbal: WPrimeBalance
  private readonly zones: TimeInZones
  private readonly drift = new HrDriftAccumulator()
  private readonly prWindows = PR_DURATIONS.map((d) => ({ d, mean: new RollingMean(d) }))
  /** Bests from history (before this ride); PRs are only ever measured against these. */
  private readonly bests: Readonly<Partial<Record<number, number>>>
  private readonly announcedPrs = new Set<number>()
  private kjSum = 0
  private ride = { maxPower: null as number | null, hrSum: 0, hrN: 0, maxHr: null as number | null, cadSum: 0, cadN: 0 }
  private lapAcc = { index: -1, powerSum: 0, powerN: 0, hrSum: 0, hrN: 0, cadSum: 0, cadN: 0, seconds: 0 }
  private coachLine: string | null = null
  private coachLineAt = 0

  constructor(
    private readonly deps: SessionDeps,
    options: SessionOptions,
  ) {
    this.options = options
    this.rideId = options.rideId
    this.plan = options.plan ?? freeRidePlan(options.name)
    this.bests = { ...options.bests }
    const cp = options.athlete.cpW ?? options.athlete.ftpW
    this.wbal = new WPrimeBalance({ cp, wPrimeJ: options.athlete.wPrimeJ ?? 20_000 })
    this.zones = new TimeInZones(COGGAN_POWER, options.athlete.ftpW)
    this.recorder = new RideRecorder(deps.hub, deps.clock, () => ({
      targetW: this.targetW(),
      grade: this.lastTick.grade ?? null,
      altitude: this.lastTick.altitude ?? null,
      lat: this.lastTick.lat ?? null,
      lon: this.lastTick.lon ?? null,
      ...(this.lastTick.speed !== undefined ? { speed: this.lastTick.speed } : {}),
    }))
  }

  get currentState(): SessionState {
    return this.state
  }
  get planTick(): PlanTick {
    return this.lastTick
  }
  /**
   * The plan tick as the screen shows it: a waiting or paused ride stands
   * still. The plan keeps its own speed and picks it up again on resume.
   */
  get liveTick(): PlanTick {
    const t = this.lastTick
    if ((this.state !== 'waiting' && this.state !== 'paused') || !t.speed) return t
    if (this.stoppedTick?.from !== t) this.stoppedTick = { from: t, tick: { ...t, speed: 0 } }
    return this.stoppedTick.tick
  }
  get movingSeconds(): number {
    return this.recorder.movingSeconds
  }
  get kind(): RideKind {
    return this.plan.kind
  }

  on(listener: (e: SessionEvent) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /** Arms the ride: the trainer gets the first target, and the clock starts with the first pedal stroke. */
  start(): void {
    if (this.state !== 'ready') return
    const now = this.deps.clock.now()
    this.state = 'waiting'
    // the paused load until the first stroke, so ERG doesn't ramp up under a rider who isn't there yet
    this.deps.setPaused(true)
    this.applyPlan(now, 0)
    this.emit({ type: 'state', state: 'waiting' })
    // already rolling when they pressed start: begin now, without letting the trainer go
    if (this.strokeAt(now) !== null) this.beginRiding(now)
  }

  /** The ride really starts at `at`: the first pedal stroke, or the rider pressed start. */
  private beginRiding(at: number): void {
    if (this.state !== 'waiting') return
    this.startedAtMono = at
    this.startedAtWall = this.deps.clock.wallMs(at)
    // the recorder catches up on the seconds since `at` (the hub keeps the samples)
    this.recorder.start(at)
    this.state = 'riding'
    this.deps.setPaused(false)
    const meta = encodeMeta({
      rideId: this.rideId,
      startedAt: this.startedAtWall,
      name: this.plan.name,
      kind: this.plan.kind,
      simulated: this.options.simulated,
      ftpW: this.options.athlete.ftpW,
      weightKg: this.options.athlete.weightKg,
      athlete: this.options.athlete,
      workoutId: this.plan.workoutId,
      workoutJson: this.plan.workoutJson,
    })
    this.journalStarted = this.deps.journal.begin(this.rideId, meta).catch((e: unknown) => {
      this.emit({ type: 'journal-error', message: String(e) })
    })
    // what the rider did while waiting (a skip, a new mode) took effect as the ride began
    for (const e of this.waitingEvents) this.journalEvent({ ...e, ts: this.startedAtWall })
    this.waitingEvents = []
    this.emit({ type: 'state', state: 'riding' })
  }

  pause(reason: PauseReason = 'user'): void {
    if (this.state !== 'riding') return
    this.recorder.requestPause()
    this.state = 'paused'
    this.pausedBy = reason
    this.deps.setPaused(true)
    this.logEvent('pause', { reason })
    this.emit({ type: 'state', state: 'paused', reason })
  }

  resume(): void {
    if (this.state === 'waiting') return this.beginRiding(this.deps.clock.now())
    if (this.state !== 'paused') return
    const now = this.deps.clock.now()
    // A pause requested mid-slot finishes that slot first.
    this.collect(now)
    this.recorder.resume(now)
    this.state = 'riding'
    this.pausedBy = null
    this.zeroSince = null
    this.silentSince = null
    this.deps.setPaused(false)
    this.logEvent('resume')
    this.emit({ type: 'state', state: 'riding' })
  }

  togglePause(): void {
    if (this.state === 'riding') this.pause('user')
    else if (this.state === 'paused' || this.state === 'waiting') this.resume()
  }

  lap(): void {
    // before the first stroke there is no lap to end
    if (this.state !== 'riding' && this.state !== 'paused') return
    this.recorder.requestLap()
    this.logEvent('lap')
  }

  /** Workout / trainer commands from keyboard, mini-HUD or phone. */
  command(cmd: RideCommand): void {
    switch (cmd.type) {
      case 'togglePause':
        return this.togglePause()
      case 'pause':
        return this.pause('user')
      case 'resume':
        return this.resume()
      case 'lap':
        return this.lap()
      case 'intensity':
        // ERG intensity means nothing while the rider is on a level or a road (the phone's ±1 % still sends it),
        // and changing it then would only surprise them at the next ERG block
        if (this.lastTick.manual || this.lastTick.road) return
        this.deps.controller.adjustIntensity(cmd.deltaPct)
        this.logEvent('note', { intensityPct: this.deps.controller.currentSettings.intensityPct })
        return
      case 'rescue':
        if (cmd.choice === 'easier') {
          this.deps.controller.adjustIntensity(-5)
          this.logEvent('note', { rescue: 'easier', intensityPct: this.deps.controller.currentSettings.intensityPct })
        }
        if (this.plan.command?.(cmd, this.movingPrecise(this.deps.clock.now()))) this.logEvent('note', { rescue: cmd.choice })
        return
      default: {
        const now = this.deps.clock.now()
        if (!this.plan.command?.(cmd, this.movingPrecise(now))) return
        this.logEvent('note', { command: cmd.type })
        // A new mode or level reaches the trainer (and the screen) now, not on the next tick.
        // While waiting there is no next tick, so a skip does too.
        if (this.state === 'waiting' || ((this.state === 'riding' || this.state === 'paused') && (cmd.type === 'mode' || cmd.type === 'nudge'))) this.applyPlan(now, 0)
      }
    }
  }

  setCoachLine(text: string): void {
    this.coachLine = text
    this.coachLineAt = this.deps.clock.now()
  }

  /** Called from the engine tick (~4 Hz). */
  tick(now: number): void {
    if (this.state === 'ready' || this.state === 'finished') return
    const hub = this.deps.hub
    const power = hub.value('power', now)
    const cadence = hub.value('cadence', now)
    const speed = hub.value('speed', now)

    if (this.state === 'waiting') {
      const since = this.firstStroke(now)
      if (since === null) return
      this.beginRiding(since)
    }
    if (this.options.autoPause) this.autoPause(now, power, cadence, speed)
    if (this.state === 'riding') this.applyPlan(now, 0.25)
    this.collect(now)
  }

  /** Stops the ride. Records up to now are kept; the journal is flushed and closed. */
  async finish(): Promise<{ records: RideRecord[]; events: JournalEvent[] }> {
    if (this.state === 'finished') return { records: this.records, events: this.events }
    if (this.state === 'waiting') {
      // never started: nothing was recorded and the journal was never begun
      this.state = 'finished'
      this.waitingEvents = []
      this.deps.setPaused(false)
      if (this.kind !== 'free') this.deps.controller.setDesired({ mode: 'idle' })
      this.emit({ type: 'state', state: 'finished' })
      return { records: this.records, events: this.events }
    }
    const now = this.deps.clock.now()
    this.collect(now)
    this.recorder.pauseNow()
    this.state = 'finished'
    this.deps.setPaused(false)
    // a free ride's trainer mode belongs to the Just ride page, which carries on after the ride
    if (this.kind !== 'free') this.deps.controller.setDesired({ mode: 'idle' })
    const endTs = this.records.at(-1)?.ts ?? this.startedAtWall
    const end: JournalEvent = { type: 'end', t: this.recorder.movingSeconds, ts: endTs }
    this.events.push(end)
    this.pendingLines.push(encodeEvent(end))
    // the last records and the end line are written before the journal closes (an in-flight append included)
    await this.flushJournal()
    if (this.unacked.length > 0) await this.flushJournal()
    await this.deps.journal.close(this.rideId).catch(() => undefined)
    this.emit({ type: 'state', state: 'finished' })
    return { records: this.records, events: this.events }
  }

  snapshot(): LiveRide {
    const now = this.deps.clock.now()
    const ftp = this.options.athlete.ftpW
    const np = this.np.value()
    const t = this.lastTick
    return {
      state: this.state === 'ready' ? 'idle' : this.state,
      name: this.plan.name,
      elapsedS: this.state === 'ready' || this.state === 'waiting' ? 0 : Math.round((now - this.startedAtMono) / 1000),
      movingS: this.recorder.movingSeconds,
      segmentLabel: t.segmentLabel,
      segmentRemainingS: t.segmentRemainingS === null ? null : Math.max(0, Math.round(t.segmentRemainingS)),
      nextLabel: t.nextLabel,
      workoutRemainingS: t.remainingS === null ? null : Math.max(0, Math.round(t.remainingS)),
      targetW: this.targetW(),
      np: np === null ? null : Math.round(np),
      tss: roundOrNull(trainingStressScore(this.np.validSeconds, np, ftp), 1),
      kj: Math.round(this.kjSum / 1000),
      wbalPct: Math.round((this.wbal.valueJ / (this.options.athlete.wPrimeJ ?? 20_000)) * 100),
      distanceM: Math.round(this.recorder.distanceM),
      coachLine: this.coachLine && now - this.coachLineAt < 12_000 ? this.coachLine : null,
    }
  }

  /** Live metrics for the HUD beyond the LiveRide basics. */
  liveMetrics() {
    const ftp = this.options.athlete.ftpW
    const np = this.np.value()
    return {
      np,
      if: intensityFactor(np, ftp),
      tss: trainingStressScore(this.np.validSeconds, np, ftp),
      kj: this.kjSum / 1000,
      wbalJ: this.wbal.valueJ,
      zonesS: this.zones.seconds(),
      decouplingPct: this.drift.value(),
      avgPower: this.np.validSeconds > 0 ? Math.round(this.kjSum / this.np.validSeconds) : null,
      maxPower: this.ride.maxPower,
      avgHr: this.ride.hrN > 0 ? Math.round(this.ride.hrSum / this.ride.hrN) : null,
      maxHr: this.ride.maxHr,
      avgCadence: this.ride.cadN > 0 ? Math.round(this.ride.cadSum / this.ride.cadN) : null,
      lap: {
        index: Math.max(0, this.lapAcc.index),
        seconds: this.lapAcc.seconds,
        avgPower: this.lapAcc.powerN > 0 ? Math.round(this.lapAcc.powerSum / this.lapAcc.powerN) : null,
        avgHr: this.lapAcc.hrN > 0 ? Math.round(this.lapAcc.hrSum / this.lapAcc.hrN) : null,
        avgCadence: this.lapAcc.cadN > 0 ? Math.round(this.lapAcc.cadSum / this.lapAcc.cadN) : null,
      },
    }
  }

  // ---- internals ----------------------------------------------------------

  /**
   * The target the rider is asked to hold, intensity applied: the plan's
   * target, or in a free ride the manual ERG watts. Null when there is none.
   */
  private targetW(): number | null {
    if (this.lastTick.targetW !== null) return this.lastTick.targetW
    const d = this.deps.controller.snapshot.desired
    return d.mode === 'erg' ? scaledErgTarget(d.watts, this.deps.controller.currentSettings) : null
  }

  private movingPrecise(now: number): number {
    return this.recorder.movingMsAt(now) / 1000
  }

  private applyPlan(now: number, dtS: number): void {
    const hub = this.deps.hub
    const input = {
      now,
      movingS: this.movingPrecise(now),
      dtS,
      power: hub.value('power', now),
      cadence: hub.value('cadence', now),
      hr: hub.value('hr', now),
      intensityPct: this.deps.controller.currentSettings.intensityPct,
    }
    const planned = this.plan.tick(input)
    const tick = this.options.layer ? this.options.layer.tick(input, planned) : planned
    this.lastTick = tick
    if (tick.desired) this.deps.controller.setDesired(tick.desired)
    if (tick.segmentIndex !== null && tick.segmentIndex !== this.lastSegment) {
      // a skip while waiting just changes where the ride begins
      if (this.lastSegment !== null && this.state !== 'waiting') this.recorder.requestLap()
      this.lastSegment = tick.segmentIndex
      this.logEvent('segment', { index: tick.segmentIndex, label: tick.segmentLabel })
      this.emit({ type: 'segment', index: tick.segmentIndex, label: tick.segmentLabel, kind: tick.segmentKind })
    }
    if (tick.cue) this.emit({ type: 'cue', text: tick.cue })
    if (tick.rescue) this.emit({ type: 'rescue', offer: tick.rescue })
    if (tick.finished && !this.planFinished) {
      this.planFinished = true
      this.logEvent('note', { planFinished: true })
      this.emit({ type: 'plan-finished' })
    }
  }

  private autoPause(now: number, power: number | null, cadence: number | null, speed: number | null): void {
    // a bike with no power or cadence (a classic trainer's speed sensor) goes by its wheel
    const cranks = power !== null || cadence !== null
    // on a route or a journey the rider rolls on without pedalling, down a hill or slowing on the flat,
    // so that isn't a stop until the virtual speed is down to a crawl
    const t = this.lastTick
    const rolling = t.freewheels === true && (t.speed ?? 0) >= ROLLING_MPS
    const zero = !rolling && (cranks ? power === 0 && (cadence === 0 || cadence === null) : speed === 0)
    const silent = !cranks && speed === null
    if (this.state === 'riding') {
      this.zeroSince = zero ? (this.zeroSince ?? now) : null
      this.silentSince = silent ? (this.silentSince ?? now) : null
      if (this.zeroSince !== null && now - this.zeroSince >= AUTO_PAUSE_ZERO_MS) this.pause('auto')
      else if (this.silentSince !== null && now - this.silentSince >= SENSOR_LOST_MS) this.pause('sensor-lost')
    } else if (this.state === 'paused' && (this.pausedBy === 'auto' || this.pausedBy === 'sensor-lost')) {
      if ((power !== null && power > 0) || (cadence !== null && cadence > 0) || (!cranks && speed !== null && speed > 0)) this.resume()
    }
  }

  /**
   * While waiting: when the first stroke began, once the rider has kept going
   * for START_HOLD_MS. Measured on the samples' own times, so a value the hub
   * is only holding (the trainer went quiet) can't run the hold out.
   */
  private firstStroke(now: number): number | null {
    const at = this.strokeAt(now)
    if (at === null) {
      this.strokeSince = null
      return null
    }
    this.strokeSince ??= at
    return at - this.strokeSince >= START_HOLD_MS ? this.strokeSince : null
  }

  /**
   * The time of the newest sample that says the rider is going, or null. The
   * cranks (power, cadence) decide on a bike that has them, since a trainer's
   * flywheel spins on after the rider stops; a bike without them goes by its wheel.
   */
  private strokeAt(now: number): number | null {
    const hub = this.deps.hub
    const power = hub.latest('power', now)
    const cadence = hub.latest('cadence', now)
    if (power === null && cadence === null) {
      const speed = hub.latest('speed', now)
      return speed !== null && speed.value >= START_SPEED_MPS ? speed.tMono : null
    }
    const p = power !== null && power.value >= START_POWER_W ? power.tMono : null
    const c = cadence !== null && cadence.value > 0 ? cadence.tMono : null
    return p === null ? c : c === null ? p : Math.max(p, c)
  }

  private collect(now: number): void {
    const recs = this.recorder.collect(now)
    for (const r of recs) this.onRecord(r)
    if (recs.length > 0) void this.flushJournal()
  }

  private onRecord(r: RideRecord): void {
    this.records.push(r)
    this.pendingLines.push(encodeRecord(r))
    this.np.push(r.power)
    this.wbal.push(r.power, 1)
    this.zones.push(r.power)
    this.drift.push(r.power, r.hr)
    if (r.power !== null) this.kjSum += r.power
    const ride = this.ride
    if (r.power !== null) ride.maxPower = Math.max(ride.maxPower ?? 0, r.power)
    if (r.hr !== null) {
      ride.hrSum += r.hr
      ride.hrN++
      ride.maxHr = Math.max(ride.maxHr ?? 0, r.hr)
    }
    if (r.cadence !== null && r.cadence > 0) {
      ride.cadSum += r.cadence
      ride.cadN++
    }
    if (r.lap !== this.lapAcc.index) this.lapAcc = { index: r.lap, powerSum: 0, powerN: 0, hrSum: 0, hrN: 0, cadSum: 0, cadN: 0, seconds: 0 }
    const lap = this.lapAcc
    lap.seconds++
    if (r.power !== null) {
      lap.powerSum += r.power
      lap.powerN++
    }
    if (r.hr !== null) {
      lap.hrSum += r.hr
      lap.hrN++
    }
    // zeros (coasting) are left out, as in the ride average and the saved laps
    if (r.cadence !== null && r.cadence > 0) {
      lap.cadSum += r.cadence
      lap.cadN++
    }
    // A PR beats a best from history, and is announced once per duration per
    // ride. (With no history, every effort would be a "PR".)
    for (const w of this.prWindows) {
      const m = w.mean.push(r.power)
      const prev = this.bests[w.d]
      if (m === null || w.mean.count < w.d || prev === undefined || this.announcedPrs.has(w.d)) continue
      if (m > prev + 1) {
        this.announcedPrs.add(w.d)
        this.emit({ type: 'pr', durationS: w.d, watts: Math.round(m), previous: prev })
      }
    }
  }

  private logEvent(kind: Extract<JournalEvent, { type: 'event' }>['kind'], data?: Record<string, unknown>): void {
    const e: JournalEvent = { type: 'event', t: this.recorder.movingSeconds, ts: this.deps.clock.wallMs(), kind, data }
    if (this.state === 'waiting') this.waitingEvents.push(e)
    else this.journalEvent(e)
  }

  private journalEvent(e: JournalEvent): void {
    this.events.push(e)
    this.pendingLines.push(encodeEvent(e))
  }

  /**
   * Appends everything pending. While a loop is already running it picks up
   * the new batch too, so this returns that loop: awaiting it means the batch
   * was written (or failed and is kept for the next flush).
   */
  private flushJournal(): Promise<void> {
    if (this.pendingLines.length > 0) {
      this.unacked.push({ seq: ++this.seq, lines: this.pendingLines })
      this.pendingLines = []
    }
    if (this.flushRun) return this.flushRun
    this.flushRun = (async () => {
      await this.journalStarted
      while (this.unacked.length > 0) {
        const batch = this.unacked[0]!
        try {
          await this.deps.journal.append(this.rideId, batch.seq, batch.lines)
          this.unacked.shift()
        } catch (e) {
          this.emit({ type: 'journal-error', message: String(e) })
          break // keep it; retried on the next flush with the same seq
        }
      }
    })().finally(() => {
      this.flushRun = null
    })
    return this.flushRun
  }

  private emit(e: SessionEvent): void {
    for (const l of this.listeners) l(e)
  }
}

const roundOrNull = (v: number | null, dp: number) => (v === null ? null : Math.round(v * 10 ** dp) / 10 ** dp)
