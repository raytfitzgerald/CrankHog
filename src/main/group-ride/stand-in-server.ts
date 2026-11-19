// Test helper, never imported by the app: a small stand-in for an
// OpenBikeNet server, written from the v0 spec (github.com/OpenBikeNet/protocol),
// not from the reference server's code. Used by the socket test and the e2e
// spec to ride against without touching the public server.
import type { AddressInfo } from 'node:net'
import { WebSocketServer, type WebSocket } from 'ws'

export type Msg = Record<string, unknown>

interface Rider {
  id: string
  app: string
  name: string
  route: string
  state: Msg
}

/** Shared presence in ~60 lines: hello, subscribe, join, update, leave, ping. Rooms other than public are ignored. */
export class StandInServer {
  readonly wss: WebSocketServer
  readonly listening: Promise<void>
  private next = 1
  private readonly subs = new Map<WebSocket, Set<string>>()
  private readonly riders = new Map<WebSocket, Map<string, Rider>>()
  readonly hellos: Msg[] = []
  /** Every message from every app, in order, with the app that sent it. */
  readonly log: { app: string; msg: Msg }[] = []

  constructor() {
    this.wss = new WebSocketServer({ host: '127.0.0.1', port: 0, path: '/v0' })
    this.listening = new Promise((resolve) => this.wss.once('listening', resolve))
    this.wss.on('connection', (ws) => {
      let app = ''
      this.subs.set(ws, new Set())
      this.riders.set(ws, new Map())
      ws.on('message', (raw) => {
        const m = JSON.parse(String(raw)) as Msg
        this.log.push({ app, msg: m })
        const send = (o: Msg) => ws.send(JSON.stringify(o))
        switch (m.type) {
          case 'hello':
            app = String((m.app as Msg).id)
            this.hellos.push(m)
            send({ type: 'welcome', protocol: '0.2', connection: `c${this.next++}`, limits: { max_update_hz: 4, rider_timeout_s: 10, max_riders: 200, max_subscriptions: 16, max_message_bytes: 65536 } })
            break
          case 'subscribe': {
            const route = String(m.route)
            this.subs.get(ws)!.add(route)
            const riders = [...this.riders.entries()].filter(([c]) => c !== ws).flatMap(([, rs]) => [...rs.values()].filter((r) => r.route === route).map(view))
            send({ type: 'snapshot', route, room: 'public', riders })
            break
          }
          case 'join': {
            const { type: _t, rider, route, room: _r, name, ref: _ref, ...state } = m
            const r: Rider = { id: `r${this.next++}`, app, name: String(name), route: String(route), state }
            this.riders.get(ws)!.set(String(rider), r)
            this.fanOut(ws, r.route, { type: 'joined', route: r.route, room: 'public', rider: view(r) })
            break
          }
          case 'update':
            for (const e of m.riders as Msg[]) {
              const r = this.riders.get(ws)!.get(String(e.rider))
              if (!r) continue
              const { rider: _rider, ...state } = e
              r.state = state
              this.fanOut(ws, r.route, { type: 'updated', route: r.route, room: 'public', riders: [{ id: r.id, ...state }] })
            }
            break
          case 'leave': {
            const r = this.riders.get(ws)!.get(String(m.rider))
            if (!r) break
            this.riders.get(ws)!.delete(String(m.rider))
            this.fanOut(ws, r.route, { type: 'left', route: r.route, room: 'public', id: r.id, reason: 'leave' })
            break
          }
          case 'ping':
            send({ type: 'pong', ref: m.ref })
            break
        }
      })
      ws.on('close', () => {
        for (const r of this.riders.get(ws)!.values()) this.fanOut(ws, r.route, { type: 'left', route: r.route, room: 'public', id: r.id, reason: 'disconnect' })
        this.riders.delete(ws)
        this.subs.delete(ws)
      })
    })
  }

  get url(): string {
    return `ws://127.0.0.1:${(this.wss.address() as AddressInfo).port}/v0`
  }

  private fanOut(from: WebSocket, route: string, msg: Msg) {
    for (const [c, routes] of this.subs) if (c !== from && routes.has(route)) c.send(JSON.stringify(msg))
  }

  async stop() {
    for (const c of this.wss.clients) c.terminate()
    await new Promise<void>((resolve) => this.wss.close(() => resolve()))
  }
}

const view = (r: Rider) => ({ id: r.id, app: r.app, name: r.name, ...r.state })

