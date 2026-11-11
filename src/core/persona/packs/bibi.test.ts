import { describe, expect, it } from 'vitest'
import { detectProfanity, violatesGuardrails } from '../guardrails'
import { BIBI } from './bibi'

describe('Bibi', () => {
  it('names itself and its style', () => {
    expect(BIBI.meta).toMatchObject({
      id: 'bibi',
      name: 'Bibi',
      tagline: 'Grand podium oratory, dramatic pauses and a chart for every interval.',
    })
  })

  it('passes the global guardrails and never swears', () => {
    expect(BIBI.lines.filter((l) => violatesGuardrails(l.text) !== null).map((l) => l.id)).toEqual([])
    expect(BIBI.lines.filter((l) => l.profanity === true || detectProfanity(l.text) !== null).map((l) => l.id)).toEqual([])
  })

  it('stays on the requested public-rhetoric riffs', () => {
    const texts = BIBI.lines.map((l) => l.text)
    expect(texts).toContain('This interval is weeks away from a nuclear weapon.')
    expect(texts).toContain('Your FTP is months away from a breakthrough.')
    expect(texts).toContain('I have drawn a red line at {targetW} watts.')
    const count = (re: RegExp): number => texts.filter((t) => re.test(t)).length
    expect(count(/red line/i)).toBeGreaterThanOrEqual(10)
    expect(count(/\b(?:weeks|months) away\b/i)).toBeGreaterThanOrEqual(8)
    expect(count(/standing ovation/i)).toBeGreaterThanOrEqual(5)
    expect(count(/fake news/i)).toBeGreaterThanOrEqual(10)
    expect(count(/let me be very clear/i)).toBeGreaterThanOrEqual(8)
    expect(count(/\bchart\b/i)).toBeGreaterThanOrEqual(10)
    expect(count(/cartoon bomb/i)).toBeGreaterThanOrEqual(1)
    expect(count(/longest-serving/i)).toBeGreaterThanOrEqual(2)
    expect(count(/histor(?:y|ic)/i)).toBeGreaterThanOrEqual(10)
  })

})
