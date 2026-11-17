import 'fake-indexeddb/auto'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addDays, dateKey } from '@core/workout/schedule'
import { db } from '../../db/db'
import { addToPlan, createPlan, getPlan, updatePlan } from '../../plan/plans-repo'
import { PlanEditor } from './PlanEditor'

const today = dateKey(Date.now())
const monday = (() => {
  let d = addDays(today, 1)
  while (new Date(`${d}T12:00:00`).getDay() !== 1) d = addDays(d, 1)
  return d
})()
const short = (key: string) => new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(`${key}T00:00:00`))

beforeEach(async () => {
  await db().delete()
  await db().open()
})
afterEach(() => cleanup())

/** Renders the editor for a plan, re-rendering whenever the plan changes in the database. */
async function editor(planId: string) {
  const r = render(<PlanEditor plan={(await getPlan(planId))!} onDeleted={() => undefined} onNotice={vi.fn()} />)
  const refresh = async () => r.rerender(<PlanEditor plan={(await getPlan(planId))!} onDeleted={() => undefined} onNotice={vi.fn()} />)
  return { refresh }
}

describe('PlanEditor', () => {
  it('counts back from race day when the plan is dated by its race, and puts the race on the calendar', async () => {
    const p = await createPlan({ name: 'Race plan', rideDays: [1], startDate: monday })
    await addToPlan(p.id, 'builtin:endurance-60')
    await addToPlan(p.id, 'builtin:sweet-spot-3x12')
    const { refresh } = await editor(p.id)
    await act(async () => fireEvent.click(screen.getByRole('radio', { name: 'Race date' })))
    await refresh()
    // a Monday three weeks on: the Tuesdays before it are 6 and 13 days earlier
    const race = addDays(monday, 21)
    await act(async () => fireEvent.change(screen.getByTestId('plan-race-date'), { target: { value: race } }))
    await waitFor(async () => expect((await getPlan(p.id))?.eventId).toBeDefined())
    await refresh()
    await waitFor(() => expect(screen.getAllByTestId('plan-item-date').map((e) => e.textContent)).toEqual([short(addDays(race, -13)), short(addDays(race, -6))]))
    expect(await getPlan(p.id)).toMatchObject({ anchor: 'race', startDate: addDays(race, -13) })
    expect(await db().dayMarks.toArray()).toEqual([expect.objectContaining({ date: race, kind: 'event', name: 'Race', priority: 'A' })])
  })

  it('shows the day each workout lands on, following the ride days', async () => {
    const p = await createPlan({ name: 'Base 1', rideDays: [1], startDate: monday })
    await addToPlan(p.id, 'builtin:endurance-60')
    await addToPlan(p.id, 'builtin:sweet-spot-3x12')
    const { refresh } = await editor(p.id)
    await waitFor(() => expect(screen.getAllByTestId('plan-item-date').map((e) => e.textContent)).toEqual([short(addDays(monday, 1)), short(addDays(monday, 8))]))
    // add Thursday as a ride day
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Thu' })))
    await refresh()
    await waitFor(() => expect(screen.getAllByTestId('plan-item-date').map((e) => e.textContent)).toEqual([short(addDays(monday, 1)), short(addDays(monday, 3))]))
  })

  it('reorders workouts with the arrows', async () => {
    const p = await createPlan({ name: 'P', rideDays: [1], startDate: monday })
    await addToPlan(p.id, 'builtin:endurance-60')
    await addToPlan(p.id, 'builtin:sweet-spot-3x12')
    const { refresh } = await editor(p.id)
    // the names appear once the library has loaded
    const earlier = await screen.findByLabelText('Move Sweet Spot 3×12 earlier', undefined, { timeout: 4000 })
    await act(async () => fireEvent.click(earlier))
    await waitFor(async () => expect((await getPlan(p.id))!.items.map((i) => i.workoutId)).toEqual(['builtin:sweet-spot-3x12', 'builtin:endurance-60']))
    await refresh()
    expect(screen.getAllByTestId('plan-item')[0]!.textContent).toContain('Sweet Spot 3×12')
  })

  it('imports a dated file onto its day', async () => {
    const p = await createPlan({ name: 'P', rideDays: [1], startDate: monday })
    const { refresh } = await editor(p.id)
    const day = addDays(monday, 4)
    const file = new File(['- 30m 65%'], `${day}_Openers.txt`, { type: 'text/plain' })
    await act(async () => fireEvent.change(screen.getByTestId('plan-import-input'), { target: { files: [file] } }))
    await waitFor(async () => expect((await getPlan(p.id))!.items).toHaveLength(1))
    await refresh()
    await waitFor(() => expect(screen.getByTestId('plan-item-date').textContent).toBe(`${short(day)} (from the file name)`))
    expect(screen.getByTestId('plan-item').textContent).toContain('Openers')
  })

  it('shows workouts moved or removed on the calendar, and puts one back', async () => {
    const p = await createPlan({ name: 'P', rideDays: [1], startDate: monday })
    await addToPlan(p.id, 'builtin:endurance-60')
    await addToPlan(p.id, 'builtin:sweet-spot-3x12')
    const [a, b] = (await getPlan(p.id))!.items
    await updatePlan(p.id, { items: [{ ...a!, movedTo: addDays(monday, 3) }, { ...b!, removed: true }] })
    const { refresh } = await editor(p.id)
    await waitFor(() => expect(screen.getAllByTestId('plan-item-date').map((e) => e.textContent)).toEqual([`${short(addDays(monday, 3))} (moved on the calendar)`, 'Removed from the calendar']))
    const putBack = await screen.findByLabelText('Put Sweet Spot 3×12 back on its day in the plan', undefined, { timeout: 4000 })
    await act(async () => fireEvent.click(putBack))
    await waitFor(async () => expect((await getPlan(p.id))!.items[1]!.removed).toBeUndefined())
    await refresh()
    await waitFor(() => expect(screen.getAllByTestId('plan-item-date')[1]!.textContent).toBe(short(addDays(monday, 8))))
  })

  it('says when there are no ride days to put workouts on', async () => {
    const p = await createPlan({ name: 'P', rideDays: [], startDate: monday })
    await addToPlan(p.id, 'builtin:endurance-60')
    await editor(p.id)
    expect(await screen.findByText(/Pick the days you ride/)).toBeTruthy()
  })
})
