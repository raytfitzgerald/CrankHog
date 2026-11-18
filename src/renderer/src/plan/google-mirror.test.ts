import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MIRROR_FOOTER, plainDuration } from '@core/calendar-mirror/event-text'
import { sessionFromFile } from '@core/multisport/build'
import { SESSION_EXAMPLES } from '@core/multisport/examples'
import { readProposal } from '@core/coach-actions/actions'
import { refOf } from '@core/coach-actions/refs'
import { toIntervalsText } from '@core/workout/io/intervals-text'
import { addDays, dateKey } from '@core/workout/schedule'
import type { CrankHogBridge } from '@shared/ipc/contract'
import { DEFAULT_SETTINGS } from '@shared/settings'
import { recordFtp } from '../db/athlete-repo'
import { db } from '../db/db'
import { settingsStore } from '../stores/settings'
import { BUILTINS, describeWorkout, plannedStatsOf } from '../workouts/library'
import { planSessionWorkout, saveSessionWorkout } from '../workouts/sessions-repo'
import { applyProposal, undoSteps } from '../ai/coach-actions'
import { CALENDARS_KV, MIRROR_DEBOUNCE_MS, mirrorSnapshot, startGoogleMirror } from './google-mirror'
import { moveScheduled, removeScheduled, scheduleSession, scheduleWorkout } from './schedule-repo'

const NOW = new Date(2026, 10, 16, 12).getTime()
const TODAY = dateKey(NOW)
const workout = BUILTINS.find((w) => !w.ftpTest)!

beforeEach(async () => {
  await db().delete()
  await db().open()
})

describe('the snapshot sent to Google', () => {
  it('holds every planned entry from 30 days back, bike workouts with their length, TSS and steps', async () => {
    await recordFtp({ date: 0, ftpW: 250, source: 'manual' })
    await scheduleWorkout(addDays(TODAY, -31), { id: workout.id, name: 'Too old' })
    const bike = await scheduleWorkout(addDays(TODAY, -2), { id: workout.id, name: workout.name })
    const run = await scheduleSession(addDays(TODAY, 3), 'run', 'Long run', { durationS: 5400, distanceM: 15_000, effort: 'easy', notes: 'Flat route.' })
    const snap = await mirrorSnapshot(NOW, 'metric')

    expect(snap.windowStart).toBe(addDays(TODAY, -30))
    expect(snap.events.map((e) => [e.key, e.date, e.title])).toEqual([
      [bike.id, addDays(TODAY, -2), workout.name],
      [run.id, addDays(TODAY, 3), 'Long run'],
    ])
    const planned = plannedStatsOf(workout, describeWorkout(workout, 250).stats)
    expect(snap.events[0]!.description.split('\n\n')[0]).toBe(`Ride · ${plainDuration(planned.durationS)} · TSS ${Math.round(planned.tss!)}`)
    expect(snap.events[0]!.description).toContain(toIntervalsText(workout).trim())
    expect(snap.events[1]!.description).toBe(`Run · 1 h 30 min · 15 km · Easy\n\nFlat route.\n\n${MIRROR_FOOTER}`)
  })

  it('gives a session from a .txt file the whole file, header lines and steps', async () => {
    const example = SESSION_EXAMPLES.find((x) => x.fileName.includes('Threshold 4x8'))!
    const { workout: w } = sessionFromFile(example.fileName, example.text, {}, NOW)
    await saveSessionWorkout(w!)
    const planned = await planSessionWorkout(addDays(TODAY, 1), w!)
    const description = (await mirrorSnapshot(NOW, 'metric')).events[0]!.description
    expect(description.split('\n\n').slice(1, -1).join('\n\n')).toBe(example.text.trim())
    expect(description).toMatch(/^sport: run$/m)

    // with its library copy gone, the steps planned with it are what's left
    await db().sessionWorkouts.delete(w!.id)
    const left = (await mirrorSnapshot(NOW, 'metric')).events[0]!.description
    expect(left).toContain('Main set 4x\n- 8m 4:10-4:20/km Pace')
    expect(left).not.toMatch(/^sport:/m)
    expect(planned.session?.text).toBeTruthy()
  })
})

describe('startGoogleMirror', () => {
  const invoke = vi.fn()
  let statusListener: ((s: { connected: boolean }) => void) | null = null
  let stop: () => void = () => undefined
  const syncs = () => invoke.mock.calls.filter(([c]) => c === 'google.calendar.sync').map(([, req]) => req as { events: { key: string; date: string; title: string; description: string }[]; calendarHint?: string })
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

  beforeEach(() => {
    invoke.mockReset()
    invoke.mockImplementation(async (channel: string) => {
      if (channel === 'google.status') return { configured: true, builtInApp: true, connected: true, syncing: false, email: 'rider@example.com', calendarId: 'cal1@group.calendar.google.com' }
      if (channel === 'google.calendar.sync') return { ok: true }
      throw new Error(`unexpected ${channel}`)
    })
    window.crankhog = {
      invoke,
      on: (_e: string, l: (s: { connected: boolean }) => void) => {
        statusListener = l
        return () => (statusListener = null)
      },
      send: () => undefined,
    } as unknown as CrankHogBridge
    settingsStore.setState({ ...DEFAULT_SETTINGS, googleCalendar: { enabled: true } })
  })
  afterEach(() => {
    stop()
    settingsStore.setState(DEFAULT_SETTINGS)
  })

  it('sends the calendar once changes settle, follows a move and a removal, and skips unchanged snapshots', async () => {
    const e = await scheduleWorkout(addDays(dateKey(Date.now()), 2), { id: workout.id, name: workout.name })
    stop = startGoogleMirror()
    await wait(MIRROR_DEBOUNCE_MS + 300)
    expect(syncs().at(-1)!.events.map((x) => x.key)).toEqual([e.id])
    // the account's calendar goes in the backed-up kv table, and back to main as the hint
    expect((await db().kv.get(CALENDARS_KV))?.value).toEqual({ 'rider@example.com': 'cal1@group.calendar.google.com' })
    expect(syncs().at(-1)!.calendarHint).toBe('cal1@group.calendar.google.com')

    const before = syncs().length
    await moveScheduled(e.id, addDays(dateKey(Date.now()), 4))
    await wait(MIRROR_DEBOUNCE_MS + 300)
    expect(syncs()).toHaveLength(before + 1)
    expect(syncs().at(-1)!.events[0]!.date).toBe(addDays(dateKey(Date.now()), 4))

    await removeScheduled(e.id)
    await wait(MIRROR_DEBOUNCE_MS + 300)
    expect(syncs().at(-1)!.events).toEqual([])
    expect(statusListener).not.toBeNull()
  }, 15_000)

  it('sends a change the coach made, new steps in the description, and the old ones again after Undo', async () => {
    const e = await scheduleSession(addDays(dateKey(Date.now()), 2), 'run', 'Run-walk 40', { durationS: 2400, text: '8x\n- 4m Z2 HR\n- 1m Z1 HR walk' })
    stop = startGoogleMirror()
    await wait(MIRROR_DEBOUNCE_MS + 300)
    expect(syncs().at(-1)!.events[0]!.description).toContain('1m Z1 HR walk')

    const p = readProposal({ summary: 'Run it all', actions: [{ type: 'replace', ref: refOf('c', e.id), sport: 'run', name: 'Easy run 40', steps: '- 40m Z2 HR' }] })
    if (!p.ok) throw new Error(p.error)
    const applied = await applyProposal(p.proposal)
    await wait(MIRROR_DEBOUNCE_MS + 300)
    const sent = syncs().at(-1)!.events[0]!
    expect(sent.title).toContain('Easy run 40')
    expect(sent.description).toContain('- 40m Z2 HR')
    expect(sent.description).not.toContain('walk')

    await undoSteps(applied.undo)
    await wait(MIRROR_DEBOUNCE_MS + 300)
    expect(syncs().at(-1)!.events[0]!.description).toContain('1m Z1 HR walk')
  }, 15_000)

  it('sends nothing while the sync is off, and everything when it is switched on', async () => {
    settingsStore.setState({ ...DEFAULT_SETTINGS, googleCalendar: { enabled: false } })
    await scheduleSession(addDays(dateKey(Date.now()), 1), 'swim', 'Swim', {})
    stop = startGoogleMirror()
    await wait(MIRROR_DEBOUNCE_MS + 300)
    expect(syncs()).toHaveLength(0)
    settingsStore.setState({ ...DEFAULT_SETTINGS, googleCalendar: { enabled: true } })
    await wait(50)
    expect(syncs()).toHaveLength(1)
  }, 10_000)
})
