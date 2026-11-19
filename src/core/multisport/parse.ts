// Reads a run, swim or other session file (docs/WORKOUT-FORMAT.md):
//
//   sport: run                 header lines, "key: value"
//   name: Threshold 4x8
//                              a blank line
//   Warmup                     a section title
//   - 15m Z2 HR                a step: length, at most one target, words
//
//   Main set 4x                a repeat: the steps under it, to the next blank line
//   - 8m 4:10-4:20/km Pace
//   - 2m Z1 HR
//
// The steps are intervals.icu's workout text. Nothing here throws: every
// problem comes back as an error (the file is skipped) or a warning (it is
// imported), with the line it is on.
import { isSportGroup } from '../sport/group'
import { isEffort, type Effort } from '../sport/load'
import { parseDatedFileName } from '../workout/plan'
import type { DateKey } from '../workout/schedule'
import type { DistanceUnit, PoolLength, SessionSection, SessionSport, SessionStep, StepTarget } from './model'

export interface SessionMessage {
  /** 1-based line in the file; missing for a message about the whole file. */
  line?: number
  text: string
}

export interface SessionHeader {
  sport: SessionSport | null
  name?: string
  date?: DateKey
  pool?: PoolLength
  durationS?: number
  distanceM?: number
  effort?: Effort
  notes?: string
}

export interface ParsedSession {
  header: SessionHeader
  /** The name to show: the header's, else the file name without its date. */
  name: string
  /** The day it goes on: the header's date, else the file name's. */
  date: DateKey | null
  sections: SessionSection[]
  /** The lines after the header: what is sent to intervals.icu. */
  body: string
  errors: SessionMessage[]
  warnings: SessionMessage[]
}

const MAX_LINES = 500
const MAX_REPEAT = 100
const MAX_STEPS = 1000
const M_PER_MI = 1609.344
const M_PER_YD = 0.9144

const HEADER_LINE = /^([a-z][a-z ]*?)\s*:\s*(.*)$/i
const KEYS = new Set(['sport', 'name', 'date', 'pool', 'duration', 'distance', 'effort', 'notes'])

/** Whether a file is a session file rather than a bike workout: its header names a sport. */
export function isSessionFile(text: string): boolean {
  for (const raw of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) return false
    const m = HEADER_LINE.exec(line)
    if (!m) return false
    if (m[1]!.toLowerCase() === 'sport') return true
  }
  return false
}

/** How many metres one of each unit is. */
export const METRES: Record<DistanceUnit, number> = { mtr: 1, km: 1000, mi: M_PER_MI, y: M_PER_YD }

/**
 * A time: "30s", "10m", "1h", "1h20m", "5m30s". `m` is always minutes. Or a
 * distance: "400mtr", "1.5km", "1mi", "100y". A distance keeps its metres to
 * the tenth of a millimetre, so yards add up exactly: rounding 100y to 91.4 m
 * made 15 of them 1,499 yd.
 */
export function parseLength(token: string): { durationS?: number; distanceM?: number; distanceUnit?: DistanceUnit } | null {
  const t = token.toLowerCase()
  const time = /^(?:(\d+(?:\.\d+)?)h)?(?:(\d+(?:\.\d+)?)m)?(?:(\d+(?:\.\d+)?)s)?$/.exec(t)
  if (time && (time[1] ?? time[2] ?? time[3]) !== undefined) {
    const s = Number(time[1] ?? 0) * 3600 + Number(time[2] ?? 0) * 60 + Number(time[3] ?? 0)
    return s > 0 ? { durationS: s } : null
  }
  const dist = /^(\d+(?:\.\d+)?)(mtr|km|mi|y|yd)$/.exec(t)
  if (dist) {
    const unit: DistanceUnit = dist[2] === 'yd' ? 'y' : (dist[2] as DistanceUnit)
    const m = Number(dist[1]) * METRES[unit]
    return m > 0 ? { distanceM: Math.round(m * 1e4) / 1e4, distanceUnit: unit } : null
  }
  return null
}

const clock = (mm: string, ss: string) => Number(mm) * 60 + Number(ss)

/** The step's target from its words, and what's left over as its note. Two targets is an error. */
function readTarget(words: string[], line: number, errors: SessionMessage[]): { target?: StepTarget; rest: boolean; note: string[] } {
  const found: { target: StepTarget; text: string }[] = []
  const note: string[] = []
  let rest = false
  for (let i = 0; i < words.length; i++) {
    const w = words[i]!
    const lower = w.toLowerCase()
    const next = words[i + 1]?.toLowerCase()
    const pace = /^(\d+):(\d{2})(?:-(\d+):(\d{2}))?\/(km|mi|100m|100y)$/.exec(lower)
    if (pace) {
      const a = clock(pace[1]!, pace[2]!)
      const b = pace[3] ? clock(pace[3], pace[4]!) : a
      found.push({ target: { kind: 'pace', low: Math.min(a, b), high: Math.max(a, b), per: pace[5] as 'km' | 'mi' | '100m' | '100y' }, text: next === 'pace' ? `${w} ${words[i + 1]}` : w })
      if (next === 'pace') i++
      continue
    }
    const pct = /^(\d+(?:\.\d+)?)(?:-(\d+(?:\.\d+)?))?%$/.exec(lower)
    if (pct) {
      const a = Number(pct[1])
      const b = pct[2] ? Number(pct[2]) : a
      if (next === 'pace') found.push({ target: { kind: 'pacePct', low: Math.min(a, b), high: Math.max(a, b) }, text: `${w} ${words[i + 1]}` })
      else if (next === 'lthr') found.push({ target: { kind: 'lthrPct', low: Math.min(a, b), high: Math.max(a, b) }, text: `${w} ${words[i + 1]}` })
      else {
        errors.push({ line, text: `say what "${w}" is a percent of: "${w} Pace" (threshold pace) or "${w} LTHR" (threshold heart rate).` })
        continue
      }
      i++
      continue
    }
    const zone = /^z([1-7])$/.exec(lower)
    if (zone) {
      const z = Number(zone[1])
      if (next === 'pace') found.push({ target: { kind: 'paceZone', zone: z }, text: `${w} ${words[i + 1]}` })
      else if (next === 'hr') found.push({ target: { kind: 'hrZone', zone: z }, text: `${w} ${words[i + 1]}` })
      else {
        errors.push({ line, text: `say which zone "${w}" is: "${w} HR" or "${w} Pace".` })
        continue
      }
      i++
      continue
    }
    const bpm = /^(\d+)(?:-(\d+))?bpm$/.exec(lower)
    if (bpm) {
      const a = Number(bpm[1])
      const b = bpm[2] ? Number(bpm[2]) : a
      found.push({ target: { kind: 'bpm', low: Math.min(a, b), high: Math.max(a, b) }, text: w })
      continue
    }
    if (lower === 'rest') {
      rest = true
      continue
    }
    note.push(w)
  }
  if (found.length > 1) errors.push({ line, text: `one target per step. "${found.map((f) => f.text).join(' ')}" has ${found.length === 2 ? 'two' : found.length}.` })
  return { target: found[0]?.target, rest, note }
}

function readHeaderValue(key: string, value: string, line: number, header: SessionHeader, errors: SessionMessage[]): void {
  const v = value.trim()
  switch (key) {
    case 'sport': {
      const s = v.toLowerCase()
      if (s === 'run' || s === 'swim' || s === 'other') header.sport = s
      else if (isSportGroup(s) || s === 'bike') errors.push({ line, text: 'sport must be run, swim or other. A bike workout has no sport line.' })
      else errors.push({ line, text: 'sport must be run, swim or other.' })
      return
    }
    case 'name':
      if (v) header.name = v.slice(0, 120)
      return
    case 'notes':
      if (v) header.notes = v.slice(0, 300)
      return
    case 'date': {
      const { date } = parseDatedFileName(`${v}_x`)
      if (date && date === v) header.date = date
      else errors.push({ line, text: `date must be a real day written YYYY-MM-DD, like 2026-12-02.` })
      return
    }
    case 'pool':
      if (v === '25m' || v === '50m' || v === '25y') header.pool = v
      else errors.push({ line, text: 'pool must be 25m, 50m or 25y.' })
      return
    case 'duration': {
      const len = parseLength(v.replace(/\s+/g, ''))
      if (len?.durationS) header.durationS = len.durationS
      else errors.push({ line, text: `duration must be a time, like 45m, 1h or 1h15m.` })
      return
    }
    case 'distance': {
      const t = v.replace(/\s+/g, '').toLowerCase()
      // a distance is never a time, so here "5000m" can only mean metres
      const metres = parseLength(t)?.distanceM ?? parseLength(t.replace(/m$/, 'mtr'))?.distanceM
      if (metres) header.distanceM = metres
      else errors.push({ line, text: `distance must have a unit, like 8km, 5mi, 2000mtr or 1650y.` })
      return
    }
    case 'effort': {
      const e = v.toLowerCase()
      if (isEffort(e)) header.effort = e
      else errors.push({ line, text: 'effort must be easy, moderate, hard or max.' })
      return
    }
  }
}

/** Reads a session file. `fileName` gives the name and day when the header doesn't. */
export function parseSession(fileName: string, text: string): ParsedSession {
  const errors: SessionMessage[] = []
  const warnings: SessionMessage[] = []
  const header: SessionHeader = { sport: null }
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/)
  if (lines.length > MAX_LINES) errors.push({ text: `The file is ${lines.length} lines long; a session can have at most ${MAX_LINES}.` })

  // header: "key: value" lines at the top, to the first blank line or step
  let i = 0
  for (; i < lines.length && i < MAX_LINES; i++) {
    const line = lines[i]!.trim()
    if (!line) {
      i++
      break
    }
    const m = HEADER_LINE.exec(line)
    if (!m || line.startsWith('-')) break
    const key = m[1]!.toLowerCase().trim()
    if (!KEYS.has(key)) {
      warnings.push({ line: i + 1, text: `"${key}" isn't a header CrankHog knows, so it's ignored. The headers are sport, name, date, pool, duration, distance, effort and notes.` })
      continue
    }
    readHeaderValue(key, m[2]!, i + 1, header, errors)
  }
  if (header.sport === null && !errors.some((e) => /^sport/.test(e.text))) errors.push({ text: 'No sport line: start the file with "sport: run", "sport: swim" or "sport: other".' })
  const bodyStart = i

  // steps
  const sections: SessionSection[] = []
  let current: SessionSection | null = null
  let steps = 0
  const close = () => {
    if (current && (current.steps.length > 0 || current.title)) sections.push(current)
    current = null
  }
  for (; i < lines.length && i < MAX_LINES; i++) {
    const n = i + 1
    const line = lines[i]!.trim()
    if (!line) {
      close()
      continue
    }
    if (line.startsWith('-')) {
      const words = line.replace(/^-\s*/, '').split(/\s+/).filter(Boolean)
      const first = words.shift() ?? ''
      const len = parseLength(first)
      if (!len) {
        errors.push({ line: n, text: `a step starts with its length: a time like "10m" (minutes) or "30s", or a distance like "400mtr", "1km" or "100y". "${first || line}" isn't one.` })
        continue
      }
      const { target, rest, note } = readTarget(words, n, errors)
      const step: SessionStep = { line: n, ...len, ...(target ? { target } : {}), ...(rest ? { rest } : {}), ...(note.length ? { note: note.join(' ') } : {}) }
      // "50m" is 50 minutes. A swim is counted in lengths, so any minutes there gets the warning; a run's only from 100 up
      if (len.durationS && header.sport !== 'other' && /^\d+(?:\.\d+)?m$/i.test(first) && (header.sport === 'swim' || len.durationS >= 100 * 60)) {
        warnings.push({ line: n, text: `"${first}" is ${first.slice(0, -1)} minutes. For metres write ${first.slice(0, -1)}mtr.` })
      }
      current ??= { repeat: 1, steps: [] }
      current.steps.push(step)
      steps += current.repeat
      continue
    }
    const rep = /^(.*?)\s*(\d+)\s*x$/i.exec(line)
    if (rep) {
      const count = Number(rep[2])
      if (current && (current as SessionSection).repeat > 1 && (current as SessionSection).steps.length > 0) {
        errors.push({ line: n, text: 'a repeat inside a repeat isn\'t supported. Write the inner set out, or leave a blank line before a new set.' })
        continue
      }
      if (count < 1 || count > MAX_REPEAT) {
        errors.push({ line: n, text: `a set repeats 1 to ${MAX_REPEAT} times; "${count}x" is too many.` })
        continue
      }
      close()
      current = { ...(rep[1] ? { title: rep[1] } : {}), repeat: count, steps: [] }
      continue
    }
    close()
    current = { title: line.slice(0, 80), repeat: 1, steps: [] }
  }
  close()
  if (steps > MAX_STEPS) errors.push({ text: `With its repeats, the session has ${steps} steps; at most ${MAX_STEPS} are allowed.` })

  const hasSteps = sections.some((s) => s.steps.length > 0)
  if (!hasSteps && header.durationS === undefined && header.distanceM === undefined) errors.push({ text: 'No steps, and no duration or distance: add "duration: 45m" or some steps.' })
  if (hasSteps) {
    for (const k of ['duration', 'distance', 'effort'] as const) {
      const at = lines.slice(0, bodyStart).findIndex((l) => new RegExp(`^\\s*${k}\\s*:`, 'i').test(l))
      if (at >= 0) warnings.push({ line: at + 1, text: `${k} is ignored: the steps set the ${k === 'effort' ? 'load' : k === 'duration' ? 'time' : 'distance'}.` })
    }
  }
  if (header.sport === 'swim' && header.pool) {
    const lengthM = header.pool === '25y' ? 25 * M_PER_YD : header.pool === '50m' ? 50 : 25
    for (const s of sections) {
      for (const st of s.steps) {
        if (st.distanceM === undefined) continue
        const lengths = st.distanceM / lengthM
        if (Math.abs(lengths - Math.round(lengths)) > 0.01) {
          warnings.push({ line: st.line, text: `distance ${formatDistance(st.distanceM, st.distanceUnit)} isn't a whole number of ${header.pool} lengths.` })
        }
      }
    }
  }
  if (header.pool && header.sport && header.sport !== 'swim') warnings.push({ text: 'pool is only for swims, so it\'s ignored.' })

  const fromName = parseDatedFileName(fileName)
  return {
    header,
    name: header.name ?? (fromName.rest.trim() || 'Session'),
    date: header.date ?? fromName.date,
    sections,
    body: lines.slice(bodyStart).join('\n').trim(),
    errors,
    warnings,
  }
}

/** A step written back in the format: "- 8m 4:10-4:20/km Pace drill". */
export function formatStep(st: SessionStep): string {
  const len = st.distanceM !== undefined ? formatDistance(st.distanceM, st.distanceUnit) : formatTime(st.durationS ?? 0)
  const parts = [len]
  if (st.target) parts.push(formatTarget(st.target))
  if (st.rest) parts.push('rest')
  if (st.note) parts.push(st.note)
  return `- ${parts.join(' ')}`
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`
const range = (a: number, b: number, f: (n: number) => string = String) => (a === b ? f(a) : `${f(a)}-${f(b)}`)

export function formatTarget(t: StepTarget): string {
  switch (t.kind) {
    case 'pace':
      return `${range(t.low, t.high, mmss)}/${t.per} Pace`
    case 'pacePct':
      return `${range(t.low, t.high)}% Pace`
    case 'paceZone':
      return `Z${t.zone} Pace`
    case 'hrZone':
      return `Z${t.zone} HR`
    case 'lthrPct':
      return `${range(t.low, t.high)}% LTHR`
    case 'bpm':
      return `${range(t.low, t.high)}bpm`
  }
}

function formatTime(s: number): string {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = Math.round(s % 60)
  return `${h ? `${h}h` : ''}${m ? `${m}m` : ''}${sec ? `${sec}s` : ''}` || '0s'
}

/** A distance in the unit it was written in; a step made without one (not read from a file) in metres or km. */
function formatDistance(m: number, unit?: DistanceUnit): string {
  if (unit) return `${Math.round((m / METRES[unit]) * 1000) / 1000}${unit}`
  if (m >= 1000 && Number.isInteger(m / 100)) return `${m / 1000}km`
  return `${Math.round(m)}mtr`
}

/** The sections written back as steps: what parseSession reads back to the same sections. */
export function formatSections(sections: readonly SessionSection[]): string {
  return sections
    .map((s) => {
      const head = s.repeat > 1 ? [`${s.title ? `${s.title} ` : ''}${s.repeat}x`] : s.title ? [s.title] : []
      return [...head, ...s.steps.map(formatStep)].join('\n')
    })
    .join('\n\n')
}
