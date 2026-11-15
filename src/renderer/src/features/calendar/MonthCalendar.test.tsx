import 'fake-indexeddb/auto'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RideSummary } from '@core/ride/types'
import { addDays, dateKey } from '@core/workout/schedule'
import { db } from '../../db/db'
import { MonthCalendar } from './MonthCalendar'
import { calendarMonth } from './calendar'
import { hoursMinutes, workoutPreview } from './preview'
import { BUILTINS } from '../../workouts/library'
import { DEFAULT_FTP_W } from '../../db/athlete-repo'

vi.mock('@tanstack/react-router', () => ({ useNavigate: () => async () => undefined }))

const today = dateKey(Date.now())
const dayMs = (key: string, h = 18) => {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number]
  return new Date(y, m - 1, d, h).getTime()
}
const ride = (id: string, key: string, workoutId: string, tss: number): RideSummary =>
  ({ id, name: id, kind: 'workout', simulated: false, startedAt: dayMs(key), endedAt: dayMs(key) + 3_600_000, movingS: 3600, tss, workoutId, mmp: [], laps: [], athlete: { ftpW: 250, weightKg: 75 } }) as unknown as RideSummary

beforeEach(async () => {
  await db().delete()
  await db().open()
})
afterEach(() => cleanup())

/** The element once it exists: waitFor retries only while the callback throws. */
const appears = (selector: string) =>
  waitFor(
    () => {
      const el = document.querySelector<HTMLElement>(selector)
      if (!el) throw new Error(`waiting for ${selector}`)
      return el
    },
    { timeout: 5000 },
  )

/** Days of the current month only, so the test holds on any date. */
const inMonth = (offset: number) => {
  const key = addDays(today, offset)
  return key.slice(0, 7) === today.slice(0, 7) ? key : null
}

describe('MonthCalendar', () => {
  it('highlights today and greys the days before it', async () => {
    render(<MonthCalendar />)
    const cell = await appears(`[data-date="${today}"]`)
    expect(cell.getAttribute('data-today')).toBe('true')
    const yesterday = document.querySelector(`[data-date="${addDays(today, -1)}"]`)
    expect(yesterday?.getAttribute('data-past')).toBe('true')
    expect(document.querySelector(`[data-date="${addDays(today, 1)}"]`)?.getAttribute('data-past')).toBeNull()
  })

  it('turns a done workout green and a missed one red', async () => {
    const past = inMonth(-1) ?? inMonth(1)
    // pick two days this month: one ridden as planned, one missed (needs a day before today)
    const missedDay = inMonth(-2)
    if (!past || !missedDay) return // the 1st or 2nd of a month: nothing earlier to miss
    await db().schedule.bulkPut([
      { id: 'done', date: past, workoutId: 'builtin:sweet-spot-3x12', workout: null, name: 'Sweet spot', source: 'manual', createdAt: 1 },
      { id: 'missed', date: missedDay, workoutId: 'builtin:vo2max-5x4', workout: null, name: 'VO2', source: 'manual', createdAt: 2 },
    ])
    await db().rides.put(ride('r1', past, 'builtin:sweet-spot-3x12', 60))
    render(<MonthCalendar />)
    // the chips' own markers: role queries are slow under a loaded test run
    const doneChip = await appears(`[data-date="${past}"] [data-testid="calendar-ride"]`)
    expect(doneChip.getAttribute('data-done')).toBe('true')
    const missedChip = await appears(`[data-date="${missedDay}"] [data-testid="calendar-planned"]`)
    expect(missedChip.getAttribute('data-status')).toBe('missed')
    expect(missedChip.getAttribute('aria-label')).toBe('VO2, missed')
  })

  it('shows each week’s planned and completed volume beside it', async () => {
    const day = inMonth(1) ?? inMonth(-1)!
    await db().schedule.put({ id: 'p', date: day, workoutId: 'builtin:sweet-spot-3x12', workout: null, name: 'Sweet spot', source: 'manual', createdAt: 1 })
    render(<MonthCalendar />)
    await waitFor(() => expect(screen.getAllByTestId('week-volume').some((w) => /Planned/.test(w.textContent ?? ''))).toBe(true), { timeout: 5000 })
    const week = screen.getAllByTestId('week-volume').find((w) => /Planned/.test(w.textContent ?? ''))!
    // Sweet spot 3×12 is about an hour at the default FTP
    expect(within(week).getByText(/0 done · 1 planned/)).toBeTruthy()
    expect(screen.getByTestId('month-volume').textContent).toMatch(/1 workout(?!s)/)
  })

  it('shows fitness and form at each week’s end, projected after today', async () => {
    // a ride last month, so every week of this one has fitness
    await db().rides.put(ride('old', addDays(today, -35), 'builtin:sweet-spot-3x12', 300))
    render(<MonthCalendar />)
    await waitFor(() => expect(screen.getAllByTestId('week-fitness').length).toBeGreaterThan(0), { timeout: 5000 })
    const weeks = screen.getAllByTestId('week-fitness')
    expect(weeks.at(-1)!.textContent).toMatch(/Fitness \d+.*Form/)
    // a week that ends after today is projected (unless today is the grid's last day)
    const now = new Date()
    const lastWeekEnd = calendarMonth(now.getFullYear(), now.getMonth(), { rides: [] }).weeks.at(-1)!.endKey
    if (lastWeekEnd > today) expect(weeks.at(-1)!.getAttribute('data-projected')).toBe('true')
  })

  it('shows each planned workout’s length, average planned power and shape', async () => {
    const ahead = inMonth(1) ?? inMonth(-1)!
    const missedDay = inMonth(-2)
    const doneDay = inMonth(-1)
    await db().schedule.bulkPut([
      { id: 'p', date: ahead, workoutId: 'builtin:sweet-spot-3x12', workout: null, name: 'Sweet spot', source: 'manual', createdAt: 1 },
      { id: 'ramp', date: ahead, workoutId: 'builtin:ramp-test', workout: null, name: 'Ramp test', source: 'manual', createdAt: 2 },
      ...(missedDay ? [{ id: 'm', date: missedDay, workoutId: 'builtin:sweet-spot-3x12', workout: null, name: 'Missed one', source: 'manual' as const, createdAt: 3 }] : []),
      ...(doneDay ? [{ id: 'd', date: doneDay, workoutId: 'builtin:sweet-spot-3x12', workout: null, name: 'Done one', source: 'manual' as const, createdAt: 4 }] : []),
    ])
    if (doneDay) await db().rides.put(ride('r1', doneDay, 'builtin:sweet-spot-3x12', 60))
    const ss = workoutPreview(BUILTINS.find((w) => w.id === 'builtin:sweet-spot-3x12')!, DEFAULT_FTP_W)
    render(<MonthCalendar />)

    // the card shows first; its numbers and shape follow once the library has loaded
    const card = `[data-date="${ahead}"] [data-testid="calendar-planned"][aria-label^="Sweet spot"]`
    expect((await appears(`${card} [data-testid="calendar-card-stats"]`)).textContent).toBe(`${hoursMinutes(ss.plannedS)}·${ss.avgW} W`)
    await appears(`${card} [data-testid="calendar-card-shape"] svg path`)
    // a ramp test: its usual length, and no average
    expect((await appears(`[data-date="${ahead}"] [data-testid="calendar-planned"][aria-label^="Ramp test"] [data-testid="calendar-card-stats"]`)).textContent).toBe('0:25ramp')

    if (missedDay) {
      const shape = await appears(`[data-date="${missedDay}"] [data-testid="calendar-planned"] [data-testid="calendar-card-shape"]`)
      expect(shape.className).toMatch(/opacity-45/)
    }
    if (doneDay) {
      // done as planned: green, with the planned workout's card
      const done = `[data-date="${doneDay}"] [data-testid="calendar-ride"][data-done]`
      expect((await appears(`${done} [data-testid="calendar-card-stats"]`)).textContent).toContain(`${ss.avgW} W`)
      expect((await appears(`${done} [data-testid="calendar-card-shape"]`)).className).not.toMatch(/opacity-45/)
    }
  })
})
