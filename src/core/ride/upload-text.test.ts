import { describe, expect, it } from 'vitest'
import { crankHogLine, HOG_LINES, MAX_CUSTOM_LINE, uploadDescription, type DescriptionPrefs, type RideNumbers } from './upload-text'

const NUMBERS: RideNumbers = { np: 210, intensityFactor: 0.824, tss: 64.6, kj: 812.4, avgHr: 145 }
const prefs = (p: Partial<DescriptionPrefs>): DescriptionPrefs => ({ line: 'hog', custom: '', stats: true, ...p })

describe('upload description', () => {
  it('puts the CrankHog line first, then the numbers', () => {
    expect(uploadDescription({ prefs: prefs({ line: 'recorded' }), rideId: 'r1', numbers: NUMBERS })).toBe(
      'Recorded with CrankHog · crankhog.app\nNP 210 W · IF 0.82 · TSS 65 · 812 kJ · avg HR 145',
    )
  })

  it("keeps a journey's line between them", () => {
    const text = uploadDescription({ prefs: prefs({ line: 'cranked' }), rideId: 'r1', numbers: NUMBERS, extra: 'Day 3 of the Tour' })
    expect(text.split('\n')).toEqual(['Cranked hog with CrankHog · crankhog.app', 'Day 3 of the Tour', 'NP 210 W · IF 0.82 · TSS 65 · 812 kJ · avg HR 145'])
  })

  it('leaves out numbers a ride has none of', () => {
    const text = uploadDescription({ prefs: prefs({ line: 'none' }), rideId: 'r1', numbers: { np: null, intensityFactor: null, tss: null, kj: 0.4, avgHr: null } })
    expect(text).toBe('0 kJ')
  })

  it('is empty with no line and no numbers', () => {
    expect(uploadDescription({ prefs: prefs({ line: 'none', stats: false }), rideId: 'r1', numbers: NUMBERS })).toBe('')
  })
})

describe('the CrankHog line', () => {
  it('rotates through the hog lines by ride, the same line on every retry', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 200; i++) {
      const line = crankHogLine(prefs({ line: 'hog' }), `ride-${i}`)!
      expect(line).toBe(crankHogLine(prefs({ line: 'hog' }), `ride-${i}`))
      seen.add(line.replace(' · crankhog.app', ''))
    }
    expect([...seen].sort()).toEqual([...HOG_LINES].sort())
  })

  it("uses the rider's own line as written, tidied and capped, without the address", () => {
    expect(crankHogLine(prefs({ line: 'custom', custom: '  Suffered  in the\nshed  ' }), 'r1')).toBe('Suffered in the shed')
    expect(crankHogLine(prefs({ line: 'custom', custom: 'x'.repeat(500) }), 'r1')).toHaveLength(MAX_CUSTOM_LINE)
  })

  it('has no line for an empty custom one, or none', () => {
    expect(crankHogLine(prefs({ line: 'custom', custom: '   ' }), 'r1')).toBeNull()
    expect(crankHogLine(prefs({ line: 'none' }), 'r1')).toBeNull()
  })

  it('keeps the hog lines in the app voice', () => {
    for (const line of HOG_LINES) expect(line).not.toMatch(/!|\p{Extended_Pictographic}|bacon|pork|ham\b|sausage/iu)
  })
})
