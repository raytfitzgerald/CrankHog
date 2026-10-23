import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import type { CustomCoach } from '@core/coach'
import { PROFESSIONAL } from '@core/persona'
import { DEFAULT_SETTINGS } from '@shared/settings'
import { db } from '../db/db'
import { createWebShim } from '../platform/web-shim'
import { settingsStore } from '../stores/settings'
import { coachPack, coachPackOrNull, customCoachStore, deleteCustomCoach, loadCustomCoaches, mergeCustomCoachesAfterRestore, saveCustomCoach, writeCoachLines } from './custom'

const COACH: CustomCoach = {
  id: 'custom-abc123def0',
  name: 'Uncle Rog',
  photo: 'data:image/jpeg;base64,AAAA',
  persona: 'A retired domestique. Dry and blunt.',
  phrases: [{ text: 'Right then. Legs on.', moment: 'start' }],
  aiLines: [],
  createdAt: 1,
  updatedAt: 1,
}

beforeEach(async () => {
  window.crankhog = createWebShim()
  settingsStore.setState(DEFAULT_SETTINGS, true)
  customCoachStore.setState({ coaches: [], lines: {} })
  await db().delete()
  await db().open()
})

describe('custom coaches store', () => {
  it('keeps coaches in IndexedDB and resolves their ids like built-in coaches', async () => {
    await saveCustomCoach(COACH)
    customCoachStore.setState({ coaches: [] })
    await loadCustomCoaches()
    expect(coachPack(COACH.id).meta).toMatchObject({ id: COACH.id, name: 'Uncle Rog', persona: COACH.persona })
    expect(coachPack('drill-sergeant').meta.id).toBe('drill-sergeant')
    expect(coachPackOrNull('custom-gone00')).toBeNull()
    expect(coachPack('custom-gone00')).toBe(PROFESSIONAL)
  })

  it('skips a stored row that does not parse', async () => {
    await db().kv.put({ key: 'coach.custom', value: [COACH, { ...COACH, id: 'nope' }] })
    await loadCustomCoaches()
    expect(customCoachStore.getState().coaches.map((c) => c.id)).toEqual([COACH.id])
  })

  it('hands the rider back to the default coach when theirs is deleted', async () => {
    await saveCustomCoach(COACH)
    settingsStore.setState({ ...DEFAULT_SETTINGS, coach: { ...DEFAULT_SETTINGS.coach, personaId: COACH.id } }, true)
    await deleteCustomCoach(COACH.id)
    expect(customCoachStore.getState().coaches).toEqual([])
    expect(settingsStore.getState().coach.personaId).toBe(DEFAULT_SETTINGS.coach.personaId)
  })

  it('keeps coaches made since a backup when the backup is restored', async () => {
    const older = { ...COACH, id: 'custom-older00000', name: 'From the backup' }
    await saveCustomCoach(COACH)
    const before = customCoachStore.getState().coaches
    await db().kv.put({ key: 'coach.custom', value: [older] }) // what restoreBackup does to the row
    await mergeCustomCoachesAfterRestore(before)
    expect(customCoachStore.getState().coaches.map((c) => c.id)).toEqual([older.id, COACH.id])
    customCoachStore.setState({ coaches: [] })
    await loadCustomCoaches()
    expect(customCoachStore.getState().coaches).toHaveLength(2)
  })

  it('never loses one write to another', async () => {
    const other = { ...COACH, id: 'custom-other00000' }
    await Promise.all([saveCustomCoach(COACH), saveCustomCoach(other), deleteCustomCoach(COACH.id), saveCustomCoach({ ...other, name: 'Renamed' })])
    expect(customCoachStore.getState().coaches).toEqual([{ ...other, name: 'Renamed' }])
  })

  it('marks the lines as failed, not the coach, when no AI is set up', async () => {
    await saveCustomCoach(COACH)
    expect(await writeCoachLines(COACH.id, { spice: 3, profanity: 'clean' })).toBe(0)
    expect(customCoachStore.getState().lines[COACH.id]).toBe('failed')
    expect(customCoachStore.getState().coaches[0]).toEqual(COACH)
  })
})
