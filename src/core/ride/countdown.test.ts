import { describe, expect, it } from 'vitest'
import { IntervalCountdown, type CountdownInput, type Beep } from './countdown'

/** One engine tick of a step `durationS` long with `remainingS` left. */
const at = (segmentIndex: number, durationS: number, remainingS: number, extra: Partial<CountdownInput> = {}): CountdownInput => ({
  riding: true,
  finished: false,
  segmentIndex,
  segmentRemainingS: remainingS,
  segmentElapsedS: durationS - remainingS,
  ...extra,
})

/** Runs a step from its start to its end at the engine's four ticks a second, collecting every beep. */
function ride(cd: IntervalCountdown, segmentIndex: number, durationS: number, extra: Partial<CountdownInput> = {}): Beep[] {
  const out: Beep[] = []
  for (let remaining = durationS; remaining > 0; remaining -= 0.25) out.push(...cd.tick(at(segmentIndex, durationS, remaining, extra)))
  return out
}

describe('IntervalCountdown', () => {
  it('ticks at 3, 2 and 1 s before an interval ends, then sounds the go as the next one starts', () => {
    const cd = new IntervalCountdown()
    const seen: [number, Beep][] = []
    for (let remaining = 60; remaining > 0; remaining -= 0.25) for (const b of cd.tick(at(0, 60, remaining))) seen.push([remaining, b])
    expect(seen).toEqual([
      [3, 'tick'],
      [2, 'tick'],
      [1, 'tick'],
    ])
    expect(cd.tick(at(1, 120, 120))).toEqual(['go'])
  })

  it('does not sound the go when the first interval of the ride starts', () => {
    expect(new IntervalCountdown().tick(at(0, 300, 300))).toEqual([])
  })

  it('sounds the go when the workout finishes', () => {
    const cd = new IntervalCountdown()
    ride(cd, 4, 30)
    expect(cd.tick({ riding: true, finished: true, segmentIndex: 5, segmentRemainingS: null, segmentElapsedS: null })).toEqual(['go'])
    expect(cd.tick({ riding: true, finished: true, segmentIndex: 5, segmentRemainingS: null, segmentElapsedS: null })).toEqual([])
  })

  it('stays quiet while paused, and does not repeat a tick on resume', () => {
    const cd = new IntervalCountdown()
    expect(cd.tick(at(0, 60, 2.5))).toEqual(['tick'])
    expect(cd.tick(at(0, 60, 2.5, { riding: false }))).toEqual([])
    expect(cd.tick(at(0, 60, 2.25))).toEqual([])
    expect(cd.tick(at(0, 60, 1.75))).toEqual(['tick'])
  })

  it('does not sound the go for a step that starts while paused, nor on resume', () => {
    const cd = new IntervalCountdown()
    ride(cd, 0, 60)
    // skipped to the next step during the pause
    expect(cd.tick(at(1, 60, 60, { riding: false }))).toEqual([])
    expect(cd.tick(at(1, 60, 60))).toEqual([])
    expect(cd.tick(at(1, 60, 59.75))).toEqual([])
  })

  it('counts down again when an interval is extended after its countdown began', () => {
    const cd = new IntervalCountdown()
    expect(cd.tick(at(0, 60, 2.5))).toEqual(['tick'])
    // E: 30 s more on this interval
    expect(ride(cd, 0, 90).filter((b) => b === 'tick')).toHaveLength(3)
  })

  it('leaves out the countdown on very short steps, where it would beep the whole time', () => {
    const cd = new IntervalCountdown()
    expect(ride(cd, 0, 5)).toEqual([])
    // the next step still gets its go
    expect(cd.tick(at(1, 60, 60))).toEqual(['go'])
  })

  it('beeps for nothing on a ride without intervals', () => {
    const cd = new IntervalCountdown()
    expect(cd.tick({ riding: true, finished: false, segmentIndex: null, segmentRemainingS: null, segmentElapsedS: null })).toEqual([])
  })

  it('takes a longer lead when asked', () => {
    const cd = new IntervalCountdown({ leadS: 5 })
    expect(ride(cd, 0, 60)).toEqual(['tick', 'tick', 'tick', 'tick', 'tick'])
  })
})
