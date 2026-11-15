import 'fake-indexeddb/auto'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addDays, dateKey } from '@core/workout/schedule'
import type { CrankHogBridge } from '@shared/ipc/contract'
import { db } from '../../db/db'
import { NewPlanFlow } from './NewPlanFlow'

const invoke = vi.fn()
beforeEach(async () => {
  await db().delete()
  await db().open()
  invoke.mockReset()
  invoke.mockImplementation(async (channel: string) => {
    if (channel === 'ai.status') return { configured: true, provider: 'anthropic', breakerOpen: false }
    if (channel === 'ai.structured') return { ok: true, value: { weeks: 'nonsense' } }
    throw new Error(channel)
  })
  window.crankhog = { invoke, on: () => () => undefined, send: () => undefined } as unknown as CrankHogBridge
})
afterEach(() => cleanup())

async function toSurvey() {
  fireEvent.change(screen.getByTestId('new-plan-event-name'), { target: { value: 'Gran fondo' } })
  fireEvent.change(screen.getByTestId('new-plan-event-date'), { target: { value: addDays(dateKey(Date.now()), 70) } })
  fireEvent.click(screen.getByTestId('new-plan-next'))
  expect(screen.getByTestId('new-plan-name')).toHaveProperty('value', 'Gran fondo plan')
  fireEvent.click(screen.getByTestId('new-plan-build'))
  fireEvent.click(screen.getByTestId('new-plan-next'))
}

describe('NewPlanFlow', () => {
  it('asks for the event, then builds a plan from CrankHog workouts and puts it on the calendar', async () => {
    const onCreated = vi.fn()
    render(<NewPlanFlow onClose={() => undefined} onCreated={onCreated} />)
    await toSurvey()
    await act(async () => fireEvent.click(screen.getByTestId('new-plan-builtin')))
    await waitFor(() => expect(screen.getAllByTestId('new-plan-week').length).toBeGreaterThan(8), { timeout: 8000 })
    expect(screen.getAllByTestId('new-plan-week').at(-1)!.textContent).toContain('Taper')
    await act(async () => fireEvent.click(screen.getByTestId('new-plan-save')))
    await waitFor(() => expect(onCreated).toHaveBeenCalled(), { timeout: 8000 })
    const [plan] = await db().plans.toArray()
    expect(plan).toMatchObject({ name: 'Gran fondo plan', onCalendar: true, source: 'builtin' })
    expect((await db().dayMarks.toArray()).map((m) => m.name)).toEqual(['Gran fondo'])
    expect(await db().schedule.count()).toBeGreaterThan(20)
  })

  it('says when the AI’s plan is unusable, and offers CrankHog workouts instead', async () => {
    render(<NewPlanFlow onClose={() => undefined} onCreated={() => undefined} />)
    await toSurvey()
    await waitFor(() => expect((screen.getByTestId('new-plan-ai') as HTMLButtonElement).disabled).toBe(false))
    await act(async () => fireEvent.click(screen.getByTestId('new-plan-ai')))
    expect(await screen.findByText(/didn't make sense/)).toBeTruthy()
    await act(async () => fireEvent.click(screen.getByTestId('new-plan-fallback')))
    await waitFor(() => expect(screen.getAllByTestId('new-plan-week').length).toBeGreaterThan(8), { timeout: 8000 })
  })

  it('makes one plan from files even when some fail, and none when all of them do', async () => {
    const onCreated = vi.fn()
    render(<NewPlanFlow onClose={() => undefined} onCreated={onCreated} />)
    fireEvent.change(screen.getByTestId('new-plan-event-name'), { target: { value: 'Gran fondo' } })
    fireEvent.change(screen.getByTestId('new-plan-event-date'), { target: { value: addDays(dateKey(Date.now()), 70) } })
    fireEvent.click(screen.getByTestId('new-plan-next'))
    const bad = new File(['not xml'], 'bad.zwo')
    const good = new File(['- 30m 65%'], 'Openers.txt')
    // nothing readable: no plan and no event, and the dialog says why
    await act(async () => fireEvent.change(screen.getByTestId('new-plan-files'), { target: { files: [bad] } }))
    expect(await screen.findByText(/Couldn't import bad.zwo/)).toBeTruthy()
    expect([await db().plans.count(), await db().dayMarks.count()]).toEqual([0, 0])
    // one of two: the plan is made, the dialog is done with, and the failure is passed on
    await act(async () => fireEvent.change(screen.getByTestId('new-plan-files'), { target: { files: [good, bad] } }))
    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1))
    const [plan] = await db().plans.toArray()
    expect(onCreated).toHaveBeenCalledWith(plan!.id, expect.objectContaining({ tone: 'bad', text: expect.stringContaining('bad.zwo') }))
    expect([await db().plans.count(), await db().dayMarks.count(), plan!.items.length]).toEqual([1, 1, 1])
  })

  it('wants a name and a future date for the event', () => {
    render(<NewPlanFlow onClose={() => undefined} onCreated={() => undefined} />)
    fireEvent.click(screen.getByTestId('new-plan-next'))
    expect(screen.getByText('Name the event, or choose No event.')).toBeTruthy()
  })
})
