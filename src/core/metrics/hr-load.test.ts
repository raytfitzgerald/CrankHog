import { describe, expect, it } from 'vitest'
import { hrLoad, lthrFor } from './hr-load'

const at = (bpm: number | null, seconds: number) => Array.from({ length: seconds }, () => bpm)

describe('hrLoad (hrTSS)', () => {
  it('is 100 for an hour at threshold heart rate, like TSS for an hour at FTP', () => {
    expect(hrLoad(at(160, 3600), 160)).toBe(100)
  })

  it('weighs effort by the square of the fraction of threshold', () => {
    // an hour at 80 % of LTHR: 0.8² × 100
    expect(hrLoad(at(128, 3600), 160)).toBe(64)
    // half an hour at threshold
    expect(hrLoad(at(160, 1800), 160)).toBe(50)
  })

  it('caps a single second at 1.5 × threshold, so a bad reading cannot run away', () => {
    expect(hrLoad(at(400, 3600), 160)).toBe(225)
  })

  it('skips seconds with no reading: missing is not zero', () => {
    expect(hrLoad([...at(160, 1800), ...at(null, 1800)], 160)).toBe(50)
  })

  it('is null with no heart rate at all, or no threshold to compare with', () => {
    expect(hrLoad(at(null, 600), 160)).toBeNull()
    expect(hrLoad([], 160)).toBeNull()
    expect(hrLoad(at(150, 600), null)).toBeNull()
    expect(hrLoad(at(150, 600), 0)).toBeNull()
  })
})

describe('lthrFor', () => {
  it('uses the rider’s LTHR, else 89 % of max heart rate, else nothing', () => {
    expect(lthrFor({ lthr: 168, maxHr: 190 })).toBe(168)
    expect(lthrFor({ maxHr: 190 })).toBe(169)
    expect(lthrFor({})).toBeNull()
  })
})
