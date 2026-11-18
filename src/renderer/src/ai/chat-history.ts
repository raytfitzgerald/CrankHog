// The coach chat as stored in Dexie, and how it is kept to a size the IPC
// contract (60 messages) and the providers accept.
import type { AiMessage } from '@core/ai/types'
import type { ChatCard } from './coach-cards'
import type { ChatHandoff } from './handoff'

/** A chat turn as stored. `shared` marks a context handoff, shown as a card rather than the raw prompt. */
export interface ChatMessage extends AiMessage {
  shared?: ChatHandoff
  /** Older chats: what the rider typed, when the stored content also carried the training data. */
  asked?: string
  /** The coach's reply: what it proposed, shown as cards under the text (coach-cards.ts). */
  cards?: ChatCard[]
}

export const MAX_KEPT = 40

/**
 * The chat trimmed to its newest `max` messages, from a rider message on, so
 * rider and coach still alternate. No older message has to stay: the latest
 * one carries the training data.
 */
export function trimChat(messages: readonly ChatMessage[], max = MAX_KEPT): ChatMessage[] {
  if (messages.length <= max) return [...messages]
  let tail = messages.slice(-max)
  while (tail.length > 0 && tail[0]!.role !== 'user') tail = tail.slice(1)
  return tail
}
