import 'fake-indexeddb/auto'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TEMPLATE_CSV } from '@core/plan-import/template'
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

  it('imports the plan template without AI: a review first, then the plan on the calendar', async () => {
    const onCreated = vi.fn()
    render(<NewPlanFlow onClose={() => undefined} onCreated={onCreated} />)
    fireEvent.click(screen.getByText('No event'))
    fireEvent.click(screen.getByTestId('new-plan-next'))
    fireEvent.click(screen.getByTestId('new-plan-document'))
    const csv = new File([TEMPLATE_CSV], 'Spring block.csv')
    await act(async () => fireEvent.change(screen.getByTestId('doc-import-file'), { target: { files: [csv] } }))
    await act(async () => fireEvent.click(await screen.findByTestId('doc-import-template')))
    // nothing is sent anywhere, and nothing is saved before the rider says so
    expect(invoke.mock.calls.filter(([c]) => c === 'ai.structured')).toEqual([])
    expect(screen.getAllByTestId('doc-import-ready-item')).toHaveLength(7)
    expect(screen.getByTestId('doc-import-summary').textContent).toBe('7 sessions will be made · 3 rides, 2 runs, 1 swim, 1 other')
    expect(await db().plans.count()).toBe(0)
    expect((screen.getByTestId('doc-import-name') as HTMLInputElement).value).toBe('Spring block')
    await act(async () => fireEvent.click(screen.getByTestId('doc-import-save')))
    await waitFor(() => expect(onCreated).toHaveBeenCalled())
    const [plan] = await db().plans.toArray()
    expect(plan).toMatchObject({ name: 'Spring block', onCalendar: true, source: 'files' })
    expect(plan!.items.map((i) => i.date)).toEqual(['2027-01-04', '2027-01-05', '2027-01-06', '2027-01-07', '2027-01-08', '2027-01-09', '2027-01-10'])
    expect(onCreated).toHaveBeenCalledWith(plan!.id, { tone: 'good', text: 'Spring block: 7 sessions on your calendar.' })
  })

  it('says where the document goes before sending it, then shows what will be made and what failed', async () => {
    const onCreated = vi.fn()
    invoke.mockImplementation(async (channel: string) => {
      if (channel === 'ai.status') return { configured: true, provider: 'anthropic', model: 'claude-opus-5-5', breakerOpen: false }
      if (channel === 'ai.structured') {
        const it = (week: number, weekday: number, sport: string, name: string, steps: string) => ({ date: null, week, weekday, sport, name, steps, minutes: null, effort: null, notes: null })
        return {
          ok: true,
          value: {
            planName: 'Coach plan',
            raceName: 'Gran fondo',
            raceDate: null,
            startDate: null,
            items: [it(1, 1, 'bike', 'Tempo', '- 1h 80%'), it(1, 3, 'run', 'Easy run', '- 40m Z2 HR'), it(2, 1, 'bike', 'Broken', '- 20 minutes hard')],
            skipped: [{ text: 'Optional brick', reason: 'No length given.' }],
          },
        }
      }
      throw new Error(channel)
    })
    render(<NewPlanFlow onClose={() => undefined} onCreated={onCreated} />)
    fireEvent.change(screen.getByTestId('new-plan-event-name'), { target: { value: 'Gran fondo' } })
    fireEvent.change(screen.getByTestId('new-plan-event-date'), { target: { value: addDays(dateKey(Date.now()), 70) } })
    fireEvent.click(screen.getByTestId('new-plan-next'))
    fireEvent.click(screen.getByTestId('new-plan-document'))
    const md = new File(['# Coach plan\n\nWeek 1\n- Tue: 1h tempo\n- Thu: easy run 40 min\n\nWeek 2\n- Tue: 20 minutes hard\n'], 'coach.md')
    await act(async () => fireEvent.change(screen.getByTestId('doc-import-file'), { target: { files: [md] } }))
    expect((await screen.findByTestId('doc-import-notice')).textContent).toContain('Anthropic (claude-opus-5-5)')
    expect(invoke.mock.calls.filter(([c]) => c === 'ai.structured')).toEqual([])
    await act(async () => fireEvent.click(screen.getByTestId('doc-import-ai')))
    await screen.findByTestId('doc-import-review')
    expect(invoke.mock.calls.filter(([c]) => c === 'ai.structured')).toHaveLength(1)
    expect(screen.getAllByTestId('doc-import-ready-item').map((li) => li.textContent)).toEqual([expect.stringContaining('Tempo'), expect.stringContaining('Easy run')])
    expect(screen.getByTestId('doc-import-failed-item').textContent).toContain('Broken')
    expect(screen.getByTestId('doc-import-failed-item').textContent).toContain('Line 1:')
    expect(screen.getByTestId('doc-import-skipped-item').textContent).toContain('Optional brick')
    // the rider named the plan and its event: those win over the document's
    expect((screen.getByTestId('doc-import-name') as HTMLInputElement).value).toBe('Gran fondo plan')
    expect(await db().plans.count()).toBe(0)
    await act(async () => fireEvent.click(screen.getByTestId('doc-import-save')))
    await waitFor(() => expect(onCreated).toHaveBeenCalled())
    const [plan] = await db().plans.toArray()
    expect(plan!.items).toHaveLength(2)
    expect((await db().dayMarks.toArray()).map((m) => [m.name, m.priority])).toEqual([['Gran fondo', 'A']])
    expect(onCreated).toHaveBeenCalledWith(plan!.id, expect.objectContaining({ tone: 'bad', text: expect.stringContaining('1 from the document wasn’t made') }))
  })
})
