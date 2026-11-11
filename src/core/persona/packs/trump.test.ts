import { describe, expect, it } from 'vitest'
import { detectProfanity, violatesGuardrails } from '../guardrails'
import { TRUMP } from './trump'

describe('The Donald', () => {
  it('names itself and its style', () => {
    expect(TRUMP.meta).toMatchObject({
      id: 'trump',
      name: 'The Donald',
      tagline: 'Tremendous watts, the best intervals and a nickname for every excuse. Believe me.',
    })
  })

  it('passes the global guardrails and never swears', () => {
    expect(TRUMP.lines.filter((l) => violatesGuardrails(l.text) !== null).map((l) => l.id)).toEqual([])
    expect(TRUMP.lines.filter((l) => l.profanity === true || detectProfanity(l.text) !== null).map((l) => l.id)).toEqual([])
  })

  it('stays on the requested public-rhetoric riffs', () => {
    const texts = TRUMP.lines.map((l) => l.text)
    expect(texts).toContain("We're going to make your FTP great again. It hasn't been great for a while, frankly.")
    expect(texts).toContain("Skipped it? You're fired. Just kidding. Mostly.")
    expect(texts).toContain("I'm putting a two hundred percent tariff on coasting. Effective immediately.")
    const count = (re: RegExp): number => texts.filter((t) => re.test(t)).length
    expect(count(/tremendous/i)).toBeGreaterThanOrEqual(10)
    expect(count(/believe me/i)).toBeGreaterThanOrEqual(8)
    expect(count(/beautiful/i)).toBeGreaterThanOrEqual(12)
    expect(count(/\bthe best\b/i)).toBeGreaterThanOrEqual(10)
    expect(count(/\bnobody\b/i)).toBeGreaterThanOrEqual(8)
    expect(count(/many people|everybody says|people are saying/i)).toBeGreaterThanOrEqual(8)
    expect(count(/fake news/i)).toBeGreaterThanOrEqual(6)
    expect(count(/low energy/i)).toBeGreaterThanOrEqual(4)
    expect(count(/\bsad\b/i)).toBeGreaterThanOrEqual(4)
    expect(count(/you're fired/i)).toBeGreaterThanOrEqual(3)
    expect(count(/winning/i)).toBeGreaterThanOrEqual(4)
    expect(count(/great again/i)).toBeGreaterThanOrEqual(3)
    expect(count(/thank you for your attention to this matter/i)).toBeGreaterThanOrEqual(4)
    expect(count(/\bsir\b/i)).toBeGreaterThanOrEqual(4)
    expect(count(/could be so complicated/i)).toBeGreaterThanOrEqual(3)
    expect(count(/tariff/i)).toBeGreaterThanOrEqual(2)
  })

})
