import { describe, expect, it } from 'vitest'
import { matchesAny, personaBannedPatterns } from '../coach/content'
import { HOG } from '../mascot/hog'
import { detectProfanity, violatesGuardrails } from '../persona/guardrails'
import { PACKS } from '../persona/packs'
import { allTaunts, rivalTaunt } from './rival'

describe('the coach, yelling at the hog', () => {
  it('every persona has taunts that are clean and pass its own guardrails', () => {
    for (const p of PACKS) {
      const lines = allTaunts(p.meta.id)
      expect(lines.length).toBeGreaterThanOrEqual(2)
      for (const line of lines) {
        const t = line.replaceAll('{hog}', HOG.name)
        expect(detectProfanity(t), t).toBeNull()
        expect(violatesGuardrails(t), t).toBeNull()
        expect(matchesAny(t, personaBannedPatterns(p.meta.id)), t).toBe(false)
      }
    }
  })

  it('names Sir Loin in the line it hands back', () => {
    expect(rivalTaunt('zen', () => 0)).toContain(HOG.name)
    expect(rivalTaunt('zen', () => 0)).not.toContain('{hog}')
  })

  it('falls back to a generic line for a persona with none of its own', () => {
    const line = rivalTaunt('a-custom-persona', () => 0)
    expect(line).toContain(HOG.name)
  })

  it('never jokes about the hog being a pig in a way that is about a body', () => {
    const banned = /\b(fat|bacon|ham|pork|sausage|slaughter|eat(en|ing)?|dinner|roast(ed)?|bbq)\b/i
    for (const p of PACKS) {
      for (const line of allTaunts(p.meta.id)) {
        expect(banned.test(line), `${p.meta.id}: ${line}`).toBe(false)
      }
    }
  })
})
