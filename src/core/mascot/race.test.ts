import { describe, expect, it } from 'vitest'
import { HOG_MAX_GAP_M, HOG_RACE_START, HOG_WAIT_M, hogGapLabel, hogMood, hogPaceW, stepHogRace } from './race'

const FTP = 250
const riding = { watts: 250, kmh: 32 }

/** Runs the race for `seconds` at a fixed effort, a tenth of a second at a time. */
function ride(watts: number, seconds: number, from = HOG_RACE_START) {
  let s = from
  for (let t = 0; t < seconds * 10; t++) s = stepHogRace(s, 0.1, { watts, kmh: null }, FTP)
  return s
}

describe('Sir Loin on the road', () => {
  it('rides somewhere near your FTP, and wanders', () => {
    const paces = Array.from({ length: 40 }, (_, i) => hogPaceW(FTP, { ...HOG_RACE_START, phaseS: i * 5 }))
    expect(Math.min(...paces)).toBeGreaterThan(FTP * 0.8)
    expect(Math.max(...paces)).toBeLessThan(FTP * 1.2)
    // it actually moves: a flat pace would be no race at all
    expect(Math.max(...paces) - Math.min(...paces)).toBeGreaterThan(FTP * 0.15)
  })

  it('eases off once he is a long way clear, so he never disappears', () => {
    const clear = hogPaceW(FTP, { ...HOG_RACE_START, gapM: HOG_MAX_GAP_M })
    const level = hogPaceW(FTP, HOG_RACE_START)
    expect(clear).toBeLessThan(level)
  })

  it('rides harder when he has been dropped', () => {
    const dropped = hogPaceW(FTP, { ...HOG_RACE_START, gapM: -HOG_MAX_GAP_M })
    expect(dropped).toBeGreaterThan(hogPaceW(FTP, HOG_RACE_START))
  })

  it('never lets the gap run away in either direction', () => {
    for (const watts of [0, 60, 150, 250, 400, 700]) {
      const s = ride(watts, 3600)
      expect(Math.abs(s.gapM), `${watts} W`).toBeLessThanOrEqual(HOG_MAX_GAP_M + 0.001)
    }
  })

  it('gets up the road on a rider who is soft pedalling', () => {
    expect(ride(80, 900).gapM).toBeGreaterThan(HOG_WAIT_M)
  })

  it('gets dropped by a rider who is going well', () => {
    expect(ride(420, 900).gapM).toBeLessThan(-HOG_WAIT_M)
  })

  it('counts a drop once, not once per tick', () => {
    const s = ride(420, 1800)
    expect(s.youDropped).toBe(1)
    expect(s.lead).toBe('you')
  })

  it('counts the lead changing hands when the ride changes', () => {
    const dropped = ride(420, 600)
    expect(dropped.youDropped).toBe(1)
    const thenEased = ride(70, 1800, dropped)
    expect(thenEased.heDropped).toBe(1)
    expect(thenEased.lead).toBe('hog')
  })

  it('holds still when there is no power and no speed, so a dropout is not a defeat', () => {
    const s = ride(300, 300)
    expect(stepHogRace(s, 10, { watts: null, kmh: null }, FTP)).toBe(s)
  })

  it('ignores a silly dt, so a slept tab does not teleport him', () => {
    const s = stepHogRace(HOG_RACE_START, 10_000, riding, FTP)
    expect(Math.abs(s.gapM)).toBeLessThan(20)
  })

  it('says where he is, in the rider units', () => {
    expect(hogGapLabel(0)).toBe('Wheel to wheel with Sir Loin')
    expect(hogGapLabel(42)).toBe('Sir Loin 42 m ahead')
    expect(hogGapLabel(-80)).toBe('80 m clear of Sir Loin')
    expect(hogGapLabel(-80, 'imperial')).toBe('262 ft clear of Sir Loin')
    expect(hogGapLabel(HOG_MAX_GAP_M)).toBe('Sir Loin is waiting up the road')
    expect(hogGapLabel(-HOG_MAX_GAP_M)).toBe('Sir Loin is out of sight behind')
  })

  it('reads the mood from the gap', () => {
    expect(hogMood(0)).toBe('together')
    expect(hogMood(60)).toBe('hog-ahead')
    expect(hogMood(-60)).toBe('you-ahead')
  })
})
