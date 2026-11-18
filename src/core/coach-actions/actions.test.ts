import { describe, expect, it } from 'vitest'
import type { DayMark } from '../workout/plan'
import { calendarDiff, describeOp, readProposal, relayNotes, resolveProposal, type ActionWorld, type Proposal } from './actions'
import { byRef, refOf } from './refs'

const world = (over: Partial<ActionWorld> = {}): ActionWorld => ({
  today: '2026-11-17',
  entries: [
    { id: 'e-thr', date: '2026-11-18', name: 'Threshold 2x20', sport: 'ride', planId: 'p1' },
    { id: 'e-run', date: '2026-11-19', name: 'Easy run', sport: 'run' },
    { id: 'e-old', date: '2026-11-16', name: 'Sweet spot', sport: 'ride', done: true },
  ],
  marks: [{ id: 'race', date: '2027-05-02', kind: 'event', name: 'Gran fondo', priority: 'A' } satisfies DayMark, { id: 'off', date: '2026-11-21', kind: 'rest' }],
  workouts: [
    { id: 'w-ss', name: 'Sweet Spot 3x15', sport: 'ride' },
    { id: 's-css', name: 'CSS 10x100', sport: 'swim' },
  ],
  ...over,
})
const c = (id: string) => refOf('c', id)
const m = (id: string) => refOf('m', id)
const day = (d: string) => d
const proposal = (actions: unknown[], summary = 'Changes'): Proposal => {
  const r = readProposal({ summary, actions })
  if (!r.ok) throw new Error(r.error)
  return r.proposal
}

describe('refs', () => {
  it('are short, stable and find what they name', () => {
    expect(refOf('c', 'plan-p1-i2')).toMatch(/^c[0-9a-z]{7}$/)
    expect(refOf('c', 'plan-p1-i2')).toBe(refOf('c', 'plan-p1-i2'))
    expect(refOf('c', 'plan-p1-i2')).not.toBe(refOf('m', 'plan-p1-i2'))
    expect(byRef('c', [{ id: 'a' }, { id: 'b' }], ` ${refOf('c', 'b').toUpperCase()} `)).toEqual({ id: 'b' })
    expect(byRef('c', [{ id: 'a' }], 'c0000000')).toBeUndefined()
  })
})

describe('readProposal', () => {
  it('reads sports, efforts and kinds in any case, and one bare action as a list of one', () => {
    const r = readProposal({ type: 'add_session', date: '2026-11-20', sport: 'Ride', name: 'Spin', minutes: 45, effort: 'Easy' })
    expect(r).toMatchObject({ ok: true, proposal: { summary: '', actions: [{ type: 'add_session', sport: 'bike', effort: 'easy' }] } })
    expect(readProposal({ summary: 's', actions: [{ type: 'Move', ref: 'c1', to: '2026-11-20' }] }).ok).toBe(true)
  })

  it('says what is wrong with one that does not fit, and refuses none or too many', () => {
    expect(readProposal({ summary: 's', actions: [{ type: 'teleport' }] })).toMatchObject({ ok: false, error: expect.stringContaining('actions.0') })
    expect(readProposal({ summary: 's', actions: [] })).toEqual({ ok: false, error: 'The coach proposed no changes.' })
    expect(readProposal({ summary: 's', actions: Array.from({ length: 61 }, () => ({ type: 'remove', ref: 'c1' })) }).ok).toBe(false)
    expect(readProposal('move it').ok).toBe(false)
  })
})

describe('resolveProposal', () => {
  it('moves, swaps and removes planned sessions by ref, and shows the days before and after', () => {
    const r = resolveProposal(proposal([{ type: 'swap', ref: c('e-thr'), with: c('e-run') }, { type: 'move', ref: c('e-run'), to: '2026-11-22' }]), world())
    expect(r.problems).toEqual([])
    expect(r.ops.map((o) => o.op)).toEqual(['move', 'move', 'move'])
    expect(r.diff.map((d) => d.date)).toEqual(['2026-11-18', '2026-11-19', '2026-11-22'])
    const wed = r.diff.find((d) => d.date === '2026-11-18')!
    expect(wed.rows).toEqual([
      { name: 'Threshold 2x20', sport: 'ride', change: 'removed' },
      { name: 'Easy run', sport: 'run', change: 'added' },
    ])
  })

  it('refuses a ref that is not there, a session already done, and a day that is not a day', () => {
    const r = resolveProposal(proposal([{ type: 'remove', ref: 'cnothere' }, { type: 'move', ref: c('e-old'), to: '2026-11-20' }, { type: 'move', ref: c('e-run'), to: '2026-02-30' }]), world())
    expect(r.ops).toEqual([])
    expect(r.problems).toEqual(["Change 1: There's no session cnothere on the calendar.", 'Change 2: Sweet spot on 2026-11-16 is done already.', 'Change 3: "2026-02-30" isn\'t a day.'])
    expect(r.diff).toEqual([])
  })

  it('makes workouts and sessions, plans library workouts by name, and needs steps or a length', () => {
    const r = resolveProposal(
      proposal([
        { type: 'create_workout', date: '2026-11-20', sport: 'bike', name: 'VO2 5x4', steps: '- 10m ramp 50-75%\n5x\n- 4m 115%\n- 4m 50%' },
        { type: 'create_workout', sport: 'run', name: 'Hills', steps: '- 10m Z2 HR' },
        { type: 'add_session', date: '2026-11-20', sport: 'other', name: 'Squash', minutes: 60, effort: 'hard' },
        { type: 'schedule_workout', date: '2026-11-23', workout: 'sweet spot 3X15' },
      ]),
      world(),
    )
    expect(r.problems).toEqual([])
    expect(r.ops).toMatchObject([
      { op: 'create', date: '2026-11-20', session: { sport: 'bike', name: 'VO2 5x4' } },
      { op: 'create', session: { sport: 'run' } },
      { op: 'add-session', session: { minutes: 60, effort: 'hard' } },
      { op: 'schedule', workout: { id: 'w-ss' } },
    ])
    expect(r.ops[1]).not.toHaveProperty('date')
    const bad = resolveProposal(
      proposal([
        { type: 'create_workout', sport: 'bike', name: 'Empty', steps: '  ' },
        { type: 'schedule_workout', date: '2026-11-23', workout: 'Nope' },
        { type: 'replace', ref: c('e-run'), sport: 'run', name: 'Shorter', steps: '' },
      ]),
      world(),
    )
    expect(bad.problems).toEqual(['Change 1: Empty has no steps.', 'Change 2: There\'s no workout called "Nope" in your library.', 'Change 3: Shorter needs steps, or minutes and an effort.'])
  })

  it('marks days off without doubling a day already marked, and refuses a range that ends first', () => {
    const r = resolveProposal(proposal([{ type: 'days_off', kind: 'rest', from: '2026-11-20', to: '2026-11-22', note: 'Wrecked' }]), world())
    expect(r.ops).toEqual([{ op: 'days-off', kind: 'rest', dates: ['2026-11-20', '2026-11-22'], note: 'Wrecked' }])
    expect(r.diff.flatMap((d) => d.marks)).toEqual([
      { label: 'Rest day', change: 'added' },
      { label: 'Rest day', change: 'added' },
    ])
    expect(resolveProposal(proposal([{ type: 'days_off', kind: 'sick', from: '2026-11-22', to: '2026-11-20' }]), world()).problems[0]).toContain('end')
  })

  it('adds, changes and removes events and days off', () => {
    const r = resolveProposal(
      proposal([
        { type: 'add_event', name: 'Club TT', date: '2027-03-01', priority: 'c' },
        { type: 'change_event', ref: m('race'), date: '2027-05-09' },
        { type: 'remove_day_mark', ref: m('off') },
      ]),
      world(),
    )
    expect(r.problems).toEqual([])
    expect(r.ops).toMatchObject([{ op: 'add-event', priority: 'C' }, { op: 'change-event', patch: { date: '2027-05-09' } }, { op: 'remove-mark', mark: { id: 'off' } }])
    expect(relayNotes(r.ops, world())).toEqual(['Plans built to this event re-lay to its new date.'])
    expect(resolveProposal(proposal([{ type: 'change_event', ref: m('off'), name: 'x' }]), world()).problems).toEqual([`${m('off')} is a rest day, not an event.`])
    expect(resolveProposal(proposal([{ type: 'change_event', ref: m('race'), name: 'Gran fondo', priority: 'A' }]), world()).problems).toEqual(["It doesn't change Gran fondo."])
  })

  it('logs only what has happened, and sets only sensible thresholds', () => {
    const r = resolveProposal(
      proposal([
        { type: 'log_activity', date: '2026-11-17', sport: 'other', name: 'Squash', minutes: 60, effort: 'hard', distanceKm: null },
        { type: 'set_thresholds', ftpW: 262, runThresholdPace: '4:30/km', swimCss: '1:45' },
      ]),
      world(),
    )
    expect(r.problems).toEqual([])
    expect(r.ops).toEqual([
      { op: 'log', date: '2026-11-17', session: { sport: 'other', name: 'Squash', steps: '', minutes: 60, effort: 'hard' }, distanceM: null },
      { op: 'thresholds', ftpW: 262, profile: { runThresholdPaceSPerKm: 270, swimCssSPer100m: 105 } },
    ])
    const bad = resolveProposal(proposal([{ type: 'log_activity', date: '2026-11-18', sport: 'run', name: 'Run', minutes: 30, effort: 'easy' }, { type: 'set_thresholds', ftpW: 4000 }, { type: 'set_thresholds' }]), world())
    expect(bad.problems).toEqual(["Change 1: 2026-11-18 hasn't happened yet: log it on the day, or plan it instead.", "Change 2: 4000 isn't a sensible FTP in watts.", 'Change 3: It changes no threshold.'])
  })

  it('says what plan sessions days off move', () => {
    const r = resolveProposal(proposal([{ type: 'days_off', kind: 'travel', from: '2026-11-18', to: '2026-11-19' }]), world())
    expect(relayNotes(r.ops, world())).toEqual(['Plan sessions on that day move to the next free training day.'])
  })
})

describe('describeOp', () => {
  it('says each change plainly', () => {
    const w = world()
    const lines = resolveProposal(
      proposal([
        { type: 'move', ref: c('e-thr'), to: '2026-11-20' },
        { type: 'replace', ref: c('e-run'), sport: 'run', name: 'Recovery jog', steps: '', minutes: 30, effort: 'easy' },
        { type: 'days_off', kind: 'sick', from: '2026-11-23', to: '2026-11-25' },
        { type: 'set_thresholds', ftpW: 262, lthr: 168 },
        { type: 'log_activity', date: '2026-11-16', sport: 'swim', name: 'Pool swim', minutes: 45, effort: 'moderate', distanceKm: 2 },
      ]),
      w,
    ).ops.map((o) => describeOp(o, day))
    expect(lines).toEqual([
      'Move Threshold 2x20 from 2026-11-18 to 2026-11-20',
      'Change Easy run on 2026-11-19 to Recovery jog, 30 min easy',
      'Mark 3 days, 2026-11-23 to 2026-11-25, as sick days',
      'Set FTP 262 W, threshold heart rate 168 bpm from today',
      'Log Pool swim, 45 min moderate, 2000 m, on 2026-11-16',
    ])
  })
})

describe('calendarDiff', () => {
  it('leaves out days nothing changes, and a move to the same day', () => {
    const w = world()
    expect(calendarDiff([{ op: 'move', entry: w.entries[1]!, to: '2026-11-19' }], w)).toEqual([])
  })
})
