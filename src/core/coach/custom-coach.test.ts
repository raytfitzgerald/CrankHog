import { describe, expect, it } from 'vitest'
import { CoachEngine } from '../persona/engine'
import { mulberry32 } from '../persona/rng'
import { SEGMENT_SAMPLES, sampleContext } from '../persona/samples'
import { quipLinesFromPack } from './ai-quips'
import { coachVoice } from './voice'
import {
  coachNameProblem,
  customCoachLinesFromPack,
  customCoachLinesPrompt,
  customCoachMeta,
  customCoachPack,
  customTagline,
  newCustomCoachId,
  parseCustomCoaches,
  phraseProblem,
  type CustomCoach,
} from './custom-coach'

const COACH: CustomCoach = {
  id: 'custom-abc123def0',
  name: 'Uncle Rog',
  photo: null,
  persona: 'A retired domestique from Yorkshire. Dry, blunt and secretly proud of me.',
  phrases: [
    { text: 'Right then. Legs on.', moment: 'start' },
    { text: 'Here it comes. Bite down.', moment: 'hard' },
  ],
  aiLines: [{ trigger: 'workout_complete', text: 'Not bad. Kettle is on.' }],
  createdAt: 1,
  updatedAt: 1,
}

const engine = (coach: CustomCoach, profanity: 'clean' | 'mild' | 'unhinged' = 'clean') =>
  new CoachEngine({ persona: customCoachPack(coach), spice: 3, profanity, rng: mulberry32(7) })

describe('custom coaches', () => {
  it('makes ids the stored-coach schema accepts', () => {
    const id = newCustomCoachId(mulberry32(1))
    expect(id).toMatch(/^custom-[a-z0-9]{10}$/)
    expect(parseCustomCoaches([{ ...COACH, id }])).toHaveLength(1)
  })

  it('drops a bad stored line, not the coach it belongs to', () => {
    const [c] = parseCustomCoaches([{ ...COACH, phrases: [...COACH.phrases, { text: 'x', moment: 'someday' }], aiLines: [{ trigger: 'gone_trigger', text: 'Hello there' }] }])
    expect(c?.phrases).toEqual(COACH.phrases)
    expect(c?.aiLines).toEqual([])
  })

  it('holds every per-ride AI line to the self-harm rule, and nothing else', () => {
    const fine = ['A record. Kettle is on.', 'Saddle up, you chubby lump.', 'Halfway. Grand.', 'Spin it up.']
    const reply = { lines: [{ trigger: 'ride_start', text: 'Just kill yourself, slowpoke.' }, ...fine.map((text) => ({ trigger: 'idle_banter', text }))] }
    for (const persona of [customCoachMeta({ ...COACH, persona: 'Mean as anything.' }), { id: 'drill-sergeant', name: 'Drill Sergeant', tagline: '' }]) {
      const out = quipLinesFromPack(reply, { persona, spice: 5, profanity: 'unhinged' })
      expect(out.lines.map((l) => l.text)).toEqual(fine)
      expect(out.rejected).toEqual([{ text: 'Just kill yourself, slowpoke.', reason: 'self-harm' }])
    }
  })

  it('keeps only stored coaches that parse, once per id', () => {
    const coaches = parseCustomCoaches([COACH, { ...COACH }, { ...COACH, id: 'drill-sergeant' }, { ...COACH, id: 'custom-zzzzzz', photo: 'javascript:alert(1)' }, 'nope'])
    expect(coaches.map((c) => c.id)).toEqual([COACH.id])
    expect(parseCustomCoaches(null)).toEqual([])
  })

  it('says the rider’s own lines at the moments they picked', () => {
    const e = engine(COACH)
    expect(e.consider(sampleContext('ride_start'))?.text).toBe('Right then. Legs on.')
    expect(e.consider(sampleContext('segment_start', 60_000, SEGMENT_SAMPLES.on))?.text).toBe('Here it comes. Bite down.')
    expect(e.consider(sampleContext('workout_complete', 200_000))?.text).toBe('Not bad. Kettle is on.')
  })

  it('never says an interval line at a warm-up', () => {
    const lines = customCoachPack(COACH).lines.filter((l) => l.triggers.includes('segment_start'))
    expect(lines).toHaveLength(1)
    expect(lines[0]!.criteria).toEqual([{ key: 'hard', op: '==', value: true }])
  })

  it('flags swearing so the Profanity setting still applies', () => {
    const sweary = { ...COACH, phrases: [{ text: 'Shift, you lazy bastard.', moment: 'start' as const }] }
    const pack = customCoachPack(sweary)
    expect(pack.lines.find((l) => l.triggers.includes('ride_start'))?.profanity).toBe(true)
    expect(engine(sweary, 'clean').consider(sampleContext('ride_start'))?.text).not.toBe('Shift, you lazy bastard.')
    expect(engine(sweary, 'unhinged').consider(sampleContext('ride_start'))?.text).toBe('Shift, you lazy bastard.')
  })

  it('refuses lines and names that tell the rider to hurt themselves, and nothing meaner than that', () => {
    expect(phraseProblem('Go die in a ditch, slowpoke')).toMatch(/hurt or kill themselves/)
    expect(phraseProblem('Pedal, you fat lump')).toBeNull()
    expect(phraseProblem('Lovely spin today')).toBeNull()
    expect(phraseProblem('Hold {pwoer} watts')).toMatch(/\{pwoer\}/)
    expect(phraseProblem('Hold {power} watts')).toBeNull()
    expect(phraseProblem('Go go go 🔥')).toMatch(/emoji/)
    expect(coachNameProblem('  ')).toMatch(/name/)
    expect(coachNameProblem('Uncle Rog')).toBeNull()
    expect(coachNameProblem('Kill Yourself Kevin')).toMatch(/hurt or kill themselves/)
    // and drops them if they ever turn up stored
    const pack = customCoachPack({ ...COACH, phrases: [{ text: 'Go die in a ditch', moment: 'any' }] })
    expect(pack.lines.some((l) => l.text.includes('die'))).toBe(false)
  })

  it('tags the coach with its first sentence and carries the description to the AI', () => {
    expect(customTagline(COACH.persona)).toBe('A retired domestique from Yorkshire.')
    expect(customTagline('')).toBe('Your own coach.')
    const meta = customCoachMeta(COACH)
    expect(meta.persona).toBe(COACH.persona)
    expect(customCoachLinesPrompt(meta, { spice: 3, profanity: 'mild' })).toContain('secretly proud of me')
    expect(coachVoice(customCoachPack(COACH), { spice: 3, profanity: 'mild' })).toContain("Uncle Rog is, in the rider's own words")
  })

  it('stores only the AI lines that pass the quip rules and the guardrails', () => {
    const reply = {
      lines: [
        { trigger: 'ride_start', text: 'Saddle up, lad.' },
        { trigger: 'halfway', text: 'Halfway. Just drop dead already.' },
        { trigger: 'distress', text: 'Breathe.' },
        { trigger: 'pr', text: 'A record. Don’t let it go to your head.' },
        { trigger: 'idle_banter', text: 'Grand day for it.' },
        { trigger: 'idle_banter', text: 'Grand day for it.' },
      ],
    }
    const lines = customCoachLinesFromPack(reply, { meta: customCoachMeta(COACH), spice: 3, profanity: 'clean' })
    expect(lines).toEqual([
      { trigger: 'ride_start', text: 'Saddle up, lad.' },
      { trigger: 'pr', text: 'A record. Don’t let it go to your head.' },
      { trigger: 'idle_banter', text: 'Grand day for it.' },
    ])
  })
})
