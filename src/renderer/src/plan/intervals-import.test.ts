import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CrankHogBridge } from '@shared/ipc/contract'
import { db } from '../db/db'
import { IMPORT_DAYS_AHEAD, IMPORT_DAYS_BACK, importFromIntervals } from './intervals-import'
import { listScheduled } from './schedule-repo'

const ZWO = '<workout_file><name>x</name><workout><SteadyState Duration="1200" Power="0.88"/></workout></workout_file>'
const invoke = vi.fn()

beforeEach(async () => {
  await db().delete()
  await db().open()
  invoke.mockReset()
  window.crankhog = { invoke, on: () => () => undefined, send: () => undefined } as unknown as CrankHogBridge
})

describe('importFromIntervals', () => {
  it('asks for last week and the next four, and schedules the rides it can play', async () => {
    invoke.mockResolvedValue({
      events: [
        { id: '5', start_date_local: '2026-11-16T00:00:00', name: 'Sweet spot', type: 'Ride', description: null, zwo: ZWO },
        { id: '6', start_date_local: '2026-11-17T00:00:00', name: 'Long run', type: 'Run', description: '- 60m Z2', zwo: null },
        { id: '7', start_date_local: '2026-11-18T00:00:00', name: 'Club ride', type: 'Ride', description: 'Meet at the café', zwo: null },
      ],
    })
    const now = new Date(2026, 10, 14, 9).getTime()
    const r = await importFromIntervals(now)
    expect(invoke).toHaveBeenCalledWith('intervals.planned', { oldest: '2026-11-07', newest: '2026-12-12' })
    expect(IMPORT_DAYS_BACK + IMPORT_DAYS_AHEAD).toBe(35)
    expect(r).toEqual({ added: 1, updated: 0, removed: 0, skipped: 2 })
    const all = await listScheduled('2026-11-01', '2026-12-31')
    expect(all.map((e) => [e.date, e.name, e.source])).toEqual([['2026-11-16', 'Sweet spot', 'intervals']])
    expect(all[0]!.workout?.segments.length).toBe(1)
  })

  it('passes on what went wrong, leaving the schedule as it was', async () => {
    invoke.mockRejectedValue(new Error('intervals.icu returned 401'))
    await expect(importFromIntervals(Date.now())).rejects.toThrow('401')
    expect(await db().schedule.count()).toBe(0)
  })
})
