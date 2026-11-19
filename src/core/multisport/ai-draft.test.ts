import { describe, expect, it } from 'vitest'
import { draftFromGenerated, sessionRequest, type SessionAsk } from './ai-draft'
import { draftText } from './draft'

const ask = (over: Partial<SessionAsk> = {}): SessionAsk => ({ sport: 'run', pool: '25m', units: 'metric', thresholds: { runPaceSPerKm: 270, swimCssSPer100m: 105, lthr: 168 }, request: '  45 min with hills  ', ...over })

describe('sessionRequest', () => {
  it('gives a run in the rider units, with their thresholds', () => {
    expect(sessionRequest(ask())).toBe(
      [
        'Sport: run. The rider reads distances in kilometres: write distance steps in km or mtr and paces per km.',
        'Threshold run pace: 4:30/km.',
        'Threshold heart rate (LTHR): 168 bpm.',
        '',
        "The rider's request: 45 min with hills",
      ].join('\n'),
    )
    const imperial = sessionRequest(ask({ units: 'imperial' }))
    expect(imperial).toContain('miles: write distance steps in mi and paces per mile')
    expect(imperial).toContain('Threshold run pace: 7:15/mi.')
  })

  it('gives a swim in its pool, with CSS in the pool unit', () => {
    expect(sessionRequest(ask({ sport: 'swim' }))).toContain('Sport: swim, in a 25 m pool: distances in metres ("100mtr"), in lengths of 25 m.\nCSS: 1:45/100m.')
    const yards = sessionRequest(ask({ sport: 'swim', pool: '25y' }))
    expect(yards).toContain('in a 25 yd pool: distances in yards ("100y")')
    expect(yards).toContain('CSS: 1:36/100y.')
  })

  it('says what is not set rather than sending nothing', () => {
    const r = sessionRequest(ask({ thresholds: {} }))
    expect(r).toContain('No threshold run pace set.')
    expect(r).toContain('No threshold heart rate set.')
    expect(sessionRequest(ask({ sport: 'swim', thresholds: { swimCssSPer100m: null } }))).toContain('No CSS set.')
  })
})

describe('draftFromGenerated', () => {
  it('reads a run into the builder, sections, repeats and all', () => {
    const r = draftFromGenerated(
      { name: 'Hill repeats', notes: 'Strong up,\neasy down.', steps: 'Warmup\n- 15m Z2 HR\n\nHills 6x\n- 90s Z5 HR uphill\n- 2m Z1 HR jog down\n\nCooldown\n- 10m Z1 HR' },
      ask(),
    )
    if (!('draft' in r)) throw new Error(r.error)
    expect(r.draft).toMatchObject({ sport: 'run', name: 'Hill repeats', notes: 'Strong up, easy down.' })
    expect(r.draft.sections.map((s) => [s.title, s.repeat, s.steps.length])).toEqual([
      ['Warmup', 1, 1],
      ['Hills', 6, 2],
      ['Cooldown', 1, 1],
    ])
    expect(r.draft.sections[1]!.steps[0]).toMatchObject({ amount: '90', unit: 'sec', target: 'hrZone', value: '5', note: 'uphill' })
  })

  it('shows paces in the rider units', () => {
    const r = draftFromGenerated({ name: 'Tempo', notes: '', steps: '- 20m 4:30/km Pace' }, ask({ units: 'imperial' }))
    if (!('draft' in r)) throw new Error(r.error)
    expect(r.draft.sections[0]!.steps[0]).toMatchObject({ target: 'pace', value: '7:15' })
  })

  it('drops header lines and code fences the AI added', () => {
    const r = draftFromGenerated({ name: 'Easy', notes: '', steps: '```\nsport: swim\nname: Something else\n\n- 30m Z2 HR\n```' }, ask())
    if (!('draft' in r)) throw new Error(r.error)
    expect(r.draft).toMatchObject({ sport: 'run', name: 'Easy' })
    expect(draftText(r.draft).text).toBe('sport: run\nname: Easy\n\n- 30m Z2 HR\n')
  })

  it('keeps a swim in the pool it was asked for, and reads "400m" as the pool unit, not minutes', () => {
    const r = draftFromGenerated({ name: 'CSS set', notes: '', steps: 'Warmup\n- 400m easy\n\nMain set 10x\n- 100mtr 100% Pace\n- 15s rest\n\n- 20m Z2 Pace' }, ask({ sport: 'swim', pool: '50m' }))
    if (!('draft' in r)) throw new Error(r.error)
    expect(r.draft.pool).toBe('50m')
    expect(r.draft.sections[0]!.steps[0]).toMatchObject({ amount: '400', unit: 'mtr', note: 'easy' })
    // under 100 it may well be minutes: left as written
    expect(r.draft.sections[2]!.steps[0]).toMatchObject({ amount: '20', unit: 'min' })
    const yd = draftFromGenerated({ name: 'Yards', notes: '', steps: '- 500m easy' }, ask({ sport: 'swim', pool: '25y' }))
    if (!('draft' in yd)) throw new Error(yd.error)
    expect(yd.draft.sections[0]!.steps[0]).toMatchObject({ amount: '500', unit: 'y' })
  })

  it("says why an answer can't be built, without the composed file's line numbers", () => {
    const bad = draftFromGenerated({ name: 'Broken', notes: '', steps: '- fast please' }, ask())
    expect('error' in bad && bad.error).toMatch(/^a step starts with its length/)
    const none = draftFromGenerated({ name: 'Nothing', notes: '', steps: 'Just run easy' }, ask())
    expect(none).toEqual({ error: 'It has no steps.' })
  })
})
