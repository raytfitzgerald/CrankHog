// Which release notes to show on launch, if any.
import { WHATS_NEW, type WhatsNewEntry } from './notes'

/** A rider who skipped several updates gets the latest few, not a backlog. */
export const MAX_ENTRIES = 3

/** Compares "0.6.4"-style versions; anything after a "-" (the web build's "-web") is ignored. */
export function compareVersions(a: string, b: string): number {
  const parts = (v: string) => v.split('-')[0]!.split('.').map((n) => Number.parseInt(n, 10) || 0)
  const pa = parts(a)
  const pb = parts(b)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d !== 0) return Math.sign(d)
  }
  return 0
}

export interface WhatsNewInput {
  /** The version whose notes the rider last saw; null before this existed, or on a new install. */
  seen: string | null
  /** The running version. */
  current: string
  /** The install has history (rides or saved devices), so a null `seen` is an update, not a first launch. */
  returning: boolean
  notes?: readonly WhatsNewEntry[]
}

/**
 * The notes to show, newest first: every release after `seen` up to the
 * running one. A new install sees nothing. An update from a version that
 * predates these notes sees only the running version's, since there is no
 * telling which of the older ones the rider already had.
 */
export function notesToShow({ seen, current, returning, notes = WHATS_NEW }: WhatsNewInput): WhatsNewEntry[] {
  if (seen === null) return returning ? notes.filter((n) => compareVersions(n.version, current) === 0).slice(0, 1) : []
  if (compareVersions(seen, current) >= 0) return []
  return notes
    .filter((n) => compareVersions(n.version, seen) > 0 && compareVersions(n.version, current) <= 0)
    .sort((a, b) => compareVersions(b.version, a.version))
    .slice(0, MAX_ENTRIES)
}

/** The running version's notes, or the latest before it: what Settings → About shows again. */
export function latestNotes(current: string, notes: readonly WhatsNewEntry[] = WHATS_NEW): WhatsNewEntry | null {
  return [...notes].sort((a, b) => compareVersions(b.version, a.version)).find((n) => compareVersions(n.version, current) <= 0) ?? null
}
