// The cards the coach's tool calls become in the chat, and what became of
// each: proposed changes (pending, applied, dismissed, undone), a plan draft
// (its state is in coach-plan.ts), or a call CrankHog couldn't use. A card's
// state is kept apart from the chat's messages, in IndexedDB, so Apply and
// Undo can change it while a reply is streaming, and Undo still works after
// a restart. The coach hears what became of its last cards in the rider's
// next message, as [App] lines.
import { createStore, useStore } from 'zustand'
import { DRAFT_PLAN, PROPOSE_CHANGES, REVISE_PLAN } from '@core/ai/coach-tools'
import type { AiToolCall } from '@core/ai/types'
import { readProposal, type Proposal } from '@core/coach-actions/actions'
import { db } from '../db/db'
import type { Applied, CardItem } from './coach-actions'
import { draftNote, startDraft, startRevision } from './coach-plan'

export type ChatCard =
  | { kind: 'changes'; id: string; proposal: Proposal }
  | { kind: 'plan'; id: string }
  /** A call that couldn't be used, and why. */
  | { kind: 'problem'; text: string }

/** A card's state. Once decided, it keeps what it showed, since the calendar that was read from has changed. */
export type ChangeState =
  | { state: 'pending' }
  | ({ state: 'applied'; items: CardItem[] } & Applied)
  | { state: 'dismissed'; items: CardItem[] }
  | { state: 'undone'; items: CardItem[] }

const KV_KEY = 'coach.cards'
const store = createStore<{ cards: Record<string, ChangeState>; loaded: boolean }>(() => ({ cards: {}, loaded: false }))

export const useChangeState = (id: string): ChangeState => useStore(store, (s) => s.cards[id] ?? PENDING)
const PENDING: ChangeState = { state: 'pending' }

export function changeState(id: string): ChangeState {
  return store.getState().cards[id] ?? PENDING
}

let writes: Promise<unknown> = Promise.resolve()
export function setChangeState(id: string, state: ChangeState): Promise<unknown> {
  store.setState((s) => ({ cards: { ...s.cards, [id]: state } }))
  writes = writes.then(() => db().kv.put({ key: KV_KEY, value: store.getState().cards })).catch(() => undefined)
  return writes
}

export async function loadCards(): Promise<void> {
  if (store.getState().loaded) return
  const row = await db().kv.get(KV_KEY)
  const kept = row?.value && typeof row.value === 'object' ? (row.value as Record<string, ChangeState>) : {}
  store.setState((s) => ({ cards: { ...kept, ...s.cards }, loaded: true }))
}

export async function clearCards(): Promise<void> {
  store.setState({ cards: {} })
  await db().kv.delete(KV_KEY)
}

const newId = () => `k${Date.now().toString(36)}${crypto.randomUUID().slice(0, 6)}`

/**
 * The cards for a reply's tool calls: proposed changes checked against the
 * schema (several proposals in one reply are one card), a plan draft or
 * revision started. Anything that can't be used is a problem card that says
 * why.
 */
export function cardsFor(calls: readonly AiToolCall[], now = Date.now()): ChatCard[] {
  const cards: ChatCard[] = []
  let changes: Extract<ChatCard, { kind: 'changes' }> | undefined
  for (const call of calls) {
    if (call.name === PROPOSE_CHANGES) {
      const r = readProposal(call.input)
      if (!r.ok) cards.push({ kind: 'problem', text: r.error })
      else if (changes) changes.proposal = { summary: [changes.proposal.summary, r.proposal.summary].filter(Boolean).join(' '), actions: [...changes.proposal.actions, ...r.proposal.actions] }
      else cards.push((changes = { kind: 'changes', id: newId(), proposal: r.proposal }))
    } else if (call.name === DRAFT_PLAN || call.name === REVISE_PLAN) {
      const r = call.name === DRAFT_PLAN ? startDraft(call.input, now) : startRevision(call.input, now)
      cards.push('error' in r ? { kind: 'problem', text: r.error } : { kind: 'plan', id: r.id })
    }
  }
  return cards
}

/** What became of a card, for the coach, in a line. */
export function cardNote(card: ChatCard): string | null {
  if (card.kind === 'problem') return `CrankHog couldn't use your last tool call: ${card.text}`
  if (card.kind === 'plan') return draftNote(card.id)
  const what = card.proposal.summary ? `your proposed changes ("${card.proposal.summary}")` : 'your proposed changes'
  const s = changeState(card.id)
  switch (s.state) {
    case 'pending':
      return `The rider hasn't applied ${what} yet: nothing has changed.`
    case 'applied':
      return `The rider applied ${what}.`
    case 'dismissed':
      return `The rider dismissed ${what}: nothing changed.`
    case 'undone':
      return `The rider applied, then undid, ${what}: nothing changed.`
  }
}

/** A reply that was only a tool call, in words, so the history never holds an empty message. */
export function cardsInWords(cards: readonly ChatCard[]): string {
  if (cards.some((c) => c.kind === 'plan')) return "I've started on the draft plan."
  if (cards.some((c) => c.kind === 'changes')) return "Here's what I'd change."
  return '…'
}
