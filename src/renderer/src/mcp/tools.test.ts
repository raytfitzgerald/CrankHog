import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { refOf } from '@core/coach-actions/refs'
import { mcpTool, readInput, type McpToolName } from '@core/mcp/tools'
import { addDays, dateKey } from '@core/workout/schedule'
import { db } from '../db/db'
import { addMark } from '../plan/day-marks-repo'
import { scheduleSession } from '../plan/schedule-repo'
import { rideStore } from '../stores/ride'
import { clearClaudeChanges, loadClaudeChanges } from './changes'
import { runTool } from './tools'

const today = dateKey(Date.now())
const later = (days: number) => addDays(today, days)

/** A call as main hands it over: the input read and checked first. */
async function call(name: McpToolName, raw: unknown): Promise<{ text: string; isError: boolean; json: Record<string, unknown> }> {
  const input = readInput(mcpTool(name, true)!, raw)
  if (!input.ok) throw new Error(input.error)
  const r = await runTool(name, input.value)
  let json: Record<string, unknown> = {}
  try {
    json = JSON.parse(r.text) as Record<string, unknown>
  } catch {
    // an error in words
  }
  return { ...r, json }
}

const calendar = async () => (await db().schedule.toArray()).sort((a, b) => a.date.localeCompare(b.date)).map((e) => [e.date, e.name])

beforeEach(async () => {
  await db().delete()
  await db().open()
  await clearClaudeChanges()
  rideStore.setState({ active: false })
})

describe('reading', () => {
  it('reads the calendar for any span, with refs to change things by', async () => {
    const e = await scheduleSession(later(3), 'run', 'Easy run', { durationS: 2400 })
    const m = await addMark({ date: later(10), kind: 'event', name: 'Turkey trot', priority: 'B' })
    const r = await call('get_calendar', { from: today, to: later(30) })
    expect(r.isError).toBe(false)
    expect(r.json.sessions).toEqual([expect.objectContaining({ ref: refOf('c', e.id), sport: 'run', name: 'Easy run', status: 'planned', minutes: 40 })])
    expect(r.json.eventsAndDaysOff).toEqual([expect.objectContaining({ ref: refOf('m', m.id), kind: 'event', name: 'Turkey trot', priority: 'B' })])
    expect((await call('get_calendar', { from: today, to: later(500) })).text).toMatch(/At most 400 days/)
  })

  it("lists the library's workouts, by sport and words", async () => {
    const r = await call('list_workouts', { sport: 'bike', search: 'sweet spot' })
    const found = r.json.workouts as { name: string; sport: string; tags: string[]; from: string }[]
    expect(found.some((w) => /sweet spot/i.test(w.name) && w.from === 'CrankHog')).toBe(true)
    // every word, in the name or the tags
    for (const w of found) expect(`${w.name} ${w.tags.join(' ')}`.toLowerCase()).toMatch(/sweet[\s\S]*spot|spot[\s\S]*sweet/)
    expect(found.every((w) => w.sport === 'bike')).toBe(true)
  })

  it("gives get_training the coach chat's view, without the rider's name", async () => {
    const r = await call('get_training', {})
    expect(r.isError).toBe(false)
    expect(r.text).toMatch(/"today"/)
  })

  it('answers nothing while the rider is riding', async () => {
    rideStore.setState({ active: true })
    expect(await call('get_training', {})).toMatchObject({ isError: true, text: expect.stringMatching(/riding right now/) })
  })
})

describe('changes', () => {
  const squash = (date: string) => ({ summary: 'Squash on Thursday', actions: [{ type: 'add_session', date, sport: 'other', name: 'Squash', minutes: 60, effort: 'hard' }] })

  it('checks without changing, then changes, and undo takes it back', async () => {
    const checked = await call('check_changes', squash(later(2)))
    expect(checked.json).toMatchObject({ canApply: true, changes: [expect.objectContaining({ change: expect.stringMatching(/Squash/) })] })
    expect(await calendar()).toEqual([])

    const made = await call('make_changes', squash(later(2)))
    expect(made.isError).toBe(false)
    expect(made.json.id).toMatch(/^ch/)
    expect(await calendar()).toEqual([[later(2), 'Squash']])
    await loadClaudeChanges()

    const undone = await call('undo_change', {})
    expect(undone.json).toEqual({ undone: made.json.id, summary: 'Squash on Thursday' })
    expect(await calendar()).toEqual([])
    expect(await call('undo_change', {})).toMatchObject({ isError: true, text: 'There is nothing to undo.' })
  })

  it('changes nothing when part of it cannot be done', async () => {
    const r = await call('make_changes', squash(later(-3)))
    expect(r.isError).toBe(true)
    expect(r.text).toMatch(/^Nothing was changed\./)
    expect(await calendar()).toEqual([])
  })
})

describe('plans', () => {
  // a Monday a week or two out, so the plan's days are all ahead
  const monday = (() => {
    let d = later(7)
    while (new Date(`${d}T12:00:00`).getDay() !== 1) d = addDays(d, 1)
    return d
  })()
  const plan = (steps = '- 10m ramp 50-70%\n- 30m 90%\n- 10m ramp 65-45%') => ({
    name: 'Spring 10k',
    race: { name: 'Spring 10k', date: addDays(monday, 13) },
    sessions: [
      { date: addDays(monday, 1), sport: 'bike', name: 'Sweet spot 3x10', steps },
      { date: addDays(monday, 2), sport: 'run', name: 'Easy run', steps: '- 40m Z2 HR' },
      { date: addDays(monday, 5), sport: 'run', name: 'Long run', minutes: 75, effort: 'easy' },
      { date: addDays(monday, 8), sport: 'bike', name: 'Endurance', steps: '- 60m 65%' },
    ],
  })

  it('checks a plan, saves it on the calendar with its race, and undo takes it all back', async () => {
    const checked = await call('check_plan', plan())
    expect(checked.json).toMatchObject({ canSave: true, sessions: 4, weeks: 2, bySport: { bike: { sessions: 2 }, run: { sessions: 2 } } })
    expect(await db().plans.count()).toBe(0)

    const saved = await call('save_plan', plan())
    expect(saved.isError).toBe(false)
    expect(await calendar()).toEqual([
      [addDays(monday, 1), 'Sweet spot 3x10'],
      [addDays(monday, 2), 'Easy run'],
      [addDays(monday, 5), 'Long run'],
      [addDays(monday, 8), 'Endurance'],
    ])
    const [p] = await db().plans.toArray()
    expect(p).toMatchObject({ name: 'Spring 10k', anchor: 'race' })
    expect(await db().dayMarks.toArray()).toEqual([expect.objectContaining({ kind: 'event', name: 'Spring 10k', priority: 'A', date: addDays(monday, 13) })])

    await loadClaudeChanges()
    await call('undo_change', { id: saved.json.id })
    expect(await db().plans.count()).toBe(0)
    expect(await calendar()).toEqual([])
    expect(await db().dayMarks.count()).toBe(0)
  })

  it('saves nothing when a session cannot be read, and says which', async () => {
    const r = await call('save_plan', plan('- 10m at a jolly good clip'))
    expect(r.isError).toBe(true)
    expect(r.text).toMatch(/^Nothing was saved: CrankHog couldn't read 1 of the sessions/)
    expect(r.text).toMatch(/Sweet spot 3x10/)
    expect(await db().plans.count()).toBe(0)
  })
})
