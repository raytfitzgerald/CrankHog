// Short names for what the coach can point at: a calendar entry, an event or
// day off, a plan. The coach chat's data gives each one a ref, and an action
// names what it changes by that ref. A ref is a hash of the id, so it stays
// the same from one message to the next while the thing it names does.

/** "c" for a calendar entry, "m" for an event or day off, "p" for a plan. */
export type RefKind = 'c' | 'm' | 'p'

/** A short, stable ref for an id: "c4k2q9x". FNV-1a, so the same id always gives the same ref. */
export function refOf(kind: RefKind, id: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 0x01000193)
  return `${kind}${(h >>> 0).toString(36).padStart(7, '0').slice(-7)}`
}

/** The one of `items` whose ref is `ref`, or undefined. */
export function byRef<T extends { id: string }>(kind: RefKind, items: readonly T[], ref: string): T | undefined {
  const want = ref.trim().toLowerCase()
  return items.find((i) => refOf(kind, i.id) === want)
}
