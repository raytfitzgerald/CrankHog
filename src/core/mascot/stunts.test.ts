import { describe, expect, it } from 'vitest'
import {
  ALL_STUNTS,
  DESCENT_PCT,
  EASY_IF,
  HARD_IF,
  STEEP_PCT,
  STUNTS,
  WAITING_M,
  type HogContext,
  pickStunt,
  stuntLine,
  stuntWeights,
} from './stunts'

const base: HogContext = { gradePct: 0, progress: 0.4, intensity: 0.8, gapM: 0 }
const ctx = (over: Partial<HogContext>): HogContext => ({ ...base, ...over })

/** Everything the odds allow in this situation. */
const options = (c: HogContext) => stuntWeights(c).map(([s]) => s)

describe('what Sir Loin does', () => {
  it('reads the road: he grinds up a wall and tucks down a descent', () => {
    expect(options(ctx({ gradePct: STEEP_PCT + 2 }))).toContain('grind')
    expect(options(ctx({ gradePct: STEEP_PCT + 2 }))).not.toContain('tuck')
    expect(options(ctx({ gradePct: DESCENT_PCT - 2 }))).toContain('tuck')
    expect(options(ctx({ gradePct: DESCENT_PCT - 2 }))).not.toContain('grind')
  })

  it('reads the rider: applauds a hard effort, has a lie down through a soft one', () => {
    expect(options(ctx({ intensity: HARD_IF + 0.1 }))).toContain('cheer')
    expect(options(ctx({ intensity: EASY_IF - 0.1 }))).toContain('nap')
    expect(options(ctx({ intensity: EASY_IF - 0.1 }))).not.toContain('cheer')
  })

  it('waits visibly when he is miles up the road, and only does roadside things there', () => {
    const waiting = options(ctx({ gapM: WAITING_M + 50 }))
    expect(waiting.every((s) => STUNTS[s].kind === 'roadside')).toBe(true)
    expect(waiting).toContain('nap')
  })

  it('chases when he has been dropped', () => {
    const chasing = options(ctx({ gapM: -WAITING_M - 50 }))
    expect(chasing).toContain('sprint')
    expect(chasing).not.toContain('nap')
  })

  it('lets the gap override the gradient: waiting is the better joke', () => {
    // a wall would normally mean grind, but being 300 m up the road wins
    expect(options(ctx({ gapM: WAITING_M + 150, gradePct: STEEP_PCT + 4 }))).not.toContain('grind')
  })

  it('turns out at the finish', () => {
    expect(options(ctx({ progress: 0.95 }))).toContain('cheer')
  })

  it('always picks something the odds allow, for any rng in [0, 1)', () => {
    for (const over of [{}, { gapM: 300 }, { gapM: -300 }, { gradePct: 9 }, { gradePct: -9 }, { intensity: 1.3 }, { intensity: 0.4 }, { progress: 0.99 }]) {
      const c = ctx(over)
      for (const r of [0, 0.25, 0.5, 0.75, 0.999999]) {
        expect(options(c), JSON.stringify(over)).toContain(pickStunt(c, () => r))
      }
    }
  })

  it('copes with a ride that has no gradient and no power', () => {
    const c = ctx({ gradePct: null, intensity: null })
    expect(options(c).length).toBeGreaterThan(0)
    expect(ALL_STUNTS).toContain(pickStunt(c, () => 0.5))
  })
})

describe('what Sir Loin says while he does it', () => {
  it('gives every stunt at least three lines of its own', () => {
    for (const s of ALL_STUNTS) expect(STUNTS[s].lines.length, s).toBeGreaterThanOrEqual(3)
  })

  it('never repeats a line across the whole repertoire', () => {
    const all = ALL_STUNTS.flatMap((s) => STUNTS[s].lines)
    expect(new Set(all).size).toBe(all.length)
  })

  it('keeps his voice: full sentences, no shouting, no emoji', () => {
    for (const s of ALL_STUNTS) {
      for (const line of STUNTS[s].lines) {
        expect(line, `${s}: ${line}`).toMatch(/\.$/)
        expect(line, `${s}: ${line}`).not.toMatch(/!/)
        expect(line, `${s}: ${line}`).not.toMatch(/\p{Extended_Pictographic}/u)
      }
    }
  })

  it('never jokes about what he is made of', () => {
    // He is an athlete who happens to be a pig. Him having lunch is fine;
    // him *being* lunch is not. (docs/BRAND.md)
    const banned = /\b(bacon|ham|pork|sausage|rasher|roast(ed)?|crackling|slaughter|butcher|spit)\b/i
    for (const s of ALL_STUNTS) {
      for (const line of STUNTS[s].lines) expect(banned.test(line), `${s}: ${line}`).toBe(false)
    }
  })

  it('hands back a line that belongs to the stunt asked for', () => {
    for (const s of ALL_STUNTS) {
      for (const r of [0, 0.5, 0.999999]) expect(STUNTS[s].lines).toContain(stuntLine(s, () => r))
    }
  })

  it('gives every stunt a sane time on screen, and only pedals the ones on a bike', () => {
    for (const s of ALL_STUNTS) {
      expect(STUNTS[s].ms, s).toBeGreaterThanOrEqual(2_000)
      expect(STUNTS[s].ms, s).toBeLessThanOrEqual(10_000)
      if (STUNTS[s].kind === 'roadside') expect(STUNTS[s].rpm, s).toBe(0)
    }
  })
})
