// What Claude changed in CrankHog, newest first, each with how to take it
// back: the undo steps of a set of changes (coach-actions.ts), or what a
// saved plan made (the plan import's). Kept in IndexedDB, so the rider can
// undo from Settings, and Claude with undo_change, after a restart too.
import { createStore, useStore } from 'zustand'
import { db } from '../db/db'
import { undoImport, type ImportMade } from '../plan/doc-import'
import { undoSteps, type UndoStep } from '../ai/coach-actions'

export type ClaudeChange = {
  id: string
  at: number
  /** One line for the list: what Claude did. */
  summary: string
  /** Each change in words. */
  lines: string[]
  undone?: number
} & ({ kind: 'changes'; undo: UndoStep[] } | { kind: 'plan'; made: ImportMade })

const KV_KEY = 'claude.changes'
/** The most kept: older ones drop off the list, and can no longer be undone from it. */
const KEEP = 30

const store = createStore<{ changes: ClaudeChange[] }>(() => ({ changes: [] }))
export const useClaudeChanges = (): ClaudeChange[] => useStore(store, (s) => s.changes)

let loaded: Promise<void> | null = null
/** Reads the list from IndexedDB, once. */
export function loadClaudeChanges(): Promise<void> {
  loaded ??= db()
    .kv.get(KV_KEY)
    .then((row) => store.setState({ changes: Array.isArray(row?.value) ? (row.value as ClaudeChange[]) : [] }))
    .catch(() => undefined)
  return loaded
}

let writes: Promise<unknown> = Promise.resolve()
function save(changes: ClaudeChange[]): Promise<unknown> {
  store.setState({ changes })
  writes = writes.then(() => db().kv.put({ key: KV_KEY, value: changes })).catch(() => undefined)
  return writes
}

const newId = () => `ch${Date.now().toString(36)}${crypto.randomUUID().slice(0, 4)}`

/** A change before it's on the list. */
export type NewClaudeChange = ClaudeChange extends infer C ? (C extends ClaudeChange ? Omit<C, 'id' | 'at'> : never) : never

export async function recordChange(c: NewClaudeChange): Promise<ClaudeChange> {
  await loadClaudeChanges()
  const change = { ...c, id: newId(), at: Date.now() } as ClaudeChange
  await save([change, ...store.getState().changes].slice(0, KEEP))
  return change
}

/** Takes a change back: the one with this id, or the latest not yet undone. */
export async function undoChange(id?: string | null): Promise<ClaudeChange> {
  await loadClaudeChanges()
  const list = store.getState().changes
  const c = id ? list.find((x) => x.id === id.trim()) : list.find((x) => !x.undone)
  if (!c) throw new Error(id ? `There's no change ${id} to undo.` : 'There is nothing to undo.')
  if (c.undone) throw new Error(`"${c.summary}" was undone already.`)
  if (c.kind === 'changes') await undoSteps(c.undo)
  else await undoImport(c.made)
  const done = { ...c, undone: Date.now() }
  await save(store.getState().changes.map((x) => (x.id === c.id ? done : x)))
  return done
}

/** Forgets the list (for tests and "start again"); undoes nothing. */
export async function clearClaudeChanges(): Promise<void> {
  loaded = Promise.resolve()
  await save([])
}
