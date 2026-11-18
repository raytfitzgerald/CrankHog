import { describe, expect, it } from 'vitest'
import { CRANK_DECAY_PER_S, CRANK_FIRES_AT, CRANK_IDLE, WOLVES_CALM_MS, crankHog, crankLevel, crankSpeed, type Crank } from './crank'

/** Clicks every `everyMs` and says on which click (1-based) he went, or null if he never did. */
function clickAt(everyMs: number, clicks: number): number | null {
  let c: Crank = CRANK_IDLE
  for (let i = 1; i <= clicks; i++) {
    const r = crankHog(c, 10_000 + i * everyMs)
    if (r.fired) return i
    c = r.crank
  }
  return null
}

describe('cranking the hog', () => {
  it('goes off after a run of quick clicks', () => {
    const n = clickAt(250, 30)
    expect(n).not.toBeNull()
    expect(n!).toBeGreaterThanOrEqual(CRANK_FIRES_AT)
    expect(n!).toBeLessThan(14)
  })

  it('never goes off from idle clicking', () => {
    // one a second is someone wondering what he is, not cranking him
    expect(clickAt(1_000, 200)).toBeNull()
    expect(clickAt(3_000, 200)).toBeNull()
  })

  it("can't be wound up at the pace the wolves take as calm", () => {
    // so every click in a run that cranked him lands too soon after the last to count on the wolves
    expect(clickAt(WOLVES_CALM_MS, 1_000)).toBeNull()
  })

  it('winds back down when you stop', () => {
    const c = crankHog(crankHog(CRANK_IDLE, 0).crank, 0).crank
    expect(crankLevel(c, 0)).toBe(2)
    expect(crankLevel(c, 1_000)).toBeCloseTo(2 - CRANK_DECAY_PER_S)
    expect(crankLevel(c, 60_000)).toBe(0)
    // and a clock that runs backwards doesn't wind him up
    expect(crankLevel(c, -500)).toBe(2)
  })

  it('starts the count again from wherever he has wound down to', () => {
    let c: Crank = CRANK_IDLE
    for (let i = 0; i < CRANK_FIRES_AT - 1; i++) c = crankHog(c, 0).crank
    // a long pause, then one more: not enough any more
    expect(crankHog(c, 20_000).fired).toBe(false)
    // straight after, it is
    expect(crankHog(c, 0).fired).toBe(true)
  })

  it('laps faster the more he is wound up, and one click shows', () => {
    expect(crankSpeed(0)).toBe(1)
    expect(crankSpeed(-1)).toBe(1)
    expect(crankSpeed(1)).toBeGreaterThan(1.5)
    for (let l = 1; l <= CRANK_FIRES_AT; l++) expect(crankSpeed(l)).toBeGreaterThan(crankSpeed(l - 1))
    expect(crankSpeed(CRANK_FIRES_AT)).toBeGreaterThan(15)
  })
})
