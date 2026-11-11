import { describe, expect, it } from 'vitest'
import { PRIORITY, type CoachLine } from '../persona/types'
import { SAFETY_FALLBACK_TEXT, gateLine, matchesAny, sanitizeFacts, textAllowed } from './content'

const line = (text: string, over: Partial<CoachLine> = {}): CoachLine => ({
  text,
  speech: text,
  personaId: 'roast-comic',
  trigger: 'ride_start',
  priority: PRIORITY.cue,
  lineId: 'x',
  ...over,
})

describe('matchesAny', () => {
  it('matches normalized text as well, so leetspeak does not slip through', () => {
    const patterns = [/\bvictory\b/i]
    expect(matchesAny('Victory lap', patterns)).toBe(true)
    expect(matchesAny('V1ctory lap', patterns)).toBe(true)
    expect(matchesAny('Sweet spot 3x12', patterns)).toBe(false)
    expect(matchesAny('anything', [])).toBe(false)
  })
})

describe('sanitizeFacts', () => {
  it('drops workout names and labels that tell the rider to hurt themselves', () => {
    expect(sanitizeFacts({ workoutName: 'Kill Yourself Intervals', targetW: 300, hard: true })).toEqual({ targetW: 300, hard: true })
  })

  it('keeps everything else, however rude, and the same object when nothing needs dropping', () => {
    const data = { workoutName: 'Fat Burner 45', segmentLabel: 'Battle 2/5', power: 250 }
    expect(sanitizeFacts(data)).toBe(data)
  })
})

describe('gateLine', () => {
  it('drops self-harm on every line, at every setting, AI-written or not', () => {
    for (const profanity of ['clean', 'mild', 'unhinged'] as const) {
      expect(gateLine(line('Just kill yourself.'), { profanity })).toBeNull()
      expect(gateLine(line('Just kill yourself.', { lineId: 'ai.idle_banter.1' }), { profanity })).toBeNull()
    }
  })

  it('lets mean lines through, and holds swearing to the setting', () => {
    expect(gateLine(line('Pedal like your weight depends on it, fatso.'), { profanity: 'clean' })).not.toBeNull()
    expect(gateLine(line('Hell of an interval.'), { profanity: 'clean' })).toBeNull()
    expect(gateLine(line('Hell of an interval.'), { profanity: 'mild' })).not.toBeNull()
    expect(gateLine(line('What the fuck was that.'), { profanity: 'mild' })).toBeNull()
    expect(gateLine(line('What the fuck was that.'), { profanity: 'unhinged' })).not.toBeNull()
    expect(gateLine(line('Damn, that cadence.', { lineId: 'ai.idle_banter.3' }), { profanity: 'clean' })).toBeNull()
  })

  it('never drops a safety line: it falls back to plain words', () => {
    const bad = line('Ease off. Damn it.', { personaId: 'professional', priority: PRIORITY.safety, trigger: 'distress' })
    expect(gateLine(bad, { profanity: 'clean' })).toMatchObject({ text: SAFETY_FALLBACK_TEXT, speech: SAFETY_FALLBACK_TEXT, priority: PRIORITY.safety })
  })

  it('textAllowed agrees with the gate', () => {
    expect(textAllowed('Hold 300 watts.', 'clean')).toBe(true)
    expect(textAllowed('Damn, hold 300 watts.', 'clean')).toBe(false)
    expect(textAllowed('Damn, hold 300 watts.', 'unhinged')).toBe(true)
    expect(textAllowed('Go die, slowpoke.', 'unhinged')).toBe(false)
  })
})
