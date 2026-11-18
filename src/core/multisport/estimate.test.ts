import { describe, expect, it } from 'vitest'
import { formatSportDistance } from '../sport/format'
import { estimateSession, type SessionThresholds } from './estimate'
import { SESSION_EXAMPLES } from './examples'
import { parseSession } from './parse'

const thresholds: SessionThresholds = { runPaceSPerKm: 255, swimCssSPer100m: 100, lthr: 170 }
const estimate = (i: number, t: SessionThresholds = thresholds) => {
  const ex = SESSION_EXAMPLES[i]!
  const p = parseSession(ex.fileName, ex.text)
  return estimateSession(p.header.sport!, p.sections, p.header, t)
}

describe('estimateSession', () => {
  it('times and scores the threshold run', () => {
    const e = estimate(0)
    // 15 + 4 × (8 + 2) + 10 minutes
    expect(e.durationS).toBe(3900)
    // warmup 18.9, four efforts at threshold 53.3 plus their recoveries 8.5, cooldown 10.7
    expect(e.load).toBe(91.5)
    expect(e.distanceM).toBeGreaterThan(12_000)
    expect(e.warnings).toEqual([])
  })

  it('times the run’s HR steps without a threshold pace, but can’t tell its distance', () => {
    const e = estimate(0, { runPaceSPerKm: null, swimCssSPer100m: null, lthr: null })
    expect(e.durationS).toBe(3900)
    expect(e.distanceM).toBeNull()
    // the 4:10-4:20 efforts need a threshold pace to say how hard they are
    expect(e.load).toBeNull()
    expect(e.warnings).toEqual(['Pace targets need your threshold run pace to score the load. Set it in Settings, Athlete.'])
  })

  it('times and scores the swim from CSS, with load cubed', () => {
    const e = estimate(1)
    expect(e.distanceM).toBe(1800)
    // 400 easy 500 s, drills 4 × 77.5 s, main 10 × 115 s, 200 easy 250 s
    expect(e.durationS).toBe(2210)
    expect(e.load).toBe(42)
  })

  it('shows a swim’s distance but no time without CSS', () => {
    const e = estimate(1, {})
    expect([e.distanceM, e.durationS, e.load]).toEqual([1800, null, null])
    expect(e.warnings).toEqual(['This is a swim with distance steps, and no swim threshold pace (CSS) is set: it shows its distance but no time. Set it in Settings, Athlete.'])
  })

  it('scores the squash game by how hard it was', () => {
    expect(estimate(2)).toEqual({ durationS: 3600, distanceM: null, load: 80, warnings: [] })
  })

  it('times the easy 8k from threshold pace, or says why it can’t', () => {
    expect(estimate(3)).toEqual({ durationS: 2720, distanceM: 8000, load: 30.2, warnings: [] })
    const without = estimate(3, {})
    expect([without.durationS, without.load]).toEqual([null, null])
    expect(without.warnings[0]).toMatch(/no threshold run pace is set: it shows its distance but no time or load/)
  })

  it('gives an "other" session no distance from run pace, and no time for its distance steps', () => {
    const p = parseSession('x.txt', 'sport: other\n\n- 20m Z3 HR\n- 2km easy')
    const e = estimateSession('other', p.sections, p.header, thresholds)
    // the 20 minutes have no distance, so neither has the session: missing is not zero
    expect([e.durationS, e.distanceM, e.load]).toEqual([null, null, null])
    expect(e.warnings).toEqual(['Distance steps in an "other" session have no pace to go by, so it shows its distance but no time. Give them a time, or a pace target.'])
    const timed = parseSession('x.txt', 'sport: other\n\n- 45m Z3 HR')
    const t = estimateSession('other', timed.sections, timed.header, thresholds)
    expect([t.durationS, t.distanceM]).toEqual([2700, null])
    expect(t.load).toBeCloseTo(63.5, 1)
  })

  it('needs threshold heart rate for bpm targets', () => {
    const p = parseSession('x.txt', 'sport: run\n\n- 30m 140-150bpm')
    const e = estimateSession('run', p.sections, p.header, { runPaceSPerKm: 255 })
    expect([e.durationS, e.load]).toEqual([1800, null])
    expect(e.warnings).toEqual(['Heart-rate targets in bpm need your threshold heart rate to score the load. Set it in Settings, Athlete.'])
    // half an hour at 145 of 170 bpm: 0.5 × 0.853² × 100
    expect(estimateSession('run', p.sections, p.header, { lthr: 170 }).load).toBe(36.4)
  })
})

describe('yard totals', () => {
  const yards = (body: string) => {
    const p = parseSession('x.txt', `sport: swim\npool: 25y\n\n${body}`)
    const e = estimateSession('swim', p.sections, p.header, thresholds)
    return e.distanceM === null ? null : formatSportDistance(e.distanceM, 'swim', 'imperial')
  }

  it('adds 300 + 4 × 50 + 8 × 100 + 200 yd up to 1,500 yd, not 1,499', () => {
    expect(yards('- 300y easy\n\nDrills 4x\n- 50y drill\n- 15s rest\n\nMain set 8x\n- 100y 100% Pace\n- 15s rest\n\n- 200y easy')).toBe('1,500 yd')
    expect(yards('- 200y easy\n\n6x\n- 50y drill\n\n- 800y Z3 Pace\n\n- 200y easy')).toBe('1,500 yd')
  })

  it('adds up every whole number of lengths, and every set of 100s, exactly', () => {
    for (let lengths = 1; lengths <= 200; lengths++) expect(yards(`- ${lengths * 25}y easy`)).toBe(`${(lengths * 25).toLocaleString('en-US')} yd`)
    for (let reps = 1; reps <= 100; reps++) expect(yards(`Main ${reps}x\n- 100y easy`)).toBe(`${(reps * 100).toLocaleString('en-US')} yd`)
  })

  it('still shows the same swim as 1,372 m in metric', () => {
    const p = parseSession('x.txt', 'sport: swim\npool: 25y\n\n- 300y easy\n\n4x\n- 50y drill\n\n8x\n- 100y easy\n\n- 200y easy')
    const e = estimateSession('swim', p.sections, p.header, thresholds)
    expect(e.distanceM).toBe(1371.6)
    expect(formatSportDistance(e.distanceM!, 'swim', 'metric')).toBe('1,372 m')
  })
})
