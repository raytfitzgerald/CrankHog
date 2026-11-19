import { beforeEach, describe, expect, it } from 'vitest'
import { OBN_DEFAULT_SERVER } from './protocol'
import {
  CONNECT_TIMEOUT_MS,
  IDLE_CLOSE_MS,
  ObnSession,
  PING_TIMEOUT_MS,
  QUIET_PING_MS,
  RIDER_STALE_MS,
  STABLE_MS,
  type ObnConfig,
  type ObnRiderInput,
  type ObnSocketEvents,
} from './session'

// A pretend network: each connect() makes a socket the test plays the server for.
class FakeSocket {
  sent: Record<string, unknown>[] = []
  closed = false
  constructor(
    readonly url: string,
    private readonly events: ObnSocketEvents,
  ) {}
  send(text: string) {
    if (this.closed) throw new Error('send on a closed socket')
    this.sent.push(JSON.parse(text) as Record<string, unknown>)
  }
  close() {
    this.closed = true
  }
  // ---- the server's side
  open() {
    this.events.open()
  }
  reply(msg: object) {
    this.events.message(JSON.stringify(msg))
  }
  welcome(limits: object = { max_update_hz: 4, rider_timeout_s: 10, max_riders: 200, max_subscriptions: 16, max_message_bytes: 65536 }) {
    this.reply({ type: 'welcome', protocol: '0.2', connection: 'c1', limits })
  }
  drop() {
    this.closed = true
    this.events.close()
  }
  types() {
    return this.sent.map((m) => m.type)
  }
  take() {
    const out = this.sent
    this.sent = []
    return out
  }
}

let t = 0
let sockets: FakeSocket[] = []
const last = () => sockets[sockets.length - 1]!
const APP = { id: 'crankhog', version: '1.4.0', name: 'CrankHog', url: 'https://crankhog.app' }
const CFG: ObnConfig = { enabled: true, server: OBN_DEFAULT_SERVER, name: 'Ray', sharePower: true, shareHeartRate: false }
const TRACK = 'velodrome-250'
const ride = (o: Partial<ObnRiderInput> = {}): ObnRiderInput => ({ lap: 0, distance: 10, speed: 9.5, power: 210, cadence: 88, heartRate: 140, ...o })

function session(cfg: Partial<ObnConfig> = {}) {
  const s = new ObnSession({
    app: APP,
    now: () => t,
    connect: (url, events) => {
      const sock = new FakeSocket(url, events)
      sockets.push(sock)
      return sock
    },
  })
  s.configure({ ...CFG, ...cfg })
  return s
}

/** Advance the clock in 250 ms ticks, as main does. */
function run(s: ObnSession, ms: number) {
  const end = t + ms
  while (t < end) {
    t = Math.min(end, t + 250)
    s.tick()
  }
}

/** Connected and subscribed to the track, with the opening messages taken. */
function connected(cfg: Partial<ObnConfig> = {}) {
  const s = session(cfg)
  s.want({ watch: TRACK, rider: null, simulated: false })
  last().open()
  last().welcome()
  last().take()
  return s
}

beforeEach(() => {
  t = 1_000_000
  sockets = []
})

describe('ObnSession: connecting', () => {
  it('stays off while the beta is switched off', () => {
    const s = session({ enabled: false })
    s.want({ watch: TRACK, rider: ride(), simulated: false })
    run(s, 5000)
    expect(sockets).toHaveLength(0)
    expect(s.state()).toMatchObject({ status: 'off', riders: [], riding: false })
  })

  it('connects only when a track is wanted, says hello, then subscribes', () => {
    const s = session()
    run(s, 2000)
    expect(sockets).toHaveLength(0)
    expect(s.state().status).toBe('idle')

    s.want({ watch: TRACK, rider: null, simulated: false })
    expect(sockets).toHaveLength(1)
    expect(last().url).toBe('wss://openbikenet.cloud/v0')
    expect(s.state().status).toBe('connecting')

    last().open()
    expect(last().take()).toEqual([{ type: 'hello', app: APP }])
    last().welcome()
    expect(s.state()).toMatchObject({ status: 'connected', route: TRACK, problem: null })
    expect(last().take()).toEqual([{ type: 'subscribe', route: TRACK, room: 'public', ref: `subscribe:${TRACK}` }])
  })

  it('keeps the riders of the watched track up to date', () => {
    const s = connected()
    const sock = last()
    sock.reply({
      type: 'snapshot',
      route: TRACK,
      room: 'public',
      riders: [
        { id: 'a', app: 'openradlr', name: 'Anna', lap: 2, distance: 100, speed: 10, power: 230 },
        { id: 'b', app: 'incyclist', name: 'Ben', lap: 0, distance: 5, speed: 8 },
      ],
    })
    expect(s.state().riders.map((r) => [r.name, r.distance, r.power])).toEqual([
      ['Anna', 100, 230],
      ['Ben', 5, null],
    ])
    t += 500
    sock.reply({ type: 'updated', route: TRACK, room: 'public', riders: [{ id: 'a', lap: 2, distance: 110, speed: 10 }, { id: 'ghost', lap: 0, distance: 1, speed: 1 }] })
    const anna = s.state().riders.find((r) => r.id === 'a')!
    expect(anna).toMatchObject({ distance: 110, power: null, at: t })
    expect(s.state().riders).toHaveLength(2)
    sock.reply({ type: 'joined', route: TRACK, room: 'public', rider: { id: 'c', app: 'crankhog', name: 'Cy', lap: 0, distance: 0, speed: 0 } })
    sock.reply({ type: 'left', route: TRACK, room: 'public', id: 'b', reason: 'timeout' })
    expect(s.state().riders.map((r) => r.name)).toEqual(['Anna', 'Cy'])
    // another track's or room's riders are not ours
    sock.reply({ type: 'joined', route: 'herne-hill-450', room: 'public', rider: { id: 'd', app: 'x', name: 'Di', lap: 0, distance: 0, speed: 0 } })
    sock.reply({ type: 'joined', route: TRACK, room: 'club', rider: { id: 'e', app: 'x', name: 'Ed', lap: 0, distance: 0, speed: 0 } })
    expect(s.state().riders.map((r) => r.name)).toEqual(['Anna', 'Cy'])
  })

  it('moves to another track when the watched one changes', () => {
    const s = connected()
    last().reply({ type: 'snapshot', route: TRACK, room: 'public', riders: [{ id: 'a', app: 'x', name: 'Anna', lap: 0, distance: 1, speed: 1 }] })
    s.want({ watch: 'herne-hill-450', rider: null, simulated: false })
    expect(last().take()).toEqual([
      { type: 'unsubscribe', route: TRACK, room: 'public' },
      { type: 'subscribe', route: 'herne-hill-450', room: 'public', ref: 'subscribe:herne-hill-450' },
    ])
    expect(s.state().riders).toEqual([])
  })

  it('closes a while after nothing needs it, and not before', () => {
    const s = connected()
    s.want({ watch: null, rider: null, simulated: false })
    expect(last().take()).toEqual([{ type: 'unsubscribe', route: TRACK, room: 'public' }])
    run(s, IDLE_CLOSE_MS - 500)
    expect(last().closed).toBe(false)
    s.want({ watch: TRACK, rider: null, simulated: false })
    run(s, IDLE_CLOSE_MS)
    expect(last().closed).toBe(false)
    expect(sockets).toHaveLength(1)
    s.want({ watch: null, rider: null, simulated: false })
    run(s, IDLE_CLOSE_MS + 500)
    expect(last().closed).toBe(true)
    expect(s.state().status).toBe('idle')
  })
})

describe('ObnSession: riding', () => {
  it('joins with the display name and sends the position about once a second', () => {
    const s = connected()
    s.want({ watch: TRACK, rider: ride(), simulated: false })
    expect(last().take()).toEqual([{ type: 'join', rider: 'me', route: TRACK, room: 'public', name: 'Ray', ref: 'join', lap: 0, distance: 10, speed: 9.5, power: 210, cadence: 88 }])
    expect(s.state().riding).toBe(true)

    run(s, 750)
    expect(last().take()).toEqual([])
    s.want({ watch: TRACK, rider: ride({ distance: 20.123, speed: 9.876 }), simulated: false })
    run(s, 250)
    expect(last().take()).toEqual([{ type: 'update', riders: [{ rider: 'me', lap: 0, distance: 20.12, speed: 9.88, power: 210, cadence: 88 }] }])
    run(s, 5000)
    expect(last().types().filter((x) => x === 'update')).toHaveLength(5)
  })

  it('shares heart rate only when asked, and power and cadence only while allowed', () => {
    const s = connected({ sharePower: false, shareHeartRate: true })
    s.want({ watch: TRACK, rider: ride(), simulated: false })
    expect(last().take()[0]).toEqual({ type: 'join', rider: 'me', route: TRACK, room: 'public', name: 'Ray', ref: 'join', lap: 0, distance: 10, speed: 9.5, heart_rate: 140 })
    s.configure({ ...CFG, sharePower: true, shareHeartRate: false })
    run(s, 1000)
    expect(last().take()).toEqual([{ type: 'update', riders: [{ rider: 'me', lap: 0, distance: 10, speed: 9.5, power: 210, cadence: 88 }] }])
  })

  it('keeps every value inside the ranges the server accepts', () => {
    const s = connected({ shareHeartRate: true })
    s.want({ watch: TRACK, rider: ride({ distance: 250, speed: 41, power: 4100, cadence: -3, heartRate: 300 }), simulated: false })
    expect(last().take()[0]).toMatchObject({ distance: 249.99, speed: 30, power: 3000, cadence: 0 })
    s.want({ watch: TRACK, rider: ride({ distance: Number.NaN, speed: -1, power: null, cadence: null, heartRate: 12 }), simulated: false })
    run(s, 1000)
    expect(last().take()).toEqual([{ type: 'update', riders: [{ rider: 'me', lap: 0, distance: 0, speed: 0 }] }])
  })

  it('counts laps from the join, as the spec asks', () => {
    const s = connected()
    s.want({ watch: TRACK, rider: ride({ lap: 7 }), simulated: false })
    expect(last().take()[0]).toMatchObject({ type: 'join', lap: 0 })
    s.want({ watch: TRACK, rider: ride({ lap: 9 }), simulated: false })
    run(s, 1000)
    expect(last().take()[0]).toMatchObject({ type: 'update', riders: [{ lap: 2 }] })
  })

  it('leaves when the ride ends, and when the ride stops talking', () => {
    const s = connected()
    s.want({ watch: TRACK, rider: ride(), simulated: false })
    last().take()
    s.want({ watch: TRACK, rider: null, simulated: false })
    expect(last().take()).toEqual([{ type: 'leave', rider: 'me' }])
    expect(s.state().riding).toBe(false)

    s.want({ watch: TRACK, rider: ride(), simulated: false })
    expect(last().take()[0]).toMatchObject({ type: 'join' })
    for (let k = 0; k <= RIDER_STALE_MS / 1000; k++) {
      run(s, 1000)
      last().reply({ type: 'pong' })
    }
    expect(sockets).toHaveLength(1)
    expect(last().sent.at(-1)).toEqual({ type: 'leave', rider: 'me' })
    expect(s.state().riding).toBe(false)
  })

  it('rejoins under the new name when the rider renames', () => {
    const s = connected()
    s.want({ watch: TRACK, rider: ride(), simulated: false })
    last().take()
    s.configure({ ...CFG, name: 'Hog' })
    expect(last().take().map((m) => [m.type, m.name])).toEqual([
      ['leave', undefined],
      ['join', 'Hog'],
    ])
  })

  it('keeps simulated rides off servers other people use', () => {
    const s = connected()
    s.want({ watch: TRACK, rider: ride(), simulated: true })
    run(s, 3000)
    expect(last().types()).not.toContain('join')
    expect(s.state()).toMatchObject({ hold: 'simulated', riding: false, status: 'connected' })

    const local = connected({ server: 'ws://localhost:8090' })
    expect(last().url).toBe('ws://localhost:8090/v0')
    local.want({ watch: TRACK, rider: ride(), simulated: true })
    expect(last().types()).toContain('join')
    expect(local.state().hold).toBeNull()
  })

  it('holds the rider back until they have a usable name', () => {
    const s = connected({ name: '  ' })
    s.want({ watch: TRACK, rider: ride(), simulated: false })
    expect(last().types()).not.toContain('join')
    expect(s.state().hold).toBe('name')
    s.configure({ ...CFG, name: 'Ray' })
    expect(last().types()).toContain('join')
    expect(s.state().hold).toBeNull()
  })

  it('stops trying when the server refuses the rider, until something changes', () => {
    const s = connected()
    s.want({ watch: TRACK, rider: ride(), simulated: false })
    last().take()
    last().reply({ type: 'error', code: 'invalid_value', message: 'name is not allowed', ref: 'join', rider: 'me', fatal: false })
    expect(s.state()).toMatchObject({ riding: false, hold: 'refused', problem: "The server didn't take your rider (name is not allowed)." })
    run(s, 5000)
    expect(last().types()).not.toContain('join')
    s.configure({ ...CFG, name: 'Ray F' })
    expect(last().types()).toContain('join')
  })

  it('joins again when the server has let the rider go', () => {
    const s = connected()
    s.want({ watch: TRACK, rider: ride(), simulated: false })
    last().take()
    last().reply({ type: 'error', code: 'unknown_rider', message: 'no such rider', rider: 'me', fatal: false })
    run(s, 250)
    expect(last().types()).toEqual(['join'])
  })

  it('leaves a track the server does not have alone', () => {
    const s = connected()
    last().reply({ type: 'error', code: 'unknown_route', message: 'no route', ref: `subscribe:${TRACK}`, fatal: false })
    s.want({ watch: TRACK, rider: ride(), simulated: false })
    run(s, 3000)
    expect(last().types()).toEqual([])
    expect(s.state().problem).toBe("This server doesn't have that track.")
  })

  it('ignores rate limiting and other errors it has no use for', () => {
    const s = connected()
    s.want({ watch: TRACK, rider: ride(), simulated: false })
    last().reply({ type: 'error', code: 'rate_limited', message: 'slow down', rider: 'me', fatal: false })
    last().reply({ type: 'error', code: 'something_new', message: '?', fatal: false })
    expect(s.state()).toMatchObject({ riding: true, problem: null })
  })
})

describe('ObnSession: staying connected', () => {
  it('reconnects with backoff, then says hello, subscribes and joins again', () => {
    const s = connected()
    s.want({ watch: TRACK, rider: ride({ lap: 3 }), simulated: false })
    last().reply({ type: 'snapshot', route: TRACK, room: 'public', riders: [{ id: 'a', app: 'x', name: 'Anna', lap: 0, distance: 1, speed: 1 }] })
    last().drop()
    expect(s.state()).toMatchObject({ status: 'waiting', riders: [], riding: false, problem: 'Lost the connection to the server.', retryAt: t + 1000 })

    run(s, 750)
    expect(sockets).toHaveLength(1)
    run(s, 250)
    expect(sockets).toHaveLength(2)
    last().drop()
    run(s, 1750)
    expect(sockets).toHaveLength(2)
    run(s, 250)
    expect(sockets).toHaveLength(3)
    last().drop()
    run(s, 4000)
    expect(sockets).toHaveLength(4)

    s.want({ watch: TRACK, rider: ride({ lap: 5 }), simulated: false })
    last().open()
    last().welcome()
    expect(last().sent.map((m) => m.type)).toEqual(['hello', 'subscribe', 'join'])
    expect(last().sent[2]).toMatchObject({ lap: 0 })
    expect(s.state()).toMatchObject({ status: 'connected', problem: null, riding: true })
  })

  it('starts the backoff over after a connection that lasted', () => {
    const s = connected()
    s.want({ watch: TRACK, rider: ride(), simulated: false })
    last().drop()
    run(s, 1000)
    last().drop()
    run(s, 2000)
    last().open()
    last().welcome()
    // keep the rider talking while the connection proves itself
    for (let k = 0; k < STABLE_MS / 1000 + 1; k++) {
      s.want({ watch: TRACK, rider: ride(), simulated: false })
      run(s, 1000)
      last().reply({ type: 'pong' })
    }
    last().drop()
    expect(s.state().retryAt).toBe(t + 1000)
  })

  it('pings a quiet server and gives up when the ping goes unanswered', () => {
    const s = connected()
    run(s, QUIET_PING_MS - 250)
    expect(last().types()).toEqual([])
    run(s, 250)
    expect(last().take()).toEqual([{ type: 'ping', ref: 'keepalive' }])
    last().reply({ type: 'pong', ref: 'keepalive' })
    run(s, QUIET_PING_MS)
    expect(last().take()).toEqual([{ type: 'ping', ref: 'keepalive' }])
    run(s, PING_TIMEOUT_MS)
    expect(last().closed).toBe(true)
    expect(s.state()).toMatchObject({ status: 'waiting', problem: 'The connection to the server went quiet.' })
  })

  it('gives up on a server that never says welcome', () => {
    const s = session()
    s.want({ watch: TRACK, rider: null, simulated: false })
    last().open()
    run(s, CONNECT_TIMEOUT_MS)
    expect(last().closed).toBe(true)
    expect(s.state()).toMatchObject({ status: 'waiting', problem: "The server didn't answer." })
  })

  it('says why a server closed the connection on a fatal error', () => {
    const s = connected()
    last().reply({ type: 'error', code: 'too_many_errors', message: 'bye', fatal: true })
    last().drop()
    expect(s.state().problem).toBe('The server closed the connection after too many errors.')
  })

  it("reports a server it couldn't reach", () => {
    const s = new ObnSession({
      app: APP,
      now: () => t,
      connect: () => {
        throw new Error('ENOTFOUND')
      },
    })
    s.configure(CFG)
    s.want({ watch: TRACK, rider: null, simulated: false })
    expect(s.state()).toMatchObject({ status: 'waiting', problem: "Couldn't reach the server." })
  })

  it('ignores a socket it has already let go of', () => {
    const s = connected()
    const old = last()
    old.drop()
    run(s, 1000)
    old.reply({ type: 'joined', route: TRACK, room: 'public', rider: { id: 'z', app: 'x', name: 'Zed', lap: 0, distance: 0, speed: 0 } })
    expect(s.state().riders).toEqual([])
  })
})

describe('ObnSession: settings', () => {
  it('leaves and closes at once when the beta is switched off', () => {
    const s = connected()
    s.want({ watch: TRACK, rider: ride(), simulated: false })
    last().take()
    s.configure({ ...CFG, enabled: false })
    expect(last().take()).toEqual([{ type: 'leave', rider: 'me' }])
    expect(last().closed).toBe(true)
    expect(s.state().status).toBe('off')
  })

  it('moves to another server when the address changes', () => {
    const s = connected()
    s.configure({ ...CFG, server: 'wss://net.example.org' })
    expect(sockets[0]!.closed).toBe(true)
    expect(last().url).toBe('wss://net.example.org/v0')
  })

  it("won't connect to an address it can't use", () => {
    const s = session({ server: 'ws://openbikenet.cloud/v0' })
    s.want({ watch: TRACK, rider: null, simulated: false })
    run(s, 2000)
    expect(sockets).toHaveLength(0)
    expect(s.state().problem).toMatch(/wss:\/\//)
  })

  it('leaves and closes for good on dispose', () => {
    const s = connected()
    s.want({ watch: TRACK, rider: ride(), simulated: false })
    last().take()
    s.dispose()
    expect(last().take()).toEqual([{ type: 'leave', rider: 'me' }])
    expect(last().closed).toBe(true)
    run(s, 5000)
    expect(sockets).toHaveLength(1)
  })

  it('bumps its version when what the rider sees changes', () => {
    const s = connected()
    const v = s.version
    last().reply({ type: 'joined', route: TRACK, room: 'public', rider: { id: 'a', app: 'x', name: 'Anna', lap: 0, distance: 0, speed: 0 } })
    expect(s.version).toBeGreaterThan(v)
  })
})
