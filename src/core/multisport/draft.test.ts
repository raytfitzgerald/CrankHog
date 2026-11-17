import { describe, expect, it } from 'vitest'
import { draftFromText, draftText, newDraft, stepLine, type SessionDraft } from './draft'
import { SESSION_EXAMPLES } from './examples'
import { parseSession } from './parse'

describe('session drafts', () => {
  it('writes a new run and a new swim as files that read back without errors', () => {
    for (const sport of ['run', 'swim'] as const) {
      const { text } = draftText(newDraft(sport))
      const p = parseSession('x.txt', text)
      expect(p.errors).toEqual([])
      expect(p.header.sport).toBe(sport)
      expect(p.sections.map((s) => s.repeat)).toEqual([1, sport === 'run' ? 4 : 8, 1])
    }
    expect(draftText(newDraft('swim')).text).toContain('Main set 8x\n- 100mtr 95% Pace\n- 15s rest\n')
  })

  it('writes each kind of target, with paces per the sport’s unit', () => {
    const base = { amount: '8', unit: 'min' as const, rest: false, note: '' }
    expect(stepLine({ ...base, target: 'pace', value: '4:10 - 4:20' }, 'km')).toBe('- 8m 4:10-4:20/km Pace')
    expect(stepLine({ ...base, target: 'pace', value: '1:40' }, '100y')).toBe('- 8m 1:40/100y Pace')
    expect(stepLine({ ...base, target: 'pacePct', value: '90-95%' }, 'km')).toBe('- 8m 90-95% Pace')
    expect(stepLine({ ...base, target: 'lthrPct', value: '85' }, 'km')).toBe('- 8m 85% LTHR')
    expect(stepLine({ ...base, target: 'bpm', value: '140-150' }, 'km')).toBe('- 8m 140-150bpm')
    expect(stepLine({ ...base, amount: '1.5', unit: 'km', target: 'paceZone', value: '3', note: 'strides' }, 'km')).toBe('- 1.5km Z3 Pace strides')
    expect(stepLine({ ...base, amount: '30', unit: 'sec', target: 'none', value: '', rest: true }, 'km')).toBe('- 30s rest')
  })

  it('says which step each line came from', () => {
    const { text, steps } = draftText(newDraft('run'))
    const lines = text.split('\n')
    const [line, at] = [...steps.entries()][2]!
    expect(at).toEqual({ section: 1, step: 1 })
    expect(lines[line - 1]).toBe('- 2m Z1 HR')
  })

  it('reads the format guide’s run and swim back into drafts that write the same steps', () => {
    for (const ex of SESSION_EXAMPLES) {
      const p = parseSession(ex.fileName, ex.text)
      const r = draftFromText(ex.text)
      if (p.header.sport !== 'run' && p.header.sport !== 'swim') {
        expect(r).toEqual({ error: expect.stringContaining('runs and swims') })
        continue
      }
      if (!('draft' in r)) {
        expect(p.sections.some((s) => s.steps.length > 0)).toBe(false)
        continue
      }
      const again = parseSession('x.txt', draftText(r.draft).text)
      expect(again.errors).toEqual([])
      expect(again.sections.map((s) => s.steps.map(({ line: _line, ...st }) => st))).toEqual(p.sections.map((s) => s.steps.map(({ line: _line, ...st }) => st)))
    }
  })

  it('shows a pace in the builder’s unit, and keeps a yard pool in yards', () => {
    const r = draftFromText('sport: run\n\n- 10m 4:00/km Pace\n', 'mi')
    expect('draft' in r && r.draft.sections[0]!.steps[0]).toMatchObject({ target: 'pace', value: '6:26' })
    const swim = draftFromText('sport: swim\npool: 25y\n\n- 100y 1:30/100y Pace\n')
    expect('draft' in swim && swim.draft.sections[0]!.steps[0]).toMatchObject({ amount: '100', unit: 'y', value: '1:30' })
  })

  it('won’t make a draft of a file with errors, or a session without steps', () => {
    expect(draftFromText('sport: run\n\n- 10m Z2 HR 4:00/km Pace\n')).toEqual({ error: expect.stringContaining('line 3: one target per step') })
    expect(draftFromText('sport: run\nduration: 45m\n')).toEqual({ error: expect.stringContaining('no steps') })
  })

  it('keeps an untitled plain section apart from the one before it', () => {
    const d: SessionDraft = { ...newDraft('run'), sections: [{ title: 'Warmup', repeat: 1, steps: [] }, { title: '', repeat: 1, steps: [{ amount: '5', unit: 'min', target: 'none', value: '', rest: false, note: '' }] }] }
    expect(parseSession('x.txt', draftText(d).text).errors).toEqual([])
  })
})
