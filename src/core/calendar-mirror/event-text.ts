// What a planned entry says in Google Calendar: its name as the title, and
// a description with the sport, length and load, then a run, swim or other
// session's steps as written in its .txt file (header lines left out), then
// the workout's own notes. Plain text, sentence case, no emoji.
import { SPORT_GROUP_LABEL, type SportGroup } from '../sport/group'
import { EFFORT_LABEL, type Effort } from '../sport/load'
import { formatSportDistance } from '../sport/format'
import type { UnitSystem } from '../units'
import type { DateKey } from '../workout/schedule'
import type { MirrorEvent } from './mirror'

/** A planned entry with what the renderer looked up about it (the library workout's length and TSS). */
export interface MirrorSource {
  id: string
  date: DateKey
  name: string
  sport: SportGroup
  /** "Squash", "Long run": a session's own label. */
  label?: string
  durationS?: number | null
  distanceM?: number | null
  tss?: number | null
  /** A session's planned load, when it has no TSS from steps. */
  load?: number | null
  effort?: Effort
  /** A session's steps in intervals.icu text, as in its .txt file without the header lines. */
  steps?: string
  /** The workout's description, or a session's notes. */
  notes?: string
}

export const MIRROR_FOOTER = 'Planned in CrankHog. Move or change it there: this calendar follows CrankHog.'

const TITLE_MAX = 300
// Together with the summary and the footer, these keep the description under
// the 8000 characters the IPC contract allows.
const STEPS_MAX = 6000
const NOTES_MAX = 1500

/** Trimmed text no longer than `max`: cut at the last line break that fits (else at `max`), with "…" to show it goes on. */
export function clip(text: string | undefined, max: number): string | undefined {
  const t = text?.trim()
  if (!t || t.length <= max) return t || undefined
  const room = t.slice(0, max - 2)
  const cut = room.lastIndexOf('\n')
  return `${(cut > 0 ? room.slice(0, cut) : room).trimEnd()}\n…`
}

/** 3600 → "1 h", 4500 → "1 h 15 min", 2700 → "45 min". */
export function plainDuration(s: number): string {
  const m = Math.round(s / 60)
  const h = Math.floor(m / 60)
  const rest = m % 60
  if (h === 0) return `${rest} min`
  return rest === 0 ? `${h} h` : `${h} h ${rest} min`
}

export function mirrorEvent(src: MirrorSource, units: UnitSystem): MirrorEvent {
  const facts: string[] = [src.label && src.label !== src.name ? `${SPORT_GROUP_LABEL[src.sport]}: ${src.label}` : SPORT_GROUP_LABEL[src.sport]]
  if (src.durationS && src.durationS > 0) facts.push(plainDuration(src.durationS))
  if (src.distanceM && src.distanceM > 0) facts.push(formatSportDistance(src.distanceM, src.sport, units))
  if (src.effort) facts.push(EFFORT_LABEL[src.effort])
  if (src.tss != null && src.tss > 0) facts.push(`TSS ${Math.round(src.tss)}`)
  else if (src.load != null && src.load > 0) facts.push(`Load ${Math.round(src.load)}`)
  const description = [facts.join(' · '), clip(src.steps, STEPS_MAX), clip(src.notes, NOTES_MAX), MIRROR_FOOTER].filter(Boolean).join('\n\n')
  const title = (src.name.trim() || SPORT_GROUP_LABEL[src.sport]).slice(0, TITLE_MAX)
  return { key: src.id, date: src.date, title, description }
}
