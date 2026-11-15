// The description CrankHog writes under a ride it uploads to Strava and
// intervals.icu. The rider writes it in Settings → Strava & sync; {stats}
// stands for the numbers they tick, in a fixed order. On a journey, the
// journey's line goes above it.

export const STATS_TOKEN = '{stats}'
export const MAX_DESCRIPTION = 1000

export type DescriptionStat = 'avgPower' | 'np' | 'maxPower' | 'avgHr' | 'maxHr' | 'avgCadence' | 'kj' | 'tss' | 'if'

export interface RideNumbers {
  avgPower: number | null
  np: number | null
  maxPower: number | null
  avgHr: number | null
  maxHr: number | null
  avgCadence: number | null
  kj: number
  tss: number | null
  intensityFactor: number | null
}

const int = (v: number | null) => (v === null || !Number.isFinite(v) ? null : Math.round(v))

/** Every number a rider can include, in the order they appear. A ride without one (no HR strap) leaves it out. */
export const DESCRIPTION_STATS: readonly { id: DescriptionStat; label: string; text: (n: RideNumbers) => string | null }[] = [
  { id: 'avgPower', label: 'Average power', text: (n) => (int(n.avgPower) !== null ? `Avg power ${int(n.avgPower)} W` : null) },
  { id: 'np', label: 'Normalized power', text: (n) => (int(n.np) !== null ? `NP ${int(n.np)} W` : null) },
  { id: 'maxPower', label: 'Max power', text: (n) => (int(n.maxPower) !== null ? `Max power ${int(n.maxPower)} W` : null) },
  { id: 'avgHr', label: 'Average heart rate', text: (n) => (int(n.avgHr) !== null ? `Avg HR ${int(n.avgHr)} bpm` : null) },
  { id: 'maxHr', label: 'Max heart rate', text: (n) => (int(n.maxHr) !== null ? `Max HR ${int(n.maxHr)} bpm` : null) },
  { id: 'avgCadence', label: 'Average cadence', text: (n) => (int(n.avgCadence) !== null ? `Avg cadence ${int(n.avgCadence)} rpm` : null) },
  { id: 'kj', label: 'Total output', text: (n) => `Total output ${int(n.kj) ?? 0} kJ` },
  { id: 'tss', label: 'TSS', text: (n) => (int(n.tss) !== null ? `TSS ${int(n.tss)}` : null) },
  { id: 'if', label: 'Intensity factor', text: (n) => (n.intensityFactor !== null && Number.isFinite(n.intensityFactor) ? `IF ${n.intensityFactor.toFixed(2)}` : null) },
]

export function statsText(numbers: RideNumbers, stats: readonly DescriptionStat[]): string {
  return DESCRIPTION_STATS.filter((s) => stats.includes(s.id))
    .map((s) => s.text(numbers))
    .filter((t): t is string => t !== null)
    .join(' · ')
}

/**
 * The description: the rider's text with {stats} filled in. A line left with
 * nothing but separators once {stats} comes out empty is dropped; the rest of
 * the text stays as written. Empty means send no description.
 */
export function uploadDescription(o: { text: string; stats: readonly DescriptionStat[]; numbers: RideNumbers; extra?: string }): string {
  const stats = statsText(o.numbers, o.stats)
  const lines = o.text
    .slice(0, MAX_DESCRIPTION)
    .split(/\r?\n/)
    .flatMap((line) => {
      if (!line.includes(STATS_TOKEN)) return [line]
      const filled = line.split(STATS_TOKEN).join(stats)
      if (stats) return [filled]
      // "Cranked hog · {stats} · CrankHog.app" with nothing ticked: no doubled separator
      const tidied = filled.replace(/(\s*·\s*){2,}/g, ' · ').replace(/^\s*·\s*|\s*·\s*$/g, '')
      return tidied.trim() ? [tidied] : []
    })
  return [o.extra?.trim() || null, lines.join('\n').trim() || null].filter(Boolean).join('\n')
}
