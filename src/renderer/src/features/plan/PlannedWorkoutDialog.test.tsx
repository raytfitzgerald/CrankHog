import 'fake-indexeddb/auto'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../db/db'
import { listScheduled, scheduleWorkout } from '../../plan/schedule-repo'
import { PlannedWorkoutDialog } from './PlannedWorkoutDialog'

vi.mock('@tanstack/react-router', () => ({ useNavigate: () => async () => undefined }))

beforeEach(async () => {
  await db().delete()
  await db().open()
})
afterEach(() => cleanup())

describe('PlannedWorkoutDialog', () => {
  it('moves a planned workout to the day picked', async () => {
    const e = await scheduleWorkout('2026-11-18', { id: 'builtin:sweet-spot-3x12', name: 'Sweet spot 3×12' })
    const onClose = vi.fn()
    render(<PlannedWorkoutDialog entry={e} status="planned" onClose={onClose} />)
    fireEvent.change(screen.getByTestId('planned-date'), { target: { value: '2026-11-21' } })
    await act(async () => fireEvent.click(screen.getByTestId('planned-move')))
    expect((await listScheduled('2026-11-01', '2026-11-30')).map((x) => x.date)).toEqual(['2026-11-21'])
    expect(onClose).toHaveBeenCalled()
  })

  it('takes a planned workout off the calendar', async () => {
    const e = await scheduleWorkout('2026-11-18', { id: 'w', name: 'Planned' })
    render(<PlannedWorkoutDialog entry={e} status="missed" onClose={() => undefined} />)
    expect(screen.getByText(/^Missed:/)).toBeTruthy()
    await act(async () => fireEvent.click(screen.getByTestId('planned-remove')))
    expect(await db().schedule.count()).toBe(0)
  })

  it('says why it cannot ride a workout that has left the library', async () => {
    const e = await scheduleWorkout('2026-11-18', { id: 'deleted-one', name: 'Gone' })
    render(<PlannedWorkoutDialog entry={e} status="today" onClose={() => undefined} />)
    await act(async () => fireEvent.click(screen.getByTestId('planned-ride')))
    expect(screen.getByText(/no longer in your library/)).toBeTruthy()
  })
})
