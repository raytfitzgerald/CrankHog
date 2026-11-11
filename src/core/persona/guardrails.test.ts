import { describe, expect, it } from 'vitest'
import { GUARDRAILS, detectProfanity, guardrailMatch, normalizeForMatching, violatesGuardrails } from './guardrails'

// Lines no coach (canned, user-authored or AI) may say: the one guardrail left.
const SELF_HARM: readonly string[] = [
  'Just kill yourself.',
  'kys',
  'Go die in a ditch.',
  'Starve yourself before the race.',
  'Jump off a bridge if you skip again.',
  'You would be better off dead.',
  'Drop dead, slowpoke.',
  'That cadence is a cry for help.',
]

// Mean, crude or political, and allowed: CrankHog is an adult app, and only self-harm is filtered.
const MEAN_BUT_ALLOWED: readonly string[] = [
  'Pedal harder, fatso.',
  'Your BMI called. It wants a word.',
  "Don't have a heart attack.",
  'Jesus, that was slow.',
  'The president rides faster than you.',
  'Vote for more intervals.',
  'Massacre the climb.',
  'Even Putin could hold 300 watts.',
]

// Things coaches do say, some of which trip naive filters.
const CLEAN = [
  'Heart rate is high. Ease off.',
  'Hang in there!',
  'Coming out of the saddle for the sprint.',
  'Great pedal stroke.',
  'Your power-to-weight ratio is climbing.',
  "You're killing it!",
  'Show some guts!',
  'Gut check time.',
  'Polish your pedal stroke.',
  'Yank on the bars.',
  'You woke up early for this.',
  'Clean execution.',
  'Cadence is your secret weapon.',
  'This is going to hurt.',
  'Dead legs are normal at minute 18.',
  "You're over the hump.",
  'Attack the climb.',
  'Battle the headwind.',
  'Let the interval begin.',
  'History will judge this interval.',
  'Your excuse is fake news.',
  'I have drawn a red line at 300 watts.',
  'This interval is weeks away from a nuclear weapon.',
  'Here is the cartoon bomb. The fuse is your W′bal.',
  'Standing ovations in Congress for this effort.',
  'Welcome to the People’s Republic of Pain.',
  'The Ministry of Watts demands 300.',
  'Feel the burn.',
  'Zen and the art of the pedal stroke.',
  'Drink your electrolytes.',
  'Tour de France pros would be proud.',
  'Hold 287 watts for 2:05.',
  'Fatigue is normal at this point.',
  'Stay seated and spin.',
  'Drop the hammer!',
  'Recruit, sound off!',
  'A steady training regime pays off.',
  'Hit the wall? Eat a gel.',
  "Your heart's doing an encore.",
  'I sighed. Loudly.',
]

describe('violatesGuardrails', () => {
  it('catches self-harm, leetspeak and all', () => {
    expect(SELF_HARM.filter((l) => violatesGuardrails(l) !== 'self-harm')).toEqual([])
    expect(violatesGuardrails('just k1ll yourself')).toBe('self-harm')
  })

  it('lets everything else through, however mean', () => {
    expect(MEAN_BUT_ALLOWED.filter((l) => violatesGuardrails(l) !== null)).toEqual([])
  })

  it('lets ordinary coaching through', () => {
    const flagged = CLEAN.map((l) => [l, guardrailMatch(l)] as const).filter(([, m]) => m !== null)
    expect(flagged).toEqual([])
  })

  it('reports what matched, for error messages', () => {
    expect(guardrailMatch('Just kill yourself')).toEqual({ category: 'self-harm', match: 'kill yourself' })
    expect(guardrailMatch('Fine.')).toBeNull()
  })

  it('has the one rule', () => {
    expect(GUARDRAILS.map((g) => g.category)).toEqual(['self-harm'])
    expect(GUARDRAILS[0]!.pattern).toBeInstanceOf(RegExp)
  })
})

describe('normalizeForMatching', () => {
  it('lowercases, strips accents, folds apostrophes and undoes leetspeak between letters', () => {
    expect(normalizeForMatching('Crème BRÛLÉE')).toBe('creme brulee')
    expect(normalizeForMatching('you’re')).toBe("you're")
    expect(normalizeForMatching('f4t k1ll s3x')).toBe('fat kill sex')
    expect(normalizeForMatching('Hold 300 W for 3x12')).toBe('hold 300 w for 3x12')
  })
})

describe('detectProfanity', () => {
  it('separates mild words, strong words and clean text', () => {
    expect(detectProfanity('Pedal, damn it!')).toBe('mild')
    expect(detectProfanity('Hell yeah!')).toBe('mild')
    expect(detectProfanity('That was half-assed.')).toBe('mild')
    expect(detectProfanity('Bloody marvelous.')).toBe('mild')
    expect(detectProfanity('What the fuck')).toBe('strong')
    expect(detectProfanity('You bellend')).toBe('strong')
    expect(detectProfanity('Holy sh*t')).toBe('strong')
    expect(detectProfanity('f*** this hill')).toBe('strong')
    expect(detectProfanity('wtf was that')).toBe('strong')
    expect(detectProfanity('Hello, class. Pass the bass.')).toBeNull()
    expect(detectProfanity('Shift down and spin.')).toBeNull()
  })
})
