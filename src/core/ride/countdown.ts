// Interval countdown beeps: a short tick at 3, 2 and 1 s before a workout
// step ends, and a longer "go" as the next one starts (or the workout ends).
// Unlike the coach's spoken countdown these stay on when the coach is muted,
// cut through music, and need no language.
//
// Pure: fed the plan's tick on every engine tick, it says which beeps sound
// now. Playing them is the renderer's job (src/renderer/src/audio/beeps.ts).

export type Beep = 'tick' | 'go'

export interface CountdownInput {
  /** Moving, not paused, not finished. */
  riding: boolean
  finished: boolean
  /** The plan's current step; null on rides without intervals. */
  segmentIndex: number | null
  segmentRemainingS: number | null
  segmentElapsedS: number | null
}

export interface CountdownOptions {
  /** Seconds of ticks before a step ends. */
  leadS?: number
  /** Steps shorter than this get no countdown (they would beep throughout). */
  minStepS?: number
}

export const DEFAULT_LEAD_S = 3
const DEFAULT_MIN_STEP_S = 2 * DEFAULT_LEAD_S

export class IntervalCountdown {
  private readonly leadS: number
  private readonly minStepS: number
  private index: number | null = null
  private finished = false
  /** The whole seconds already ticked in the current step. */
  private readonly ticked = new Set<number>()

  constructor(opts: CountdownOptions = {}) {
    this.leadS = opts.leadS ?? DEFAULT_LEAD_S
    this.minStepS = opts.minStepS ?? Math.max(DEFAULT_MIN_STEP_S, 2 * this.leadS)
  }

  tick(i: CountdownInput): Beep[] {
    if (i.finished) {
      const go = !this.finished && this.index !== null
      this.finished = true
      return go ? ['go'] : []
    }
    if (i.segmentIndex === null) {
      this.index = null
      this.ticked.clear()
      return []
    }
    const out: Beep[] = []
    if (i.segmentIndex !== this.index) {
      // a new step: the go, except for the first step of the ride
      if (this.index !== null && i.riding) out.push('go')
      this.index = i.segmentIndex
      this.ticked.clear()
    }
    const remaining = i.segmentRemainingS
    if (!i.riding || remaining === null || remaining <= 0) return out
    const second = Math.ceil(remaining)
    // extended past the countdown: it starts over
    if (second > this.leadS) {
      this.ticked.clear()
      return out
    }
    const stepS = (i.segmentElapsedS ?? 0) + remaining
    if (stepS >= this.minStepS && !this.ticked.has(second)) {
      this.ticked.add(second)
      out.push('tick')
    }
    return out
  }
}
