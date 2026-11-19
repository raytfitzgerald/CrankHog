// One rider's connection to an OpenBikeNet server (protocol v0, spec/v0.md):
// it connects when something needs it (a shared track being watched, or
// ridden), says hello, subscribes to the track, puts the rider on it, sends
// their position about once a second, keeps the remote riders up to date,
// pings when the line goes quiet, and reconnects with backoff. It closes
// again a little after nothing needs it.
//
// It has no socket and no timers of its own: main gives it a connect
// function and calls tick() a few times a second, so every path here runs in
// tests without a network or a wait.
//
// The server never confirms a join (it doesn't send riders their own rider),
// so "riding" means CrankHog sent the join and nothing has refused it.
import {
  DEFAULT_LIMITS,
  MAX_SPEED_MPS,
  OBN_DEFAULT_SERVER,
  OBN_ROOM,
  cleanRemoteName,
  displayNameProblem,
  encode,
  isLocalServer,
  normalizeServerUrl,
  parseServerMessage,
  type AppMessage,
  type ObnAppInfo,
  type ObnLimits,
  type ObnRiderFields,
  type RemoteRiderMessage,
  type RemoteUpdateMessage,
  type ServerMessage,
} from './protocol'
import { sharedTrack } from './tracks'

export interface ObnSocket {
  send(text: string): void
  close(): void
}

export interface ObnSocketEvents {
  open(): void
  message(text: string): void
  /** After an error too: the connection is gone either way. */
  close(): void
}

export type ObnConnect = (url: string, events: ObnSocketEvents) => ObnSocket

export interface ObnConfig {
  enabled: boolean
  server: string
  /** The name other riders see. */
  name: string
  /** Send power and cadence with the position. */
  sharePower: boolean
  shareHeartRate: boolean
}

/** The rider's state from the ride, in CrankHog's terms. */
export interface ObnRiderInput {
  /** Laps completed since the ride started. */
  lap: number
  /** Position in the current lap, m. */
  distance: number
  /** m/s */
  speed: number
  power: number | null
  cadence: number | null
  heartRate: number | null
}

/** What CrankHog wants right now: a track to see, and maybe the rider on it. */
export interface ObnWish {
  /** OpenBikeNet route ID of the track to watch, or null. */
  watch: string | null
  /** The rider on that track, or null when not riding it. */
  rider: ObnRiderInput | null
  /** A simulated or time-warped ride: it stays off servers other people use. */
  simulated: boolean
}

export type ObnStatus = 'off' | 'idle' | 'connecting' | 'connected' | 'waiting'

/** Why the rider isn't on the track although they're riding it. */
export type ObnHold = 'simulated' | 'name' | 'refused' | null

export interface ObnRemoteRider {
  /** The server's ID for the rider. */
  id: string
  /** The app they ride with, e.g. "openradlr". */
  app: string
  name: string
  /** Laps finished since they joined. */
  lap: number
  /** Position along the track, m. */
  distance: number
  /** m/s */
  speed: number
  power: number | null
  cadence: number | null
  heartRate: number | null
  /** Epoch ms when this state arrived. */
  at: number
}

export interface ObnState {
  status: ObnStatus
  /** The watched track (OpenBikeNet ID). */
  route: string | null
  /** Riders of other connections on the watched track. */
  riders: ObnRemoteRider[]
  /** The rider is on the track. */
  riding: boolean
  hold: ObnHold
  /** What went wrong last, in the rider's words; null while it all works. */
  problem: string | null
  /** Epoch ms of the next attempt while waiting to reconnect. */
  retryAt: number | null
}

export interface ObnSessionDeps {
  connect: ObnConnect
  app: ObnAppInfo
  /** Epoch ms. */
  now: () => number
}

/** The rider's value on our connection. Never shown to anyone (spec 6.3), and never personal. */
const RIDER = 'me'
const JOIN_REF = 'join'
const SUBSCRIBE_REF = 'subscribe'

/** Position updates, ms (spec 6.4: about once a second). */
export const UPDATE_EVERY_MS = 1000
/** Ping after this long without a word from the server (spec 3.5)... */
export const QUIET_PING_MS = 20_000
/** ...and give up on the connection if the ping gets nothing back. */
export const PING_TIMEOUT_MS = 10_000
/** From opening the socket to the server's welcome. */
export const CONNECT_TIMEOUT_MS = 15_000
/** Close this long after nothing needs the connection, so closing a dialog and opening another doesn't reconnect. */
export const IDLE_CLOSE_MS = 15_000
/** A rider the ride hasn't mentioned for this long has stopped riding (the page went away). */
export const RIDER_STALE_MS = 30_000
/** Reconnect delays, s (spec 3.5). */
export const BACKOFF_S = [1, 2, 4, 8, 16, 32, 60] as const
/** A connection that lasts this long resets the backoff. */
export const STABLE_MS = 30_000

interface Conn {
  gen: number
  socket: ObnSocket | null
  url: string
  phase: 'opening' | 'hello' | 'ready'
  startedAt: number
  readyAt: number | null
  lastHeard: number
  pingAt: number | null
  limits: ObnLimits
  subscribed: string | null
  joined: { route: string; name: string; lapOffset: number } | null
  lastUpdateAt: number
  /** Set by a fatal error just before the server closes. */
  closeProblem: string | null
}

const OFF: ObnConfig = { enabled: false, server: OBN_DEFAULT_SERVER, name: '', sharePower: true, shareHeartRate: false }

export class ObnSession {
  private cfg: ObnConfig = OFF
  private wish: ObnWish = { watch: null, rider: null, simulated: false }
  private wishAt = Number.NEGATIVE_INFINITY
  private conn: Conn | null = null
  private gen = 0
  private attempts = 0
  private retryAt: number | null = null
  private idleSince: number | null = null
  private problem: string | null = null
  private refusedJoin = false
  private readonly refusedRoutes = new Set<string>()
  private readonly riders = new Map<string, ObnRemoteRider>()
  private rev = 0

  constructor(private readonly deps: ObnSessionDeps) {}

  /** Bumps whenever the state the rider sees changes. */
  get version(): number {
    return this.rev
  }

  configure(cfg: ObnConfig): void {
    const prev = this.cfg
    this.cfg = { ...cfg }
    if (cfg.enabled !== prev.enabled || normalizeServerUrl(cfg.server) !== normalizeServerUrl(prev.server)) {
      // a different server (or none): start over there
      this.shut()
      this.attempts = 0
      this.retryAt = null
      this.problem = null
      this.refusedRoutes.clear()
      this.refusedJoin = false
    }
    if (cfg.name !== prev.name) this.refusedJoin = false
    this.changed()
    this.tick()
  }

  want(wish: ObnWish): void {
    if (wish.watch !== this.wish.watch) this.refusedJoin = false
    const before = this.holdNow()
    this.wish = { watch: wish.watch, rider: wish.rider && { ...wish.rider }, simulated: wish.simulated }
    if (wish.rider) this.wishAt = this.deps.now()
    if (this.holdNow() !== before) this.changed()
    this.tick()
  }

  /** Call a few times a second. */
  tick(): void {
    const now = this.deps.now()
    const url = normalizeServerUrl(this.cfg.server)
    if (!this.cfg.enabled || !url) {
      if (this.conn) this.shut()
      return
    }
    if (!this.needed(now)) {
      this.idleSince ??= now
      if (this.conn?.phase === 'ready') this.reconcile(now)
      if (this.conn && now - this.idleSince >= IDLE_CLOSE_MS) {
        this.shut()
        this.attempts = 0
      }
      if (!this.conn && this.retryAt !== null) {
        this.retryAt = null
        this.changed()
      }
      return
    }
    this.idleSince = null
    const c = this.conn
    if (!c) {
      if (this.retryAt === null || now >= this.retryAt) this.open(url, now)
      return
    }
    if (c.phase !== 'ready') {
      if (now - c.startedAt >= CONNECT_TIMEOUT_MS) this.lost(c, now, "The server didn't answer.")
      return
    }
    if (c.readyAt !== null && now - c.readyAt >= STABLE_MS) this.attempts = 0
    if (c.pingAt !== null) {
      if (now - c.pingAt >= PING_TIMEOUT_MS) {
        this.lost(c, now, 'The connection to the server went quiet.')
        return
      }
    } else if (now - c.lastHeard >= QUIET_PING_MS) {
      c.pingAt = now
      this.send(c, { type: 'ping', ref: 'keepalive' })
    }
    this.reconcile(now)
  }

  state(): ObnState {
    const now = this.deps.now()
    const c = this.conn
    const status: ObnStatus = !this.cfg.enabled
      ? 'off'
      : c
        ? c.phase === 'ready'
          ? 'connected'
          : 'connecting'
        : this.retryAt !== null && this.needed(now)
          ? 'waiting'
          : 'idle'
    const urlProblem = this.cfg.enabled && !normalizeServerUrl(this.cfg.server) ? "That server address isn't one CrankHog can use: it needs wss://, or ws:// to this Mac." : null
    return {
      status,
      route: this.wish.watch,
      riders: c?.subscribed !== null && c?.subscribed === this.wish.watch ? [...this.riders.values()].map((r) => ({ ...r })) : [],
      riding: c?.joined !== null && c?.joined !== undefined,
      hold: this.holdNow(),
      problem: urlProblem ?? this.problem,
      retryAt: status === 'waiting' ? this.retryAt : null,
    }
  }

  /** Leaves the track and closes the connection for good. */
  dispose(): void {
    this.cfg = OFF
    this.shut()
  }

  // ---- needs ------------------------------------------------------------------

  private riderActive(now: number): boolean {
    return this.wish.rider !== null && this.wish.watch !== null && now - this.wishAt < RIDER_STALE_MS
  }

  private needed(now: number): boolean {
    return this.wish.watch !== null || this.riderActive(now)
  }

  private holdNow(): ObnHold {
    if (!this.wish.rider) return null
    if (this.wish.simulated && !isLocalServer(this.cfg.server)) return 'simulated'
    if (displayNameProblem(this.cfg.name) !== null) return 'name'
    if (this.refusedJoin) return 'refused'
    return null
  }

  /** The track and name the rider should be on, or null. */
  private joinTarget(now: number): { route: string; name: string } | null {
    const route = this.wish.watch
    if (route === null || !this.riderActive(now) || this.holdNow() !== null || this.refusedRoutes.has(route)) return null
    return { route, name: this.cfg.name.trim() }
  }

  // ---- connection -------------------------------------------------------------

  private open(url: string, now: number): void {
    const gen = ++this.gen
    const c: Conn = {
      gen,
      socket: null,
      url,
      phase: 'opening',
      startedAt: now,
      readyAt: null,
      lastHeard: now,
      pingAt: null,
      limits: DEFAULT_LIMITS,
      subscribed: null,
      joined: null,
      lastUpdateAt: now,
      closeProblem: null,
    }
    this.conn = c
    this.retryAt = null
    this.changed()
    let socket: ObnSocket
    try {
      socket = this.deps.connect(url, {
        open: () => this.onOpen(gen),
        message: (text) => this.onMessage(gen, text),
        close: () => this.onClose(gen),
      })
    } catch {
      if (this.conn === c) this.lost(c, now, "Couldn't reach the server.")
      return
    }
    if (this.conn === c) c.socket = socket
    else socket.close()
  }

  private current(gen: number): Conn | null {
    return this.conn !== null && this.conn.gen === gen ? this.conn : null
  }

  private onOpen(gen: number): void {
    const c = this.current(gen)
    if (!c || c.phase !== 'opening') return
    c.phase = 'hello'
    c.lastHeard = this.deps.now()
    this.send(c, { type: 'hello', app: this.deps.app })
  }

  private onClose(gen: number): void {
    const c = this.current(gen)
    if (!c) return
    this.lost(c, this.deps.now(), c.closeProblem ?? (c.phase === 'ready' ? 'Lost the connection to the server.' : "Couldn't reach the server."))
  }

  /** The connection failed: drop it and try again after the next backoff step. */
  private lost(c: Conn, now: number, problem: string): void {
    if (this.conn !== c) return
    this.conn = null
    c.socket?.close()
    this.riders.clear()
    const delayS = BACKOFF_S[Math.min(this.attempts, BACKOFF_S.length - 1)]!
    this.attempts += 1
    this.retryAt = now + delayS * 1000
    this.problem = problem
    this.changed()
  }

  /** Closes on purpose (idle, switched off, another server): leaves first, no retry. */
  private shut(): void {
    const c = this.conn
    if (!c) return
    if (c.phase === 'ready' && c.joined) this.send(c, { type: 'leave', rider: RIDER })
    this.conn = null
    c.socket?.close()
    this.riders.clear()
    this.retryAt = null
    this.changed()
  }

  private send(c: Conn, msg: AppMessage): void {
    try {
      c.socket?.send(encode(msg))
    } catch {
      // a socket that can't send is about to report its close
    }
  }

  // ---- keeping the server in step ------------------------------------------------

  private reconcile(now: number): void {
    const c = this.conn
    if (!c || c.phase !== 'ready') return
    const watch = this.needed(now) && this.wish.watch !== null && !this.refusedRoutes.has(this.wish.watch) ? this.wish.watch : null
    if (c.subscribed !== watch) {
      if (c.subscribed !== null) this.send(c, { type: 'unsubscribe', route: c.subscribed, room: OBN_ROOM })
      c.subscribed = null
      this.riders.clear()
      if (watch !== null) {
        this.send(c, { type: 'subscribe', route: watch, room: OBN_ROOM, ref: `${SUBSCRIBE_REF}:${watch}` })
        c.subscribed = watch
      }
      this.changed()
    }

    const target = this.joinTarget(now)
    if (c.joined && (!target || c.joined.route !== target.route || c.joined.name !== target.name)) {
      this.send(c, { type: 'leave', rider: RIDER })
      c.joined = null
      this.changed()
    }
    const rider = this.wish.rider
    if (!c.joined && target && rider) {
      const lapOffset = Math.max(0, Math.floor(rider.lap))
      c.joined = { ...target, lapOffset }
      this.send(c, { type: 'join', rider: RIDER, route: target.route, room: OBN_ROOM, name: target.name, ref: JOIN_REF, ...this.fields(rider, target.route, lapOffset) })
      c.lastUpdateAt = now
      this.changed()
      return
    }
    const every = Math.max(UPDATE_EVERY_MS, 1000 / c.limits.max_update_hz)
    if (c.joined && rider && now - c.lastUpdateAt >= every) {
      c.lastUpdateAt = now
      this.send(c, { type: 'update', riders: [{ rider: RIDER, ...this.fields(rider, c.joined.route, c.joined.lapOffset) }] })
    }
  }

  /** The rider's state in protocol units and ranges, with only what they share. */
  private fields(r: ObnRiderInput, route: string, lapOffset: number): ObnRiderFields {
    const lengthM = sharedTrack(route)?.lengthM ?? Number.POSITIVE_INFINITY
    const out: ObnRiderFields = {
      lap: Math.max(0, Math.floor(finite(r.lap) - lapOffset)),
      // 0 <= distance < length (spec 6.4)
      distance: Math.min(Math.max(0, Math.round(finite(r.distance) * 100) / 100), lengthM - 0.01),
      speed: Math.min(MAX_SPEED_MPS, Math.max(0, Math.round(finite(r.speed) * 100) / 100)),
    }
    if (this.cfg.sharePower) {
      const power = whole(r.power, 3000)
      const cadence = whole(r.cadence, 250)
      if (power !== null) out.power = power
      if (cadence !== null) out.cadence = cadence
    }
    if (this.cfg.shareHeartRate) {
      // a reading outside the spec's range is a strap glitch: left out, not clamped
      const hr = r.heartRate !== null && Number.isFinite(r.heartRate) ? Math.round(r.heartRate) : null
      if (hr !== null && hr >= 20 && hr <= 250) out.heart_rate = hr
    }
    return out
  }

  // ---- what the server says ------------------------------------------------------

  private onMessage(gen: number, text: string): void {
    const c = this.current(gen)
    if (!c) return
    const now = this.deps.now()
    c.lastHeard = now
    c.pingAt = null
    const m = parseServerMessage(text)
    if (!m) return
    switch (m.type) {
      case 'welcome':
        if (c.phase !== 'hello') return
        c.phase = 'ready'
        c.readyAt = now
        c.limits = m.limits
        this.problem = null
        this.changed()
        this.reconcile(now)
        return
      case 'error':
        this.onError(c, m)
        return
      case 'pong':
        return
      default:
        this.onRiders(c, m, now)
    }
  }

  private onRiders(c: Conn, m: Exclude<ServerMessage, { type: 'welcome' | 'error' | 'pong' }>, now: number): void {
    if (m.route !== c.subscribed || m.room !== OBN_ROOM) return
    switch (m.type) {
      case 'snapshot':
        this.riders.clear()
        for (const r of m.riders) this.riders.set(r.id, remote(r, now))
        break
      case 'joined':
        this.riders.set(m.rider.id, remote(m.rider, now))
        break
      case 'updated':
        for (const u of m.riders) {
          const r = this.riders.get(u.id)
          if (r) this.riders.set(u.id, moved(r, u, now))
        }
        break
      case 'left':
        this.riders.delete(m.id)
        break
    }
    this.changed()
  }

  private onError(c: Conn, m: Extract<ServerMessage, { type: 'error' }>): void {
    const fromJoin = m.ref === JOIN_REF
    switch (m.code) {
      case 'unknown_route': {
        const route = m.ref?.startsWith(`${SUBSCRIBE_REF}:`) ? m.ref.slice(SUBSCRIBE_REF.length + 1) : fromJoin ? c.joined?.route : null
        if (route) {
          this.refusedRoutes.add(route)
          if (c.subscribed === route) {
            c.subscribed = null
            this.riders.clear()
          }
          if (c.joined?.route === route) c.joined = null
        }
        this.problem = "This server doesn't have that track."
        break
      }
      case 'unknown_rider':
        // the server let the rider go (a timeout): the next tick joins again
        c.joined = null
        break
      case 'invalid_value':
      case 'limit_exceeded':
        if (fromJoin) {
          c.joined = null
          this.refusedJoin = true
          this.problem = m.code === 'limit_exceeded' ? 'The server is full right now.' : `The server didn't take your rider${m.message ? ` (${m.message})` : ''}.`
        }
        break
      default:
        break
    }
    if (m.fatal) c.closeProblem = FATAL[m.code] ?? `The server closed the connection${m.message ? ` (${m.message})` : ''}.`
    this.changed()
  }

  private changed(): void {
    this.rev += 1
  }
}

const FATAL: Record<string, string> = {
  too_many_errors: 'The server closed the connection after too many errors.',
  message_too_large: 'The server closed the connection: a message was too large.',
  hello_required: "The server closed the connection: CrankHog didn't say hello in time.",
}

function remote(r: RemoteRiderMessage, at: number): ObnRemoteRider {
  return {
    id: r.id,
    app: r.app.slice(0, 32),
    name: cleanRemoteName(r.name),
    lap: r.lap,
    distance: r.distance,
    speed: r.speed,
    power: r.power ?? null,
    cadence: r.cadence ?? null,
    heartRate: r.heart_rate ?? null,
    at,
  }
}

/** Optional fields appear only when that rider's app sends them, so a missing one is no longer shared. */
function moved(r: ObnRemoteRider, u: RemoteUpdateMessage, at: number): ObnRemoteRider {
  return { ...r, lap: u.lap, distance: u.distance, speed: u.speed, power: u.power ?? null, cadence: u.cadence ?? null, heartRate: u.heart_rate ?? null, at }
}

const finite = (v: number) => (Number.isFinite(v) ? v : 0)

/** A whole number in 0..max, or null when there's no reading. */
function whole(v: number | null, max: number): number | null {
  if (v === null || !Number.isFinite(v)) return null
  return Math.min(max, Math.max(0, Math.round(v)))
}
