import 'fake-indexeddb/auto'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../db/db'
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
    render(<DayDialog day={sep20()} onClose={onClose} />)
    fireEvent.change(screen.getByTestId('day-mark-name'), { target: { value: 'Gran fondo' } })
    await act(async () => fireEvent.click(screen.getByTestId('day-mark-add')))
    // saved, plans re-laid, then the dialog closes
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(await db().dayMarks.toArray()).toEqual([expect.objectContaining({ date: '2026-09-20', kind: 'event', name: 'Gran fondo', priority: 'A' })])
  })

  it('wants a name for an event', async () => {
    render(<DayDialog day={sep20()} onClose={() => undefined} />)
    await act(async () => fireEvent.click(screen.getByTestId('day-mark-add')))
    expect(screen.getByText('Name the event.')).toBeTruthy()
    expect(await db().dayMarks.count()).toBe(0)
  })

  it('marks a travel day, and lists and removes what the day has', async () => {
    await db().dayMarks.put({ id: 'x', date: '2026-09-20', kind: 'rest' })
    render(<DayDialog day={sep20()} onClose={() => undefined} />)
    expect(screen.getByTestId('day-mark').textContent).toContain('Rest day')
    await act(async () => fireEvent.click(screen.getByLabelText('Remove Rest day')))
    await waitFor(async () => expect(await db().dayMarks.count()).toBe(0))
    await waitFor(() => expect((screen.getByTestId('day-mark-add') as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(screen.getByRole('radio', { name: /Travel/ }))
    await act(async () => fireEvent.click(screen.getByTestId('day-mark-add')))
    await waitFor(async () => expect((await db().dayMarks.toArray()).map((m) => m.kind)).toEqual(['travel']))
  })
})
