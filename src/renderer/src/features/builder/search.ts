/** The /builder route's search params: an optional bike workout id to open, or a run or swim (and the session to edit). */
export interface BuilderSearch {
  id?: string
  sport?: 'run' | 'swim'
  session?: string
}

/**
 * validateSearch for /builder. Workout ids are strings ("user:…",
 * "builtin:…"); a number is accepted too, since the router's default search
 * parser turns an all-digit value into one. No sport is the bike builder.
 */
export function parseBuilderSearch(search: Record<string, unknown>): BuilderSearch {
  const text = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? String(v) : typeof v === 'string' && v.trim() !== '' ? v : undefined)
  const sport = search.sport === 'run' || search.sport === 'swim' ? search.sport : undefined
  if (!sport) {
    const id = text(search.id)
    return id ? { id } : {}
  }
  const session = text(search.session)
  return { sport, ...(session ? { session } : {}) }
}
