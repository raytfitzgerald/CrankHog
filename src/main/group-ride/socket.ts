// The WebSocket under Ride with others: one client connection to an
// OpenBikeNet server, wrapped in the small interface core's ObnSession
// drives (src/core/openbikenet/session.ts).
import { WebSocket, type RawData } from 'ws'
import type { ObnConnect } from '@core/openbikenet/session'

/** Server messages are small; anything near this is not a v0 server. */
const MAX_PAYLOAD_BYTES = 1 << 20
const HANDSHAKE_TIMEOUT_MS = 10_000

function text(data: RawData): string {
  if (Array.isArray(data)) return Buffer.concat(data).toString('utf8')
  return Buffer.isBuffer(data) ? data.toString('utf8') : Buffer.from(data).toString('utf8')
}

export function wsConnect(userAgent: string): ObnConnect {
  return (url, events) => {
    const ws = new WebSocket(url, { handshakeTimeout: HANDSHAKE_TIMEOUT_MS, maxPayload: MAX_PAYLOAD_BYTES, headers: { 'user-agent': userAgent } })
    ws.on('open', () => events.open())
    ws.on('message', (data: RawData, isBinary: boolean) => {
      // v0 uses text frames only (spec 3.2)
      if (!isBinary) events.message(text(data))
    })
    // 'close' always follows an error
    ws.on('error', () => undefined)
    ws.on('close', () => events.close())
    return {
      send: (msg) => {
        if (ws.readyState === WebSocket.OPEN) ws.send(msg)
      },
      close: () => {
        if (ws.readyState === WebSocket.CONNECTING) ws.terminate()
        else ws.close()
      },
    }
  }
}
