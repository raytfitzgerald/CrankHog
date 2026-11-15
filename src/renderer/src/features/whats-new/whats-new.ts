// What's new: the short release notes (@core/whats-new), shown once on the
// first launch after an update, and again from Settings → About.
import { createStore } from 'zustand'
import type { WhatsNewEntry } from '@core/whats-new/notes'
import { latestNotes, notesToShow } from '@core/whats-new/pick'
import { db } from '../../db/db'
import { patchSettings, settingsStore } from '../../stores/settings'

export const whatsNewStore = createStore<{ entries: WhatsNewEntry[] }>(() => ({ entries: [] }))

const current = __CRANKHOG_VERSION__

/** On launch, after the settings load: opens the notes for anything new since the rider last looked. */
export async function startWhatsNew(info: { isTest: boolean }): Promise<void> {
  // the E2E runs start clean and would only have a dialog in their way
  if (info.isTest) return
  const { whatsNewSeen: seen, rememberedDevices } = settingsStore.getState()
  if (seen === current) return
  // with nothing seen yet, history tells an update from 0.6.4 or earlier apart from a new install
  const returning = seen === null && (rememberedDevices.length > 0 || (await db().rides.count().catch(() => 0)) > 0)
  const entries = notesToShow({ seen, current, returning })
  if (entries.length > 0) whatsNewStore.setState({ entries })
  else await markSeen()
}

/** Settings → About: this version's notes again. */
export function showWhatsNew(): void {
  const notes = latestNotes(current)
  if (notes) whatsNewStore.setState({ entries: [notes] })
}

export async function closeWhatsNew(): Promise<void> {
  whatsNewStore.setState({ entries: [] })
  await markSeen()
}

async function markSeen(): Promise<void> {
  if (settingsStore.getState().whatsNewSeen !== current) await patchSettings({ whatsNewSeen: current }).catch(() => undefined)
}
