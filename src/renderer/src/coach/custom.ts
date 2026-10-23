// The rider's custom coaches. They live in IndexedDB (kv, so backups carry
// them) and are mirrored in a store, so a coach id resolves synchronously
// like a built-in pack: coachPack() is the one lookup for "the coach with
// this id". The AI writes a coach's lines in the background after a save;
// any failure just leaves the coach with its own lines.
import { createStore, useStore } from 'zustand'
import { customCoachLinesFromPack, customCoachLinesPrompt, customCoachMeta, customCoachPack, isCustomCoachId, parseCustomCoaches, type CustomCoach } from '@core/coach'
import { PROFESSIONAL, packById, type PersonaPack, type ProfanitySetting } from '@core/persona'
import { DEFAULT_SETTINGS } from '@shared/settings'
import { db } from '../db/db'
import { bridge } from '../platform/bridge'
import { patchSettings, settingsStore } from '../stores/settings'
import { aiReady } from './quips'

const KEY = 'coach.custom'

/** Per coach: the AI is writing its lines, or the last attempt failed. */
export type LinesStatus = 'writing' | 'failed'

export const customCoachStore = createStore<{ coaches: CustomCoach[]; lines: Record<string, LinesStatus> }>(() => ({ coaches: [], lines: {} }))

const packs = new WeakMap<CustomCoach, PersonaPack>()

/** Reads the stored coaches; a broken row leaves just the built-in ones. */
export async function loadCustomCoaches(): Promise<void> {
  try {
    const row = await db().kv.get(KEY)
    customCoachStore.setState({ coaches: parseCustomCoaches(row?.value) })
  } catch {
    customCoachStore.setState({ coaches: [] })
  }
}

// Writes go one at a time, each built from the list as the last one left it,
// so the AI's lines landing during a save (or a delete) never undo the other.
let writes: Promise<unknown> = Promise.resolve()

function update(change: (coaches: CustomCoach[]) => CustomCoach[]): Promise<void> {
  const run = writes.then(async () => {
    const coaches = change(customCoachStore.getState().coaches)
    await db().kv.put({ key: KEY, value: coaches })
    customCoachStore.setState({ coaches })
  })
  writes = run.catch(() => undefined)
  return run
}

export function saveCustomCoach(coach: CustomCoach): Promise<void> {
  return update((cur) => (cur.some((c) => c.id === coach.id) ? cur.map((c) => (c.id === coach.id ? coach : c)) : [...cur, coach]))
}

/** After a backup is restored: its coaches, plus any made since that it doesn't have. */
export async function mergeCustomCoachesAfterRestore(before: readonly CustomCoach[]): Promise<void> {
  await writes
  const restored = parseCustomCoaches((await db().kv.get(KEY))?.value)
  await update(() => [...restored, ...before.filter((c) => !restored.some((r) => r.id === c.id))])
}

/** Deletes a coach; if it was the rider's coach, the default coach takes over. */
export async function deleteCustomCoach(id: string): Promise<void> {
  await update((cur) => cur.filter((c) => c.id !== id))
  const coach = settingsStore.getState().coach
  if (coach.personaId === id) await patchSettings({ coach: { ...coach, personaId: DEFAULT_SETTINGS.coach.personaId } })
}

export function customCoach(id: string): CustomCoach | undefined {
  return isCustomCoachId(id) ? customCoachStore.getState().coaches.find((c) => c.id === id) : undefined
}

function packOf(c: CustomCoach): PersonaPack {
  let p = packs.get(c)
  if (!p) {
    p = customCoachPack(c)
    packs.set(c, p)
  }
  return p
}

/** The pack for a coach id (built-in or custom), or null for an unknown id. */
export function coachPackOrNull(id: string): PersonaPack | null {
  const builtIn = packById(id)
  if (builtIn) return builtIn
  const c = customCoach(id)
  return c ? packOf(c) : null
}

/** The pack for a coach id; an unknown id (a deleted coach, say) gets Professional. */
export function coachPack(id: string): PersonaPack {
  return coachPackOrNull(id) ?? PROFESSIONAL
}

export function useCustomCoaches(): CustomCoach[] {
  return useStore(customCoachStore, (s) => s.coaches)
}

export function useCustomCoach(id: string): CustomCoach | undefined {
  return useStore(customCoachStore, (s) => (isCustomCoachId(id) ? s.coaches.find((c) => c.id === id) : undefined))
}

/** coachPack, re-rendering when the rider edits that coach. */
export function useCoachPack(id: string): PersonaPack {
  const coach = useCustomCoach(id)
  return coach ? packOf(coach) : coachPack(id)
}

export function useLinesStatus(id: string): LinesStatus | null {
  return useStore(customCoachStore, (s) => s.lines[id] ?? null)
}

function setStatus(id: string, status: LinesStatus | null): void {
  customCoachStore.setState((s) => {
    const lines = { ...s.lines }
    if (status) lines[id] = status
    else delete lines[id]
    return { lines }
  })
}

/** Coaches whose description changed while the AI was writing for the old one. */
const rewrite = new Set<string>()

/**
 * Asks the AI to write the coach's lines from its description, at the
 * rider's spice and language, and stores them on the coach (replacing the
 * last set). Returns how many were kept; 0 when the AI isn't set up, said
 * no, or the coach went away meanwhile. Asked again while it's writing, it
 * writes once more when that finishes, for the description as it is then.
 */
export async function writeCoachLines(id: string, opts: { spice: number; profanity: ProfanitySetting }): Promise<number> {
  const coach = customCoach(id)
  if (!coach || !coach.persona.trim()) return 0
  if (customCoachStore.getState().lines[id] === 'writing') {
    rewrite.add(id)
    return 0
  }
  setStatus(id, 'writing')
  let kept = 0
  let failed = false
  try {
    if (!(await aiReady())) throw new Error('AI not set up')
    const meta = customCoachMeta(coach)
    const res = await bridge().invoke('ai.structured', { purpose: 'quip-pack', input: customCoachLinesPrompt(meta, opts) })
    if (!res.ok) throw new Error(res.code)
    const aiLines = customCoachLinesFromPack(res.value, { meta, ...opts })
    if (aiLines.length === 0) throw new Error('nothing to keep')
    const now = customCoach(id)
    // a changed description makes these lines someone else's: write again for the new one
    if (now && now.persona !== coach.persona) rewrite.add(id)
    else if (now) {
      await saveCustomCoach({ ...now, aiLines, updatedAt: Date.now() })
      kept = aiLines.length
    }
  } catch {
    failed = true
  }
  setStatus(id, null)
  if (rewrite.delete(id)) return writeCoachLines(id, opts)
  if (failed) setStatus(id, 'failed')
  return kept
}
