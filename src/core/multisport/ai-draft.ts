// "Describe a workout" in the run and swim builder: what the AI is told about
// the session it drafts, and its answer read into a builder draft. The answer's
// steps go through the session parser like any session file, so the builder
// only ever opens a draft it can save.
import type { GeneratedSession } from '../ai/schemas'
import { draftFromText, runPer, type BuildSport, type SessionDraft } from './draft'
import type { SessionThresholds } from './estimate'
import type { PoolLength } from './model'
import { parseSession } from './parse'

const M_PER_MI = 1609.344
const M_PER_YD = 0.9144
/** A header line in the steps: CrankHog writes the header itself. */
const HEADER = /^\s*(sport|name|date|pool|duration|distance|effort|notes)\s*:/i

const POOL: Record<PoolLength, string> = {
  '25m': 'a 25 m pool: distances in metres ("100mtr"), in lengths of 25 m',
  '50m': 'a 50 m pool: distances in metres ("100mtr"), in lengths of 50 m',
  '25y': 'a 25 yd pool: distances in yards ("100y"), in lengths of 25 yd',
}

const mmss = (s: number) => {
  const r = Math.round(s)
  return `${Math.floor(r / 60)}:${String(r % 60).padStart(2, '0')}`
}
const oneLine = (s: string) => s.trim().replace(/\s*\n\s*/g, ' ')

/** What the builder knows when the rider asks: the sport, the pool, the rider's units and thresholds, and the request. */
export interface SessionAsk {
  sport: BuildSport
  /** Swims: the pool the builder has. */
  pool: PoolLength
  units: 'metric' | 'imperial'
  thresholds: SessionThresholds
  request: string
}

/** The user message: what the session is for, in the rider's units, then their request. */
export function sessionRequest(a: SessionAsk): string {
  const t = a.thresholds
  const lines: string[] = []
  if (a.sport === 'run') {
    const mi = a.units === 'imperial'
    lines.push(`Sport: run. The rider reads distances in ${mi ? 'miles: write distance steps in mi and paces per mile' : 'kilometres: write distance steps in km or mtr and paces per km'}.`)
    lines.push(t.runPaceSPerKm ? `Threshold run pace: ${mi ? `${mmss((t.runPaceSPerKm * M_PER_MI) / 1000)}/mi` : `${mmss(t.runPaceSPerKm)}/km`}.` : 'No threshold run pace set.')
  } else {
    lines.push(`Sport: swim, in ${POOL[a.pool]}.`)
    lines.push(t.swimCssSPer100m ? `CSS: ${a.pool === '25y' ? `${mmss(t.swimCssSPer100m * M_PER_YD)}/100y` : `${mmss(t.swimCssSPer100m)}/100m`}.` : 'No CSS set.')
  }
  lines.push(t.lthr ? `Threshold heart rate (LTHR): ${Math.round(t.lthr)} bpm.` : 'No threshold heart rate set.')
  lines.push('', `The rider's request: ${a.request.trim()}`)
  return lines.join('\n')
}

/**
 * "- 400m" on a swim is 400 minutes. From 100 up it can only mean the pool's
 * unit, so it's written so; less stays as it is, with the parser's warning.
 */
function swimLength(line: string, pool: PoolLength): string {
  return line.replace(/^(\s*-\s*)(\d+)m(?=\s|$)/, (all, lead: string, n: string) => (Number(n) >= 100 ? `${lead}${n}${pool === '25y' ? 'y' : 'mtr'}` : all))
}

/** The AI's session as a builder draft, or why it can't be one. */
export function draftFromGenerated(g: GeneratedSession, ask: Pick<SessionAsk, 'sport' | 'pool' | 'units'>): { draft: SessionDraft } | { error: string } {
  const steps = g.steps
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((l) => !/^\s*```/.test(l) && !HEADER.test(l))
    .map((l) => (ask.sport === 'swim' ? swimLength(l, ask.pool) : l))
    .join('\n')
    .trim()
  const head = [`sport: ${ask.sport}`, `name: ${oneLine(g.name)}`]
  if (ask.sport === 'swim') head.push(`pool: ${ask.pool}`)
  if (g.notes.trim()) head.push(`notes: ${oneLine(g.notes)}`)
  const text = `${head.join('\n')}\n\n${steps}\n`
  const parsed = parseSession('Session.txt', text)
  // the parser's own words, without line numbers: they're the composed file's, not the AI's
  const say = (errors: readonly { text: string }[]) => ({ error: errors.slice(0, 3).map((e) => e.text).join(' ') })
  const onLines = parsed.errors.filter((e) => e.line !== undefined)
  if (onLines.length > 0) return say(onLines)
  // the parser would ask for a duration header, which is CrankHog's to write
  if (!parsed.sections.some((s) => s.steps.length > 0)) return { error: 'It has no steps.' }
  if (parsed.errors.length > 0) return say(parsed.errors)
  return draftFromText(text, runPer(ask.units))
}
