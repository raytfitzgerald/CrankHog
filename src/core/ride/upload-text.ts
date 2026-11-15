// The description CrankHog writes under a ride it uploads to Strava and
// intervals.icu: a line about CrankHog (or the rider's own, or none: Settings →
// Strava & sync), a journey's line when there is one, and the numbers people
// actually look at.

export const SITE = 'crankhog.app'

/** The rotating lines, one per ride. Sir Loin's rule holds: nothing about what a hog is made of. */
export const HOG_LINES: readonly string[] = [
  'Cranked hog with CrankHog',
  'Went the whole hog with CrankHog',
  'Went hog wild with CrankHog',
  'Hogged the trainer with CrankHog',
  'Chased Sir Loin with CrankHog',
]

export type DescriptionLine = 'hog' | 'cranked' | 'whole-hog' | 'recorded' | 'custom' | 'none'

/** The fixed lines a rider can pick instead of the rotating ones. */
export const FIXED_LINES: Readonly<Record<'cranked' | 'whole-hog' | 'recorded', string>> = {
  cranked: 'Cranked hog with CrankHog',
  'whole-hog': 'Went the whole hog with CrankHog',
  recorded: 'Recorded with CrankHog',
}

export const MAX_CUSTOM_LINE = 200

export interface DescriptionPrefs {
  line: DescriptionLine
  /** The rider's own line, used when `line` is 'custom'. */
  custom: string
  /** The numbers: NP, IF, TSS, kJ and average heart rate. */
  stats: boolean
}

export interface RideNumbers {
  np: number | null
  intensityFactor: number | null
  tss: number | null
  kj: number
  avgHr: number | null
}

/** Picks from the ride's id, so a retried upload keeps its line. */
function pick(rideId: string): string {
  let h = 0
  for (const ch of rideId) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return HOG_LINES[h % HOG_LINES.length]!
}

/** The first line, or null when the rider wants none. CrankHog's own lines carry the site's address. */
export function crankHogLine(prefs: DescriptionPrefs, rideId: string): string | null {
  switch (prefs.line) {
    case 'none':
      return null
    case 'custom': {
      const own = prefs.custom.replace(/\s+/g, ' ').trim().slice(0, MAX_CUSTOM_LINE)
      return own || null
    }
    case 'hog':
      return `${pick(rideId)} · ${SITE}`
    default:
      return `${FIXED_LINES[prefs.line]} · ${SITE}`
  }
}

export function numbersLine(n: RideNumbers): string {
  return [
    n.np !== null ? `NP ${n.np} W` : null,
    n.intensityFactor !== null ? `IF ${n.intensityFactor.toFixed(2)}` : null,
    n.tss !== null ? `TSS ${Math.round(n.tss)}` : null,
    `${Math.round(n.kj)} kJ`,
    n.avgHr !== null ? `avg HR ${n.avgHr}` : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

/** The whole description; empty when the rider turned everything off. */
export function uploadDescription(o: { prefs: DescriptionPrefs; rideId: string; numbers: RideNumbers; extra?: string }): string {
  return [crankHogLine(o.prefs, o.rideId), o.extra?.trim() || null, o.prefs.stats ? numbersLine(o.numbers) : null].filter(Boolean).join('\n')
}
