// Ride with others over a real WebSocket: CrankHog's session against a small
// stand-in for an OpenBikeNet server, with a second app riding next to it.
import { afterEach, describe, expect, it } from 'vitest'
import { WebSocket } from 'ws'
import { ObnSession } from '@core/openbikenet/session'
import { wsConnect } from './socket'
import { StandInServer, type Msg } from './stand-in-server'

/** Another app on the track: a raw client that records what it hears. */
async function otherApp(url: string) {
  const ws = new WebSocket(url)
  const heard: Msg[] = []
  ws.on('message', (raw) => heard.push(JSON.parse(String(raw)) as Msg))
  await new Promise((resolve, reject) => {
    ws.once('open', resolve)
    ws.once('error', reject)
  })
  const send = (m: Msg) => ws.send(JSON.stringify(m))
  send({ type: 'hello', app: { id: 'openradlr', version: '0.2.0' } })
  send({ type: 'subscribe', route: 'velodrome-250', room: 'public' })
  return { ws, heard, send }
}

async function until(check: () => boolean, what: string, ms = 5000) {
  const end = Date.now() + ms
  while (!check()) {
    if (Date.now() > end) throw new Error(`Timed out waiting for ${what}`)
    await new Promise((r) => setTimeout(r, 20))
  }
}

let server: StandInServer | null = null
let stop: (() => void) | null = null
afterEach(async () => {
  stop?.()
  stop = null
  await server?.stop()
  server = null
})

function crankhog(url: string) {
  const s = new ObnSession({ connect: wsConnect('CrankHog/test'), app: { id: 'crankhog', version: '1.4.0', name: 'CrankHog' }, now: Date.now })
  s.configure({ enabled: true, server: url, name: 'Ray', sharePower: true, shareHeartRate: false })
  const timer = setInterval(() => s.tick(), 50)
  stop = () => {
    clearInterval(timer)
    s.dispose()
  }
  return s
}

describe('Ride with others over a WebSocket', () => {
  it('rides with another app: both see each other move, then CrankHog leaves', async () => {
    server = new StandInServer()
    await server.listening
    const anna = await otherApp(server.url)
    anna.send({ type: 'join', rider: 'u-1', route: 'velodrome-250', room: 'public', name: 'Anna', lap: 0, distance: 40, speed: 10 })

    const s = crankhog(server.url)
    s.want({ watch: 'velodrome-250', rider: { lap: 0, distance: 10, speed: 9, power: 200, cadence: 90, heartRate: 150 }, simulated: false })

    await until(() => s.state().status === 'connected', 'the welcome')
    expect(server.hellos.at(-1)).toEqual({ type: 'hello', app: { id: 'crankhog', version: '1.4.0', name: 'CrankHog' } })
    await until(() => s.state().riders.some((r) => r.name === 'Anna'), "Anna in CrankHog's snapshot")
    expect(s.state().riders[0]).toMatchObject({ app: 'openradlr', distance: 40, speed: 10, power: null })

    await until(() => anna.heard.some((m) => m.type === 'joined'), 'Ray joining')
    const joined = anna.heard.find((m) => m.type === 'joined')!
    expect(joined.rider).toMatchObject({ app: 'crankhog', name: 'Ray', distance: 10, speed: 9, power: 200, cadence: 90 })
    expect(joined.rider).not.toHaveProperty('heart_rate')

    s.want({ watch: 'velodrome-250', rider: { lap: 0, distance: 30, speed: 9, power: 210, cadence: 91, heartRate: 151 }, simulated: false })
    await until(() => anna.heard.some((m) => m.type === 'updated'), "Ray's update", 3000)
    expect((anna.heard.find((m) => m.type === 'updated')!.riders as Msg[])[0]).toMatchObject({ distance: 30, power: 210 })

    anna.send({ type: 'update', riders: [{ rider: 'u-1', lap: 0, distance: 55, speed: 10.5 }] })
    await until(() => s.state().riders[0]?.distance === 55, "Anna's update")

    s.want({ watch: 'velodrome-250', rider: null, simulated: false })
    await until(() => anna.heard.some((m) => m.type === 'left'), 'Ray leaving')
    expect(anna.heard.find((m) => m.type === 'left')).toMatchObject({ reason: 'leave' })
    anna.ws.close()
  })

  it('notices a server that went away, and finds it again', async () => {
    server = new StandInServer()
    await server.listening
    const url = server.url
    const s = crankhog(url)
    s.want({ watch: 'velodrome-250', rider: null, simulated: false })
    await until(() => s.state().status === 'connected', 'the welcome')
    for (const c of server.wss.clients) c.terminate()
    await until(() => s.state().status === 'waiting', 'the drop')
    expect(s.state().problem).toBe('Lost the connection to the server.')
    await until(() => s.state().status === 'connected', 'the reconnect', 4000)
  })

  it("reports a server that isn't there", async () => {
    const s = crankhog('ws://127.0.0.1:9/v0')
    s.want({ watch: 'velodrome-250', rider: null, simulated: false })
    await until(() => s.state().status === 'waiting', 'the failure')
    expect(s.state().problem).toBe("Couldn't reach the server.")
  })
})
