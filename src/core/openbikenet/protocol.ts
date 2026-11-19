// OpenBikeNet protocol v0 (shared presence): the messages CrankHog sends and
// the ones it reads back. Spec: https://github.com/OpenBikeNet/protocol
// (spec/v0.md). Every message is one JSON object with a string `type`.
//
// Reading is lenient where the spec asks for it (unknown fields, types,
// error codes and leave reasons are ignored or passed through) and strict
// about values: a rider entry with a bad value is dropped, never shown.
import { z } from 'zod'

/** CrankHog's app ID on the network (spec section 5). */
export const OBN_APP_ID = 'crankhog'
/** The public reference server. Anyone can run their own; the rider can pick another in Settings. */
export const OBN_DEFAULT_SERVER = 'wss://openbikenet.cloud/v0'
/** Riders go in the default room; v0 rooms are open to everyone and give no privacy. */
export const OBN_ROOM = 'public'

/** Route IDs (spec 4.1). */
export const ROUTE_ID = /^[a-z0-9][a-z0-9-]{1,63}$/
/** Longest display name, in Unicode code points (spec 6.3). */
export const NAME_MAX_CHARS = 32
/** Upper end of the speed range the server accepts, m/s (spec 6.4). */
export const MAX_SPEED_MPS = 30

export interface ObnAppInfo {
  id: string
  version: string
  name?: string
  url?: string
}

/** One rider's state, in protocol units (spec 3.3). Optional fields are left out when not shared. */
export interface ObnRiderFields {
  lap: number
  distance: number
  speed: number
  power?: number
  cadence?: number
  heart_rate?: number
}

/** Any app message may carry a `ref`, which an error about it echoes (spec 3.2). */
export type AppMessage =
  | { type: 'hello'; app: ObnAppInfo }
  | { type: 'subscribe'; route: string; room: string; ref?: string }
  | { type: 'unsubscribe'; route: string; room: string }
  | ({ type: 'join'; rider: string; route: string; room: string; name: string; ref?: string } & ObnRiderFields)
  | { type: 'update'; riders: ({ rider: string } & ObnRiderFields)[] }
  | { type: 'leave'; rider: string }
  | { type: 'ping'; ref?: string }

export function encode(msg: AppMessage): string {
  return JSON.stringify(msg)
}

// ---- display names (spec 6.3.1) -------------------------------------------------

/** Control, format, private-use, line and paragraph separators: invisible or direction-changing. */
const FORBIDDEN_CHAR = /[\p{Cc}\p{Cf}\p{Co}\p{Zl}\p{Zp}]/u
const ZERO_WIDTH_JOINER = '‍'
const ONLY_WHITESPACE = /^\p{White_Space}*$/u

/** Why the server would refuse this display name, in the rider's words; null when it's fine. */
export function displayNameProblem(name: string): string | null {
  const chars = [...name]
  if (chars.length === 0 || ONLY_WHITESPACE.test(name)) return 'Choose the name other riders will see.'
  if (chars.length > NAME_MAX_CHARS) return `Keep it to ${NAME_MAX_CHARS} characters.`
  if (chars.some((c) => c !== ZERO_WIDTH_JOINER && FORBIDDEN_CHAR.test(c))) return 'Leave out invisible and control characters.'
  return null
}

/**
 * Another app's rider name as CrankHog shows it. Servers are meant to refuse
 * names with invisible or direction-changing characters, but a server is
 * someone else's code: they're taken out here too, and the name is cut to
 * the spec's length.
 */
export function cleanRemoteName(name: string): string {
  const kept = [...name].filter((c) => c === ZERO_WIDTH_JOINER || !FORBIDDEN_CHAR.test(c))
  const out = kept.slice(0, NAME_MAX_CHARS).join('').trim()
  return out === '' ? 'Rider' : out
}

// ---- server URLs -----------------------------------------------------------------

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])
/** scheme://host[:port][/path], no credentials, query or fragment. (Core has no URL class.) */
const WS_URL = /^(wss?):\/\/(\[[0-9a-f:.]+\]|[a-z0-9.-]+)(:\d{1,5})?(\/[^\s?#]*)?$/i

function splitUrl(input: string): { scheme: string; host: string; port: string; path: string } | null {
  const m = WS_URL.exec(input.trim())
  if (!m) return null
  return { scheme: m[1]!.toLowerCase(), host: m[2]!.toLowerCase(), port: m[3] ?? '', path: m[4] ?? '' }
}

/**
 * The WebSocket URL to connect to, or null when it isn't one CrankHog will
 * use: `wss://` anywhere, plain `ws://` only to this Mac (spec 3.1: public
 * servers use wss). A bare host gets the protocol's `/v0` path.
 */
export function normalizeServerUrl(input: string): string | null {
  const u = splitUrl(input)
  if (!u || u.host.startsWith('.') || u.host.endsWith('.')) return null
  if (u.scheme === 'ws' && !LOCAL_HOSTS.has(u.host)) return null
  const path = u.path === '' || u.path === '/' ? '/v0' : u.path
  return `${u.scheme}://${u.host}${u.port}${path}`
}

/** A server on this Mac: where simulated rides may go, since nobody else sees them there. */
export function isLocalServer(url: string): boolean {
  const u = splitUrl(url)
  return u !== null && LOCAL_HOSTS.has(u.host)
}

// ---- server messages ---------------------------------------------------------------

const count = (max: number) => z.number().int().min(0).max(max)
const optionalInt = (min: number, max: number) => z.number().int().min(min).max(max).optional()

/** A remote rider's state; optional fields appear only when that rider's app shares them (spec 7.4). */
const RemoteStateSchema = z.object({
  lap: count(1_000_000),
  distance: z.number().min(0).max(1_000_000),
  speed: z.number().min(0).max(100),
  power: optionalInt(0, 3000),
  cadence: optionalInt(0, 250),
  heart_rate: optionalInt(20, 250),
})

const RemoteRiderSchema = RemoteStateSchema.extend({
  id: z.string().min(1).max(64),
  app: z.string().min(1).max(64),
  name: z.string().min(1).max(200),
})

const RemoteUpdateSchema = RemoteStateSchema.extend({ id: z.string().min(1).max(64) })

export type RemoteRiderMessage = z.infer<typeof RemoteRiderSchema>
export type RemoteUpdateMessage = z.infer<typeof RemoteUpdateSchema>

export const LimitsSchema = z.object({
  max_update_hz: z.number().positive().max(1000).catch(4),
  rider_timeout_s: z.number().positive().max(3600).catch(10),
  max_riders: z.number().int().positive().catch(200),
  max_subscriptions: z.number().int().positive().catch(16),
  max_message_bytes: z.number().int().positive().catch(65536),
})
export type ObnLimits = z.infer<typeof LimitsSchema>
export const DEFAULT_LIMITS: ObnLimits = { max_update_hz: 4, rider_timeout_s: 10, max_riders: 200, max_subscriptions: 16, max_message_bytes: 65536 }

const Where = { route: z.string().max(64), room: z.string().max(64) }

export type ServerMessage =
  | { type: 'welcome'; protocol: string; connection: string; limits: ObnLimits }
  | { type: 'snapshot'; route: string; room: string; riders: RemoteRiderMessage[] }
  | { type: 'joined'; route: string; room: string; rider: RemoteRiderMessage }
  | { type: 'updated'; route: string; room: string; riders: RemoteUpdateMessage[] }
  | { type: 'left'; route: string; room: string; id: string; reason: string }
  | { type: 'error'; code: string; message: string; ref?: string; rider?: string; fatal: boolean }
  | { type: 'pong'; ref?: string }

const WelcomeSchema = z.object({
  type: z.literal('welcome'),
  protocol: z.string().max(32),
  connection: z.string().max(64),
  limits: LimitsSchema.catch(DEFAULT_LIMITS),
})
const SnapshotSchema = z.object({ type: z.literal('snapshot'), ...Where, riders: z.array(z.unknown()).max(10_000) })
const JoinedSchema = z.object({ type: z.literal('joined'), ...Where, rider: RemoteRiderSchema })
const UpdatedSchema = z.object({ type: z.literal('updated'), ...Where, riders: z.array(z.unknown()).max(10_000) })
const LeftSchema = z.object({ type: z.literal('left'), ...Where, id: z.string().max(64), reason: z.string().max(64) })
const ErrorSchema = z.object({
  type: z.literal('error'),
  code: z.string().max(64),
  message: z.string().max(2000).catch(''),
  ref: z.string().max(64).optional().catch(undefined),
  rider: z.string().max(64).optional().catch(undefined),
  fatal: z.boolean().catch(false),
})
const PongSchema = z.object({ type: z.literal('pong'), ref: z.string().max(64).optional().catch(undefined) })

/** Entries that fail their schema are dropped, so one bad rider never hides the rest. */
function validEntries<T>(schema: z.ZodType<T>, list: readonly unknown[]): T[] {
  const out: T[] = []
  for (const item of list) {
    const r = schema.safeParse(item)
    if (r.success) out.push(r.data)
  }
  return out
}

/**
 * Parses one text frame from the server. Null for anything CrankHog doesn't
 * act on: not JSON, an unknown type (spec 3.2: ignored), or a known type
 * that doesn't hold together.
 */
export function parseServerMessage(text: string): ServerMessage | null {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return null
  }
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null
  switch ((raw as { type?: unknown }).type) {
    case 'welcome':
      return parsed(WelcomeSchema, raw)
    case 'snapshot': {
      const m = parsed(SnapshotSchema, raw)
      return m && { ...m, riders: validEntries(RemoteRiderSchema, m.riders) }
    }
    case 'joined':
      return parsed(JoinedSchema, raw)
    case 'updated': {
      const m = parsed(UpdatedSchema, raw)
      return m && { ...m, riders: validEntries(RemoteUpdateSchema, m.riders) }
    }
    case 'left':
      return parsed(LeftSchema, raw)
    case 'error':
      return parsed(ErrorSchema, raw)
    case 'pong':
      return parsed(PongSchema, raw)
    default:
      return null
  }
}

function parsed<T>(schema: z.ZodType<T>, raw: unknown): T | null {
  const r = schema.safeParse(raw)
  return r.success ? r.data : null
}
