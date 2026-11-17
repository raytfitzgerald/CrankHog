import 'fake-indexeddb/auto'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sessionFromFile } from '@core/multisport/build'
import { SESSION_EXAMPLES } from '@core/multisport/examples'
import { db } from '../../db/db'
import { saveSessionWorkout } from '../../workouts/sessions-repo'
import { addToPlan, createPlan } from '../../plan/plans-repo'
import { calendarMonth } from './calendar'
import { DayDialog } from './DayDialog'

beforeEach(async () => {
  await db().delete()
  await db().open()
})
afterEach(() => cleanup())

const sep20 = () => calendarMonth(2026, 8, { rides: [], marks: [{ id: 'x', date: '2026-09-20', kind: 'rest' }] }).weeks.flatMap((w) => w.days).find((d) => d.inMonth && d.day === 20)!

describe('DayDialog', () => {
  it('adds an A event with its name', async () => {
    const onClose = vi.fn()
    render(<DayDialog day={sep20()} mode="mark" onClose={onClose} />)
    fireEvent.change(screen.getByTestId('day-mark-name'), { target: { value: 'Gran fondo' } })
    await act(async () => fireEvent.click(screen.getByTestId('day-mark-add')))
    // saved, plans re-laid, then the dialog closes
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(await db().dayMarks.toArray()).toEqual([expect.objectContaining({ date: '2026-09-20', kind: 'event', name: 'Gran fondo', priority: 'A' })])
  })

  it('wants a name for an event', async () => {
    render(<DayDialog day={sep20()} mode="mark" onClose={() => undefined} />)
    await act(async () => fireEvent.click(screen.getByTestId('day-mark-add')))
    expect(screen.getByText('Name the event.')).toBeTruthy()
    expect(await db().dayMarks.count()).toBe(0)
  })

  it('marks a travel day, and lists and removes what the day has', async () => {
    await db().dayMarks.put({ id: 'x', date: '2026-09-20', kind: 'rest' })
    render(<DayDialog day={sep20()} mode="mark" onClose={() => undefined} />)
    expect(screen.getByTestId('day-mark').textContent).toContain('Rest day')
    await act(async () => fireEvent.click(screen.getByLabelText('Remove Rest day')))
    await waitFor(async () => expect(await db().dayMarks.count()).toBe(0))
    await waitFor(() => expect((screen.getByTestId('day-mark-add') as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(screen.getByRole('radio', { name: /Travel/ }))
    await act(async () => fireEvent.click(screen.getByTestId('day-mark-add')))
    await waitFor(async () => expect((await db().dayMarks.toArray()).map((m) => m.kind)).toEqual(['travel']))
  })

  const today = () => {
    const now = new Date()
    return calendarMonth(now.getFullYear(), now.getMonth(), { rides: [] }).weeks.flatMap((w) => w.days).find((d) => d.isToday)!
  }
  const future = () => calendarMonth(2099, 0, { rides: [] }).weeks.flatMap((w) => w.days).find((d) => d.inMonth && d.day === 15)!

  it('logs a squash game on a day that has been, with its load from how hard it was', async () => {
    const onClose = vi.fn()
    render(<DayDialog day={today()} onClose={onClose} />)
    fireEvent.click(screen.getByRole('radio', { name: 'Log an activity' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Other' }))
    fireEvent.change(screen.getByTestId('log-label'), { target: { value: 'Squash' } })
    fireEvent.change(screen.getByTestId('log-time'), { target: { value: '1:00' } })
    fireEvent.click(screen.getByRole('radio', { name: 'Hard' }))
    await act(async () => fireEvent.click(screen.getByTestId('day-log-add')))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(await db().activities.toArray()).toEqual([expect.objectContaining({ name: 'Squash', group: 'other', source: 'manual', movingS: 3600, manualLoad: 80 })])
  })

  it('wants a time to log an activity', async () => {
    render(<DayDialog day={today()} onClose={() => undefined} />)
    fireEvent.click(screen.getByRole('radio', { name: 'Log an activity' }))
    await act(async () => fireEvent.click(screen.getByTestId('day-log-add')))
    expect(screen.getByText(/Fill in the time/)).toBeTruthy()
    expect(await db().activities.count()).toBe(0)
  })

  it('plans a run on a day ahead, and only lets you log on days that have been', async () => {
    const onClose = vi.fn()
    render(<DayDialog day={future()} onClose={onClose} />)
    expect(screen.queryByRole('radio', { name: 'Log an activity' })).toBeNull()
    fireEvent.click(screen.getByRole('radio', { name: 'Plan a session' }))
    fireEvent.change(screen.getByTestId('plan-distance'), { target: { value: '10 km' } })
    fireEvent.change(screen.getByTestId('plan-time'), { target: { value: '50' } })
    fireEvent.click(screen.getByRole('radio', { name: 'Easy' }))
    await act(async () => fireEvent.click(screen.getByTestId('day-plan-add')))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    const [e] = await db().schedule.toArray()
    expect(e).toMatchObject({ date: '2099-01-15', sport: 'run', name: 'Run', workoutId: null, workout: null, session: { durationS: 3000, distanceM: 10_000, effort: 'easy', load: 33.3 } })
  })

  it('opens on the workouts, and a click on one puts it on the day', async () => {
    const onClose = vi.fn()
    render(<DayDialog day={future()} onClose={onClose} />)
    // no plans yet: CrankHog's own workouts, searched as on the Workouts page
    await waitFor(() => expect(screen.getByTestId('picker-tab-crankhog').getAttribute('aria-selected')).toBe('true'))
    fireEvent.change(screen.getByLabelText('Search workouts'), { target: { value: 'Endurance 60' } })
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /^Endurance 60/ })))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(await db().schedule.toArray()).toEqual([expect.objectContaining({ date: '2099-01-15', workoutId: 'builtin:endurance-60', name: 'Endurance 60', source: 'manual' })])
  })

  it('opens on the training plan when one has workouts, numbered as in the plan', async () => {
    const p = await createPlan({ name: 'Base 1' })
    await addToPlan(p.id, 'builtin:endurance-60')
    await addToPlan(p.id, 'builtin:sweet-spot-3x12')
    // a newer plan with nothing in it yet doesn't hide it
    await createPlan({ name: 'Empty' })
    render(<DayDialog day={future()} onClose={() => undefined} />)
    await waitFor(() => expect(screen.getByTestId('picker-tab-plan').getAttribute('aria-selected')).toBe('true'))
    await waitFor(() => expect(screen.getAllByTestId('workout-card')).toHaveLength(2))
    expect(screen.getByLabelText('Number 2 in your plan')).toBeTruthy()
  })

  it('picks a run from your runs, and plans it on the day', async () => {
    const r = sessionFromFile('Easy.txt', SESSION_EXAMPLES[0]!.text, {}, 0)
    await saveSessionWorkout(r.workout!)
    const onClose = vi.fn()
    render(<DayDialog day={future()} onClose={onClose} />)
    fireEvent.click(screen.getByRole('radio', { name: 'Run' }))
    const card = await screen.findByRole('button', { name: /Threshold 4x8/ })
    await act(async () => fireEvent.click(card))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(await db().schedule.toArray()).toEqual([expect.objectContaining({ date: '2099-01-15', sport: 'run', name: 'Threshold 4x8' })])
  })

  it('says what is wrong with a time it can’t read', async () => {
    render(<DayDialog day={future()} onClose={() => undefined} />)
    fireEvent.click(screen.getByRole('radio', { name: 'Plan a session' }))
    fireEvent.change(screen.getByTestId('plan-time'), { target: { value: 'soon' } })
    await act(async () => fireEvent.click(screen.getByTestId('day-plan-add')))
    expect(screen.getByText(/Time: write minutes/)).toBeTruthy()
  })
})
