// The real thing, on request only: CrankHog's own session and socket join the
// public OpenBikeNet server for a few seconds as "CrankHog test" on the
// velodrome, while a second connection watches from the stands, then leave.
// It shows up in the server's public stats as app "crankhog", so it never
// runs with the rest of the tests:
//
//   CRANKHOG_LIVE_OBN=1 npx vitest run src/main/group-ride/live.test.ts
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { WebSocket } from 'ws'
import { OBN_APP_ID, OBN_DEFAULT_SERVER } from '@core/openbikenet/protocol'
import { ObnSession } from '@core/openbikenet/session'
import { wsConnect } from './socket'

type Msg = Record<string, unknown>
const TRACK = 'velodrome-250'
const NAME = 'CrankHog test'
const version = (JSON.parse(readFileSync(join(__dirname, '../../../package.json'), 'utf8')) as { version: string }).version

async function until(check: () => boolean, what: string, ms = 15_000) {
  const end = Date.now() + ms
  while (!check()) {
    if (Date.now() > end) throw new Error(`Timed out waiting for ${what}`)
    await new Promise((r) => setTimeout(r, 50))
  }
}

describe.skipIf(!process.env.CRANKHOG_LIVE_OBN)('the public OpenBikeNet server', () => {
  it('welcomes CrankHog, and the stands see its rider join, ride and leave', { timeout: 90_000 }, async () => {
    // the stands: a plain connection that only watches the track
    const stands = new WebSocket(OBN_DEFAULT_SERVER)
    const heard: Msg[] = []
    stands.on('message', (raw) => heard.push(JSON.parse(String(raw)) as Msg))
    await new Promise((resolve, reject) => {
      stands.once('open', resolve)
      stands.once('error', reject)
    })
    stands.send(JSON.stringify({ type: 'hello', app: { id: OBN_APP_ID, version } }))
    stands.send(JSON.stringify({ type: 'subscribe', route: TRACK, room: 'public' }))
    await until(() => heard.some((m) => m.type === 'snapshot'), "the stands' snapshot")

    // the rider: exactly what the Mac app runs in main
    const session = new ObnSession({ connect: wsConnect(`CrankHog/${version}`), app: { id: OBN_APP_ID, version, name: 'CrankHog', url: 'https://crankhog.app' }, now: Date.now })
    session.configure({ enabled: true, server: OBN_DEFAULT_SERVER, name: NAME, sharePower: true, shareHeartRate: false })
    const started = Date.now()
    const ride = () => {
      const s = (Date.now() - started) / 1000
      session.want({ watch: TRACK, rider: { lap: Math.floor((s * 9) / 250), distance: (s * 9) % 250, speed: 9, power: 180, cadence: 88, heartRate: 140 }, simulated: false })
    }
    ride()
    const timer = setInterval(() => {
      ride()
      session.tick()
    }, 100)
    try {
      await until(() => session.state().status === 'connected', 'the welcome')
      const joined = () => heard.find((m) => m.type === 'joined' && (m.rider as Msg).name === NAME)?.rider as Msg | undefined
      await until(() => joined() !== undefined, 'the stands to see the rider join')
      expect(joined()).toMatchObject({ app: OBN_APP_ID, name: NAME, power: 180, cadence: 88 })
      expect(joined()).not.toHaveProperty('heart_rate')
      const id = joined()!.id
      const updates = () => heard.filter((m) => m.type === 'updated').flatMap((m) => m.riders as Msg[]).filter((r) => r.id === id)
      await until(() => updates().length >= 3, 'three position updates')
      expect(Number(updates().at(-1)!.distance)).toBeGreaterThan(0)
      console.info(`[live] connected; ${session.state().riders.length} other rider(s) on ${TRACK}; ${updates().length} updates seen from the stands`)

      // the ride ends: off the track at once
      clearInterval(timer)
      session.want({ watch: TRACK, rider: null, simulated: false })
      await until(() => heard.some((m) => m.type === 'left' && m.id === id), 'the stands to see the rider leave')
      expect(heard.find((m) => m.type === 'left' && m.id === id)).toMatchObject({ reason: 'leave' })
    } finally {
      clearInterval(timer)
      session.dispose()
      stands.close()
    }

    const stats = (await (await fetch(new URL('/v0/stats', OBN_DEFAULT_SERVER.replace('wss:', 'https:')))).json()) as { apps: { id: string; versions: string[] }[] }
    expect(stats.apps.find((a) => a.id === OBN_APP_ID)?.versions).toContain(version)
  })
})
