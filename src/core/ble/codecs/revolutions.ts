// Rates from cumulative revolution counters (CSC and CPS wheel/crank data).
// Sensors report a running revolution count and the time of the latest
// revolution on their own clock, so the rate is Δrevs / Δtime between two
// distinct events. Both counters roll over; notifications repeat the same
// event while the rider coasts; and a long silence can hide a whole
// event-time rollover. The calculator handles all three.
//
// The rate is taken over a short window of events, not just the last one.
// A rate is held until the next event arrives, so a single-interval rate is
// held for the *following* interval: when event times are quantized (sensors
// and trainers that stamp the notification instead of the revolution), a
// short interval's high rate covers a long one and the time-weighted mean
// reads high. 90 rpm stamped at 4 Hz read about 95; across a 2 s window it
// reads 90.

/** Event times are uint16 on every profile. */
const EVENT_TIME_MODULUS = 0x10000

export interface RevolutionRateOptions {
  /** Event-time clock: 1024 Hz (CSC, CPS crank) or 2048 Hz (CPS wheel). */
  timeResolutionHz: 1024 | 2048
  /** Width of the revolution counter: 16 (crank) or 32 (wheel). */
  revBits: 16 | 32
  /** Host ms with no new revolution before the rate drops to 0. Default 2500. */
  staleMs?: number
  /** Rates above this many rev/min are glitches and ignored. Default 250 (cranks); raise it for wheels. */
  maxRatePerMin?: number
  /** The rate spans at least this much sensor time (once that much is known). Default 2. */
  windowS?: number
}

export class RevolutionRateCalculator {
  private readonly hz: number
  private readonly revModulus: number
  private readonly staleMs: number
  private readonly maxRate: number
  private readonly windowTicks: number
  /**
   * Past this host-time gap the uint16 event time may have rolled over more
   * than once, so Δtime is ambiguous. It is 15/16 of one rollover period
   * (60 s at 1024 Hz, 30 s at 2048 Hz), leaving margin for BLE latency.
   */
  private readonly maxGapMs: number
  /** The last new revolution event: the reference that deltas are taken from. */
  private ref: { revs: number; time: number } | null = null
  /** Accepted events since the last restart or re-base, as running totals of revolutions and ticks. */
  private chain: { revs: number; ticks: number }[] = []
  private refAtMs = 0
  private lastUpdateMs = 0
  private rate: number | null = null

  constructor(opts: RevolutionRateOptions) {
    this.hz = opts.timeResolutionHz
    this.revModulus = 2 ** opts.revBits
    this.staleMs = opts.staleMs ?? 2500
    this.maxRate = opts.maxRatePerMin ?? 250
    this.windowTicks = (opts.windowS ?? 2) * this.hz
    this.maxGapMs = ((EVENT_TIME_MODULUS / this.hz) * 1000 * 15) / 16
  }

  /**
   * Feeds one notification's counter and event time, stamped with the host's
   * monotonic clock. Returns revolutions per minute, or null while no rate is
   * known yet: on the first sample, and again after a restart (see maxGapMs).
   *
   * - Same revolution count as the reference (a repeated notification, or
   *   coasting): the last rate is kept until `staleMs` has passed since the
   *   reference event arrived, then 0.
   * - A rate above `maxRatePerMin`, or revolutions with no time elapsed: the
   *   previous value is returned, and the sample becomes the new reference.
   *   Re-basing means a counter that jumps (a sensor reset, a corrupted
   *   sample) costs one or two rejected samples instead of wedging the
   *   calculator.
   * - The first revolution after a stop (the rate dropped to 0, or at least
   *   `staleMs` of sensor time passed without one) reports its own interval,
   *   and the window starts again from it.
   */
  update(revs: number, eventTime: number, nowMs: number): number | null {
    if (!Number.isFinite(revs) || !Number.isFinite(eventTime) || !Number.isFinite(nowMs)) {
      throw new RangeError(`RevolutionRateCalculator: non-finite sample (${revs}, ${eventTime}, ${nowMs})`)
    }
    const ref = this.ref
    const sinceUpdate = nowMs - this.lastUpdateMs
    this.lastUpdateMs = nowMs
    if (ref === null || sinceUpdate > this.maxGapMs) return this.restart(revs, eventTime, nowMs)

    const dRevs = mod(revs - ref.revs, this.revModulus)
    if (dRevs === 0) {
      if (nowMs - this.refAtMs >= this.staleMs) this.rate = 0
      return this.rate
    }
    if (nowMs - this.refAtMs > this.maxGapMs) return this.restart(revs, eventTime, nowMs)

    const dTicks = mod(eventTime - ref.time, EVENT_TIME_MODULUS)
    this.ref = { revs, time: eventTime }
    this.refAtMs = nowMs
    const rpm = dTicks === 0 ? Infinity : (dRevs * 60 * this.hz) / dTicks
    // after a stop (reported as 0, or a sensor that just went quiet) the window starts again here
    const stopped = this.rate === 0 || dTicks >= (this.staleMs / 1000) * this.hz
    if (rpm > this.maxRate || stopped) {
      this.chain = [{ revs: 0, ticks: 0 }]
      if (rpm > this.maxRate) return this.rate
      this.rate = rpm
      return rpm
    }
    const last = this.chain.at(-1)!
    const now = { revs: last.revs + dRevs, ticks: last.ticks + dTicks }
    this.chain.push(now)
    while (this.chain.length > 2 && now.ticks - this.chain[1]!.ticks >= this.windowTicks) this.chain.shift()
    const first = this.chain[0]!
    this.rate = ((now.revs - first.revs) * 60 * this.hz) / (now.ticks - first.ticks)
    return this.rate
  }

  /** Forgets all history (e.g. after a reconnect); the next sample returns null. */
  reset(): void {
    this.ref = null
    this.chain = []
    this.rate = null
  }

  private restart(revs: number, eventTime: number, nowMs: number): null {
    this.ref = { revs, time: eventTime }
    this.chain = [{ revs: 0, ticks: 0 }]
    this.refAtMs = nowMs
    this.rate = null
    return null
  }
}

function mod(a: number, m: number): number {
  return ((a % m) + m) % m
}

/** Wheel speed in m/s from a wheel rate (rev/min) and circumference (mm). */
export function wheelSpeedMps(revsPerMin: number, circumferenceMm: number): number {
  return (revsPerMin / 60) * (circumferenceMm / 1000)
}
