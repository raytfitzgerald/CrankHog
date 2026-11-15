// Heart-rate training load (hrTSS): a TSS-equivalent for sessions without
// power, such as a run or a strength session from a Garmin watch, so they add
// up with ride TSS. Each moving second scores (heart rate / LTHR)², the way
// TSS scores (power / FTP)², so an hour at threshold heart rate is 100.

/** One second can count at most this far above threshold (a spike or a bad strap reading). */
export const HR_LOAD_CAP = 1.5

/** hrTSS from one heart rate per moving second. Null with no heart rate or no threshold: missing is not zero. */
export function hrLoad(hr: readonly (number | null)[], lthr: number | null): number | null {
  if (lthr === null || !(lthr > 0)) return null
  let sum = 0
  let seen = 0
  for (const bpm of hr) {
    if (bpm === null || !Number.isFinite(bpm) || bpm <= 0) continue
    const f = Math.min(bpm / lthr, HR_LOAD_CAP)
    sum += f * f
    seen++
  }
  if (seen === 0) return null
  return Math.round((sum / 3600) * 100 * 10) / 10
}

/** The threshold heart rate to score against: the rider's LTHR, else 89 % of their max. */
export function lthrFor(p: { lthr?: number | null; maxHr?: number | null }): number | null {
  if (p.lthr && p.lthr > 0) return p.lthr
  if (p.maxHr && p.maxHr > 0) return Math.round(p.maxHr * 0.89)
  return null
}
