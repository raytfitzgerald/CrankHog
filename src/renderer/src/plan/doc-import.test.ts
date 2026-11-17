import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PlanImportOutput } from '@core/ai/schemas'
import { CHUNK_MAX } from '@core/plan-import/chunk'
import type { ImportDoc, ImportItem } from '@core/plan-import/model'
import { dateKeyToMs } from '@core/workout/schedule'
import type { CrankHogBridge } from '@shared/ipc/contract'
import { db } from '../db/db'
import { saveWorkout } from '../workouts/library'
import { updateMark } from './day-marks-repo'
import type { ExtractedDocument } from './doc-extract'
import { PlanImportError, prepareImport, readTemplateDocument, readWithAi, saveImport } from './doc-import'

const invoke = vi.fn()
beforeEach(async () => {
  await db().delete()
  await db().open()
  invoke.mockReset()
  window.crankhog = { invoke, on: () => () => undefined, send: () => undefined } as unknown as CrankHogBridge
})

type AiItem = PlanImportOutput['items'][number]
const aiItem = (patch: Partial<AiItem>): AiItem => ({ date: null, week: null, weekday: null, sport: 'bike', name: 'Ride', steps: '- 1h 65%', minutes: null, effort: null, notes: null, ...patch })
const answer = (patch: Partial<PlanImportOutput>) => ({ ok: true, value: { planName: null, raceName: null, raceDate: null, startDate: null, items: [], skipped: [], ...patch } })
const textDoc = (text: string, fileName = 'plan.md'): ExtractedDocument => ({ fileName, kind: 'text', text })
const item = (patch: Partial<ImportItem>): ImportItem => ({ where: 'Week 1', sport: 'bike', name: 'Ride', steps: '- 1h 65%', ...patch })
const ctx = { ftpW: 250, thresholds: {}, now: dateKeyToMs('2026-11-16') }

describe('readWithAi', () => {
  it('sends the document to the plan-import purpose and nothing else, and reads the answer', async () => {
    invoke.mockResolvedValue(answer({ planName: 'Base block', raceName: 'Gran fondo', raceDate: '2027-05-02', items: [aiItem({ week: 1, weekday: 1, name: 'Tempo', steps: '- 10m 60%\n- 20m 80%' })] }))
    const { doc, problems } = await readWithAi(textDoc('Week 1\nTue: 20 min tempo'), { now: ctx.now })
    expect(invoke).toHaveBeenCalledTimes(1)
    const [channel, req] = invoke.mock.calls[0]!
    expect(channel).toBe('ai.structured')
    expect(req.purpose).toBe('plan-import')
    expect(req.input).toContain('Today is 2026-11-16.')
    expect(req.input).toContain('<document>\nWeek 1\nTue: 20 min tempo\n</document>')
    expect(req.input.length).toBeLessThan(40_000)
    expect(problems).toEqual([])
    expect(doc).toMatchObject({ name: 'Base block', race: { name: 'Gran fondo', date: '2027-05-02' }, items: [{ week: 1, weekday: 1, name: 'Tempo', where: 'Week 1, Tue' }] })
  })

  it('reads a long document a part at a time, says how far it is, and keeps the parts that worked', async () => {
    const weeks = Array.from({ length: 12 }, (_, w) => `Week ${w + 1}\n${'Tue: sweet spot 3x12 at 90 %. Sat: long ride 3h easy. '.repeat(60)}`)
    const doc = textDoc(['12-week gran fondo plan. Power is % of FTP.', ...weeks].join('\n\n'), 'Long plan.pdf')
    let call = 0
    invoke.mockImplementation(async (_c: string, req: { input: string }) => {
      call++
      if (call === 2) return { ok: false, error: 'Anthropic rate limit reached; try again shortly' }
      if (call === 3) return { ok: true, value: { weeks: 'nonsense' } }
      const week = Number(/<document>[\s\S]*?Week (\d+)/.exec(req.input)![1])
      return answer({ items: [aiItem({ week, weekday: 1, name: `Week ${week} sweet spot`, steps: '- 1h 90%' })] })
    })
    const progress: [number, number][] = []
    const { doc: read, problems } = await readWithAi(doc, { onProgress: (p, n) => progress.push([p, n]) })
    const parts = invoke.mock.calls.length
    expect(parts).toBeGreaterThan(3)
    expect(progress).toEqual(Array.from({ length: parts }, (_, i) => [i + 1, parts]))
    for (const [, req] of invoke.mock.calls) expect(req.input.length).toBeLessThanOrEqual(CHUNK_MAX + 3000)
    // parts after the first carry the start of the document, as context only
    expect(invoke.mock.calls[1]![1].input).toContain('<context>\n12-week gran fondo plan. Power is % of FTP.\n</context>')
    expect(invoke.mock.calls[0]![1].input).not.toContain('<context>')
    expect(problems.map((p) => p.reason)).toEqual(['Anthropic rate limit reached; try again shortly', "The AI's answer didn't make sense, so it was not used."])
    expect(problems[0]!.where).toMatch(/^Part 2 of \d+ \(weeks \d+-\d+\)$/)
    expect(read.items.length).toBe(parts - 2)
  })

  it('throws when nothing could be read, with the reason', async () => {
    invoke.mockResolvedValue({ ok: false, error: 'Anthropic rejected the API key', code: 'auth' })
    await expect(readWithAi(textDoc('Week 1\nride'))).rejects.toThrow(new PlanImportError('Anthropic rejected the API key'))
    invoke.mockRejectedValue(new Error('Invalid request for "ai.structured"'))
    await expect(readWithAi(textDoc('Week 1\nride'))).rejects.toThrow(/Invalid request/)
    invoke.mockResolvedValue(answer({ skipped: [{ text: 'Chapter 1', reason: 'This reads as a book chapter, with no sessions.' }] }))
    await expect(readWithAi(textDoc('Week 1\nride'))).rejects.toThrow('The AI found no sessions in plan.md. This reads as a book chapter, with no sessions.')
  })
})

describe('prepareImport', () => {
  it('checks each session with CrankHog’s importers, and says why the ones it can’t make fail', () => {
    const doc: ImportDoc = {
      items: [
        item({ where: 'Week 1, Tue', week: 1, weekday: 1, name: 'Sweet spot', steps: 'Warmup\n- 10m ramp 50-75%\nMain set 3x\n- 12m 90%\n- 5m 55%\nCooldown\n- 10m 50%' }),
        item({ where: 'Week 1, Wed', week: 1, weekday: 2, name: 'Bad ride', steps: '- 20m 70%\n- 5km 80%' }),
        item({ where: 'Week 1, Thu', week: 1, weekday: 3, name: 'Empty ride', steps: '' }),
        item({ where: 'Week 1, Fri', week: 1, weekday: 4, sport: 'run', name: 'Intervals', steps: 'Main set 4x\n- 4m 4:10/km Pace\n- 2m Z1 HR' }),
        item({ where: 'Week 1, Sat', week: 1, weekday: 5, sport: 'swim', name: 'CSS', steps: '- 400m easy', notes: 'Pool\nwork' }),
        item({ where: 'Week 1, Sun', week: 1, weekday: 6, sport: 'run', name: 'Two targets', steps: '- 30m Z2 HR 5:00/km Pace' }),
        item({ where: 'Week 2, Mon', week: 2, weekday: 0, sport: 'other', name: 'Squash', steps: '', minutes: 60, effort: 'hard' }),
        item({ where: 'Week 2, Tue', week: 2, weekday: 1, sport: 'other', name: 'Nothing', steps: '' }),
      ],
      skipped: [],
    }
    const p = prepareImport(doc, { ...ctx, start: '2027-01-04' })
    expect(p.ready.map((r) => [r.date, r.kind, r.item.name, r.durationS])).toEqual([
      ['2027-01-05', 'bike', 'Sweet spot', 71 * 60],
      ['2027-01-08', 'session', 'Intervals', 24 * 60],
      ['2027-01-09', 'session', 'CSS', 400 * 60],
      ['2027-01-11', 'session', 'Squash', 60 * 60],
    ])
    // the swim's "400m" is minutes, which the session importer warns about
    expect(p.ready[2]!.warnings.join(' ')).toMatch(/^Line 1: "400m" is 400 minutes/)
    expect(p.ready[2]!.workout).toMatchObject({ sport: 'swim', notes: 'Pool work' })
    expect(p.ready[0]!.workout).toMatchObject({ name: 'Sweet spot', source: 'import', id: expect.stringMatching(/^plan-import:/) })
    expect(p.failed).toEqual([
      { where: 'Week 1, Wed', name: 'Bad ride', reason: 'Line 2: Distance steps like "5km" aren\'t supported; use a time such as 5m.' },
      { where: 'Week 1, Thu', name: 'Empty ride', reason: 'No steps. A ride needs its steps, such as "- 1h 65%".' },
      { where: 'Week 1, Sun', name: 'Two targets', reason: expect.stringMatching(/^Line 1: one target per step/) },
      { where: 'Week 2, Tue', name: 'Nothing', reason: expect.stringMatching(/No steps, and no duration or distance/) },
    ])
    expect(p.leftOut).toEqual([])
  })

  it('leaves out what falls on or after race day, and puts sessions with no day last, in the document’s order', () => {
    const doc: ImportDoc = {
      items: [item({ name: 'Any day A' }), item({ date: '2027-04-04', name: 'Race' }), item({ date: '2027-04-03', name: 'Openers' }), item({ date: '2027-04-05', name: 'Recovery spin' }), item({ name: 'Any day B' }), item({ date: '2027-04-01', name: 'Tempo' })],
      skipped: [],
    }
    const p = prepareImport(doc, { ...ctx, start: '2027-01-04', raceDate: '2027-04-04' })
    expect(p.ready.map((r) => r.item.name)).toEqual(['Tempo', 'Openers', 'Any day A', 'Any day B'])
    expect(p.leftOut.map((l) => [l.name, l.reason])).toEqual([
      ['Race', 'On race day: the race is on your calendar.'],
      ['Recovery spin', 'After race day.'],
    ])
  })

  it('dates week-numbered sessions from the start the rider picks', () => {
    const doc: ImportDoc = { items: [item({ week: 3, weekday: 2 })], skipped: [] }
    expect(prepareImport(doc, { ...ctx, start: '2027-01-04' }).ready[0]!.date).toBe('2027-01-20')
    expect(prepareImport(doc, { ...ctx, start: '2027-02-01' }).ready[0]!.date).toBe('2027-02-17')
  })
})

describe('readTemplateDocument', () => {
  it('reads the template’s rows and names the plan after the file', () => {
    const doc: ExtractedDocument = { fileName: 'Spring block.csv', kind: 'csv', text: '', rows: [['week', 'day', 'name', 'steps'], ['1', 'Tue', 'Tempo', '- 1h 75%'], ['x', 'Tue', 'Bad', '- 1h']] }
    const { doc: read, problems } = readTemplateDocument(doc)
    expect(read.name).toBe('Spring block')
    expect(read.items.map((i) => i.name)).toEqual(['Tempo'])
    expect(problems).toEqual([{ where: 'Row 3', reason: 'Bad: the week "x" isn\'t a number from 1 to 104.' }])
  })
})

describe('saveImport', () => {
  const doc: ImportDoc = {
    items: [
      item({ date: '2027-01-05', name: 'Tempo', steps: '- 1h 75%' }),
      item({ date: '2027-01-06', sport: 'run', name: 'Easy run', steps: '- 40m Z2 HR' }),
      item({ date: '2027-01-12', name: 'Tempo', steps: '- 1h 75%' }),
      item({ name: 'Spin', steps: '- 45m 60%' }),
    ],
    skipped: [],
  }

  it('saves a plan on the calendar with its event, workouts filed in it, and each session on its day', async () => {
    const { ready } = prepareImport(doc, { ...ctx, start: '2027-01-04' })
    const plan = await saveImport(ready, { name: 'Imported', start: '2027-01-04', event: { name: 'Gran fondo', date: '2027-05-02', priority: 'A' }, ftpW: 250 })
    expect(plan).toMatchObject({ name: 'Imported', source: 'files', onCalendar: true, anchor: 'race', rideDays: [1, 2] })
    expect(await db().dayMarks.toArray()).toEqual([expect.objectContaining({ id: plan.eventId, kind: 'event', name: 'Gran fondo', date: '2027-05-02', priority: 'A' })])
    // the same session twice is one workout, in the plan twice
    const workouts = await db().workouts.toArray()
    expect(workouts.map((w) => [w.name, w.json.folder, w.json.planId])).toEqual(
      expect.arrayContaining([
        ['Tempo', 'plan', plan.id],
        ['Spin', 'plan', plan.id],
      ]),
    )
    expect(workouts).toHaveLength(2)
    expect((await db().sessionWorkouts.toArray()).map((s) => [s.sport, s.name])).toEqual([['run', 'Easy run']])
    expect(plan.items.map((i) => [i.date, i.sport])).toEqual([
      ['2027-01-05', undefined],
      ['2027-01-06', 'run'],
      ['2027-01-12', undefined],
      [undefined, undefined],
    ])
    const entries = (await db().schedule.toArray()).sort((a, b) => a.date.localeCompare(b.date))
    expect(entries.map((e) => [e.date, e.name])).toEqual([
      ['2027-01-05', 'Tempo'],
      ['2027-01-06', 'Easy run'],
      ['2027-01-12', 'Tempo'],
      // the undated spin counts back from the race: the last ride day before it (Tuesdays and Wednesdays, from the dated ones)
      ['2027-04-28', 'Spin'],
    ])
  })

  const undated: ImportDoc = {
    items: [item({ name: 'Endurance', steps: '- 2h 65%' }), item({ sport: 'run', name: 'Easy run', steps: '- 40m Z2 HR' }), item({ name: 'Openers', steps: '- 30m 60%' })],
    skipped: [],
  }
  const days = async () => (await db().schedule.toArray()).sort((a, b) => a.date.localeCompare(b.date)).map((e) => [e.date, e.name])

  it('counts a plan with a race back from race day, and its sessions follow the race when it moves', async () => {
    const { ready } = prepareImport(undated, { ...ctx, start: '2027-01-04', raceDate: '2027-03-07' })
    const plan = await saveImport(ready, { name: 'Crit block', start: '2027-01-04', event: { name: 'Crit', date: '2027-03-07', priority: 'A' }, ftpW: 250 })
    // the default ride days (Tue, Thu, Sat): the last session is the Saturday before the Sunday race, and the plan starts where that puts the first
    expect(plan).toMatchObject({ anchor: 'race', eventId: expect.any(String), startDate: '2027-03-02' })
    expect(await days()).toEqual([
      ['2027-03-02', 'Endurance'],
      ['2027-03-04', 'Easy run'],
      ['2027-03-06', 'Openers'],
    ])
    await updateMark(plan.eventId!, { date: '2027-03-14' })
    expect((await db().plans.get(plan.id))?.startDate).toBe('2027-03-09')
    expect(await days()).toEqual([
      ['2027-03-09', 'Endurance'],
      ['2027-03-11', 'Easy run'],
      ['2027-03-13', 'Openers'],
    ])
  })

  it('runs a plan with no race on from the start the rider picked', async () => {
    const { ready } = prepareImport(undated, { ...ctx, start: '2027-01-04' })
    const plan = await saveImport(ready, { name: 'Base', start: '2027-01-04', ftpW: 250 })
    expect(plan.anchor).toBeUndefined()
    expect(plan.startDate).toBe('2027-01-04')
    expect(await days()).toEqual([
      ['2027-01-05', 'Endurance'],
      ['2027-01-07', 'Easy run'],
      ['2027-01-09', 'Openers'],
    ])
  })

  it('takes back what it made when the save fails, and never a workout the rider already had', async () => {
    const { ready } = prepareImport(doc, { ...ctx, start: '2027-01-04' })
    const spin = ready.find((r) => r.item.name === 'Spin')
    if (spin?.kind !== 'bike') throw new Error('Spin is a ride')
    const mine = spin.workout
    await saveWorkout({ ...mine, source: 'user' }, 250)
    // a built-in can't be saved as the rider's own: the save fails after the plan and event are made
    const broken = [...ready, { ...ready[0]!, workout: { ...ready[0]!.workout, id: 'builtin:x', source: 'builtin' } } as (typeof ready)[number]]
    await expect(saveImport(broken, { name: 'P', start: '2027-01-04', event: { name: 'Race', date: '2027-05-02', priority: 'A' }, ftpW: 250 })).rejects.toThrow(/read-only/)
    expect([await db().plans.count(), await db().dayMarks.count(), await db().sessionWorkouts.count(), await db().schedule.count()]).toEqual([0, 0, 0, 0])
    expect((await db().workouts.toArray()).map((w) => w.id)).toEqual([mine.id])
  })

  it('refuses to save nothing', async () => {
    await expect(saveImport([], { name: 'P', start: '2027-01-04', ftpW: 250 })).rejects.toThrow('There is nothing to save.')
  })
})
