// The one guardrail on everything a coach may say (canned lines, user-made
// coaches, AI output): nothing that tells the rider to hurt or kill
// themselves. CrankHog is an adult app and its owner chose to let the coaches
// be mean about anything else, so the topic lists that used to sit here (body,
// health, politics, violence and the rest) are gone on purpose. The list is a
// curated regex and deliberately broad: a false positive only costs one line,
// while a miss is spoken aloud to someone mid-interval.
//
// Matching runs on normalized text: lowercase, accents stripped, curly
// apostrophes folded, and leetspeak between letters undone ("f4t" → "fat").

export type GuardrailCategory = 'self-harm'

export interface GuardrailRule {
  category: GuardrailCategory
  /** Matches normalized text (see normalizeForMatching). */
  pattern: RegExp
}

// Each entry is a regex fragment, wrapped in \b(?: … )\b when compiled.
const TERMS: Record<GuardrailCategory, readonly string[]> = {
  'self-harm': [
    'suicid(?:e|es|al)',
    'kill (?:yourself|yourselves|urself|myself)',
    'kys',
    'unalive',
    'end (?:it all|your life|your own life|my life)',
    'take your (?:own )?life',
    'self[- ]?harm(?:ing)?',
    'cut(?:ting)? (?:yourself|myself)',
    'slit (?:your |my )?wrists?',
    'hang (?:yourself|myself)',
    'jump off (?:a|the) (?:bridge|cliff|building|roof)',
    'overdos(?:e|ed|es|ing)',
    'anorexi(?:a|c)',
    'bulimi(?:a|c)',
    'eating disorders?',
    'starv(?:e|ing) yourself',
    'purg(?:e|es|ing)',
    'go die',
    'just die',
    'die already',
    'hope you die',
    'should (?:just )?die',
    'drop dead',
    'wish (?:you|i) (?:were|was) dead',
    'better off dead',
    'kill me now',
    '(?:want|wanna|wants) to die',
    'death wish',
    'cry for help',
  ],
}

const CATEGORY_ORDER: readonly GuardrailCategory[] = ['self-harm']

function compile(terms: readonly string[]): RegExp {
  return new RegExp(`\\b(?:${terms.join('|')})\\b`, 'i')
}

export const GUARDRAILS: readonly GuardrailRule[] = CATEGORY_ORDER.map((category) => ({
  category,
  pattern: compile(TERMS[category]),
}))

const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's', '!': 'i' }

/** Lowercase, strip accents, fold apostrophes, undo leetspeak between letters, squash whitespace. */
export function normalizeForMatching(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[‘’ʼ`´]/g, "'")
    .replace(/(?<=[a-z])[013457@$!](?=[a-z])/g, (c) => LEET[c] ?? c)
    .replace(/\s+/g, ' ')
}

export interface GuardrailMatch {
  category: GuardrailCategory
  /** The text that matched, for error messages. */
  match: string
}

export function guardrailMatch(text: string): GuardrailMatch | null {
  const norm = normalizeForMatching(text)
  for (const rule of GUARDRAILS) {
    const m = rule.pattern.exec(norm)
    if (m) return { category: rule.category, match: m[0] }
  }
  return null
}

/** The banned category a text touches, or null when it is clean. Use it on AI output too. */
export function violatesGuardrails(text: string): GuardrailCategory | null {
  return guardrailMatch(text)?.category ?? null
}

// Profanity is a user setting, not a guardrail. Clean drops both kinds, Mild
// allows the mild list only, Unhinged allows everything.
const MILD_PROFANITY = compile([
  'damn(?:s|ed|it)?',
  'dammit',
  'hell',
  'crap(?:s|py|pier)?',
  'bloody',
  'arse',
  'ass',
  'asses',
  'badass',
  'half-ass(?:ed)?',
  'kick-?ass',
  'smart-?ass',
  'jackass',
  'dumbass',
  'piss(?:es|ed|ing)?',
  'piss-poor',
  'freaking',
  "frickin(?:g|')?",
  "friggin(?:g|')?",
  'bugger',
  'sod (?:off|it)',
  'bollocks',
  'screw (?:it|this|that|you)',
])

const STRONG_PROFANITY_WORDS = compile([
  'f+u+c+k\\w*',
  'fck\\w*',
  'fuk\\w*',
  'motherf\\w*',
  'mofo',
  'sh[i1]t\\w*',
  'bullsh[i1]t\\w*',
  'cunts?',
  'twats?',
  'wank\\w*',
  'bitch\\w*',
  'bastards?',
  'assholes?',
  'arseholes?',
  'dick(?:s|head|heads)?',
  'cocks?',
  'cocksuck\\w*',
  'puss(?:y|ies)',
  'pricks?',
  'sluts?',
  'whores?',
  'goddamn\\w*',
  'son of a bitch',
  'wtf',
  'stfu',
  'omfg',
  'douche(?:bag|bags)?',
  'asshats?',
  'numbnuts',
  'dickwads?',
  'bellends?',
  'knob(?:head|heads)?',
  'tossers?',
  'pillocks?',
])
/** Censored forms ("f***", "sh*t") count as strong: the intent is the same. */
const CENSORED_PROFANITY = /\b(?:f|sh)[*#@]+/i

export type ProfanityLevel = 'mild' | 'strong'

export function detectProfanity(text: string): ProfanityLevel | null {
  const norm = normalizeForMatching(text)
  if (STRONG_PROFANITY_WORDS.test(norm) || CENSORED_PROFANITY.test(norm)) return 'strong'
  if (MILD_PROFANITY.test(norm)) return 'mild'
  return null
}

const MILD_GLOBAL = new RegExp(MILD_PROFANITY.source, 'gi')
const STRONG_GLOBAL = new RegExp(STRONG_PROFANITY_WORDS.source, 'gi')
const bleep = (word: string) => word[0] + word.slice(1).replace(/[a-z]/gi, '*')

/**
 * Text the rider didn't pick a coach for (workout cues, say), bleeped to fit
 * their language setting: "fucking" becomes "f******" on Clean and Mild,
 * "damn" becomes "d***" on Clean, and Unhinged leaves everything as written.
 */
export function maskLanguage(text: string, setting: 'clean' | 'mild' | 'unhinged'): string {
  if (setting === 'unhinged') return text
  let out = text.replace(STRONG_GLOBAL, bleep)
  if (setting === 'clean') out = out.replace(MILD_GLOBAL, bleep)
  return out
}

/** Does the text's language fit the rider's setting (Clean, Mild or Unhinged). */
export function languageAllowed(text: string, setting: 'clean' | 'mild' | 'unhinged'): boolean {
  if (setting === 'unhinged') return true
  const found = detectProfanity(text)
  return found === null || (setting === 'mild' && found === 'mild')
}
