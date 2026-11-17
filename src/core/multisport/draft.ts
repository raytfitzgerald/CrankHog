// The run and swim builder's draft: sections and steps as the rider edits
// them, field by field. It is written out as a session file (the stored form,
// docs/WORKOUT-FORMAT.md), and a file without errors reads back into one, so
// the builder and the text never disagree about what a session is.
import type { PoolLength, SessionSection, SessionStep, StepTarget } from './model'
import { parseSession } from './parse'

export type BuildSport = 'run' | 'swim'
export type LengthUnit = 'min' | 'sec' | 'km' | 'mtr' | 'mi' | 'y'
export type TargetKind = 'none' | 'hrZone' | 'paceZone' | 'pace' | 'pacePct' | 'lthrPct' | 'bpm'
/** Pace is per km or mile on a run, per 100 m or 100 yd on a swim. */
export type PacePer = 'km' | 'mi' | '100m' | '100y'

export interface DraftStep {
  /** "15", "1.5", "400": the number, as typed. */
  amount: string
  unit: LengthUnit
  target: TargetKind
  /** The target's value as typed: a zone ("2"), a pace or range ("4:10-4:20"), a percent or range ("90-95"), beats ("140-150"). */
  value: string
  rest: boolean
  note: string
}

export interface DraftSection {
  title: string
  /** 1 for a plain section. */
  repeat: number
  steps: DraftStep[]
}

export interface SessionDraft {
  sport: BuildSport
  name: string
  /** Swims only. */
  pool: PoolLength
  notes: string
  sections: DraftSection[]
}

export const UNIT_SUFFIX: Record<LengthUnit, string> = { min: 'm', sec: 's', km: 'km', mtr: 'mtr', mi: 'mi', y: 'y' }
const M_PER_MI = 1609.344
const M_PER_YD = 0.9144

/** What a swim's paces are per: the pool's unit. */
export const swimPer = (pool: PoolLength): PacePer => (pool === '25y' ? '100y' : '100m')

export function newStep(sport: BuildSport, pool: PoolLength = '25m'): DraftStep {
  return sport === 'run'
    ? { amount: '5', unit: 'min', target: 'hrZone', value: '2', rest: false, note: '' }
    : { amount: '100', unit: pool === '25y' ? 'y' : 'mtr', target: 'pacePct', value: '90', rest: false, note: '' }
}

/** A new session to start from: a warmup, a main set and a cooldown. */
export function newDraft(sport: BuildSport): SessionDraft {
  const step = (amount: string, unit: LengthUnit, target: TargetKind, value: string, rest = false): DraftStep => ({ amount, unit, target, value, rest, note: '' })
  if (sport === 'run') {
    return {
      sport,
      name: 'New run',
      pool: '25m',
      notes: '',
      sections: [
        { title: 'Warmup', repeat: 1, steps: [step('15', 'min', 'hrZone', '2')] },
        { title: 'Main set', repeat: 4, steps: [step('4', 'min', 'hrZone', '4'), step('2', 'min', 'hrZone', '1')] },
        { title: 'Cooldown', repeat: 1, steps: [step('10', 'min', 'hrZone', '1')] },
      ],
    }
  }
  return {
    sport,
    name: 'New swim',
    pool: '25m',
    notes: '',
    sections: [
      { title: 'Warmup', repeat: 1, steps: [step('400', 'mtr', 'paceZone', '2')] },
      { title: 'Main set', repeat: 8, steps: [step('100', 'mtr', 'pacePct', '95'), step('15', 'sec', 'none', '', true)] },
      { title: 'Cooldown', repeat: 1, steps: [step('200', 'mtr', 'paceZone', '1')] },
    ],
  }
}

const squash = (s: string) => s.replace(/\s+/g, '')

function targetText(step: DraftStep, per: PacePer): string {
  const v = squash(step.value)
  switch (step.target) {
    case 'none':
      return ''
    case 'hrZone':
      return `Z${v} HR`
    case 'paceZone':
      return `Z${v} Pace`
    case 'pace':
      return `${v}/${per} Pace`
    case 'pacePct':
      return `${v.replace(/%$/, '')}% Pace`
    case 'lthrPct':
      return `${v.replace(/%$/, '')}% LTHR`
    case 'bpm':
      return `${v.replace(/bpm$/i, '')}bpm`
  }
}

/** One step's line: "- 4m Z4 HR", "- 15s rest", "- 100mtr 95% Pace drill". */
export function stepLine(step: DraftStep, per: PacePer): string {
  return ['-', `${squash(step.amount)}${UNIT_SUFFIX[step.unit]}`, targetText(step, per), step.rest ? 'rest' : '', step.note.trim()].filter(Boolean).join(' ')
}

/** What run paces are per for the rider's units. */
export const runPer = (units: 'metric' | 'imperial'): PacePer => (units === 'imperial' ? 'mi' : 'km')

/**
 * The draft as a session file, and which section and step each step line
 * came from, so a message about a line can be shown on its step.
 */
export function draftText(d: SessionDraft, runPace: PacePer = 'km'): { text: string; steps: Map<number, { section: number; step: number }> } {
  const per = d.sport === 'swim' ? swimPer(d.pool) : runPace
  const head = [`sport: ${d.sport}`, `name: ${d.name.trim() || (d.sport === 'run' ? 'Run' : 'Swim')}`]
  if (d.sport === 'swim') head.push(`pool: ${d.pool}`)
  if (d.notes.trim()) head.push(`notes: ${d.notes.trim().replace(/\s*\n\s*/g, ' ')}`)
  const lines = [...head, '']
  const steps = new Map<number, { section: number; step: number }>()
  d.sections.forEach((s, si) => {
    if (si > 0) lines.push('')
    const title = s.title.trim()
    if (s.repeat > 1) lines.push(`${title ? `${title} ` : ''}${s.repeat}x`)
    // an untitled plain section has no heading line, so it needs the blank line above to stand apart
    else if (title) lines.push(title)
    s.steps.forEach((st, i) => {
      lines.push(stepLine(st, per))
      steps.set(lines.length, { section: si, step: i })
    })
  })
  return { text: `${lines.join('\n')}\n`, steps }
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`
const range = (a: number, b: number, f: (n: number) => string = String) => (a === b ? f(a) : `${f(a)}-${f(b)}`)
const round = (n: number, places = 2) => String(Math.round(n * 10 ** places) / 10 ** places)

/** Seconds per `from` as seconds per `to`: a pace in another unit. */
function convertPace(s: number, from: PacePer, to: PacePer): number {
  const metres: Record<PacePer, number> = { km: 1000, mi: M_PER_MI, '100m': 100, '100y': 100 * M_PER_YD }
  return Math.round((s / metres[from]) * metres[to])
}

function targetDraft(t: StepTarget | undefined, per: PacePer): Pick<DraftStep, 'target' | 'value'> {
  if (!t) return { target: 'none', value: '' }
  switch (t.kind) {
    case 'pace':
      return { target: 'pace', value: range(convertPace(t.low, t.per, per), convertPace(t.high, t.per, per), mmss) }
    case 'hrZone':
    case 'paceZone':
      return { target: t.kind, value: String(t.zone) }
    case 'pacePct':
    case 'lthrPct':
    case 'bpm':
      return { target: t.kind, value: range(t.low, t.high) }
  }
}

function lengthDraft(st: SessionStep, sport: BuildSport, pool: PoolLength): Pick<DraftStep, 'amount' | 'unit'> {
  if (st.distanceM !== undefined) {
    if (sport === 'swim' && pool === '25y') return { amount: String(Math.round(st.distanceM / M_PER_YD)), unit: 'y' }
    if (sport === 'run' && st.distanceM >= 1000) return { amount: round(st.distanceM / 1000, 3), unit: 'km' }
    return { amount: String(Math.round(st.distanceM)), unit: 'mtr' }
  }
  const s = st.durationS ?? 0
  return s % 60 === 0 ? { amount: String(s / 60), unit: 'min' } : { amount: String(s), unit: 'sec' }
}

/** Sections read from a file, as a draft's: lengths in the units the builder offers, paces in `per`. */
export function sectionsDraft(sections: readonly SessionSection[], sport: BuildSport, pool: PoolLength, per: PacePer): DraftSection[] {
  return sections.map((s) => ({
    title: s.title ?? '',
    repeat: s.repeat,
    steps: s.steps.map((st) => ({ ...lengthDraft(st, sport, pool), ...targetDraft(st.target, per), rest: !!st.rest, note: st.note ?? '' })),
  }))
}

/**
 * A session file read back into a draft, or the errors that stop it. Only a
 * run or a swim with steps can be a draft: other sessions, and ones that are
 * just a time and an effort, stay as text.
 */
export function draftFromText(text: string, runPace: PacePer = 'km'): { draft: SessionDraft } | { error: string } {
  const p = parseSession('Session.txt', text)
  if (p.errors.length > 0) return { error: p.errors.map((e) => (e.line ? `line ${e.line}: ${e.text}` : e.text)).join(' ') }
  const sport = p.header.sport
  if (sport !== 'run' && sport !== 'swim') return { error: 'The builder builds runs and swims. This session stays as text.' }
  if (!p.sections.some((s) => s.steps.length > 0)) return { error: 'This session has no steps to build with. Add some in the text, or keep it as text.' }
  const pool = p.header.pool ?? '25m'
  const per = sport === 'swim' ? swimPer(pool) : runPace
  return { draft: { sport, name: p.name, pool, notes: p.header.notes ?? '', sections: sectionsDraft(p.sections, sport, pool, per) } }
}
