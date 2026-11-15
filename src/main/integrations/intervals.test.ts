import { mkdtempSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { SecretStore, type Cipher } from '../secrets/secret-store'
import { IntervalsClient } from './intervals'

const plainCipher: Cipher = { isAvailable: () => true, encrypt: (s) => Buffer.from(s, 'utf8'), decrypt: (b) => b.toString('utf8') }
const ZWO = '<workout_file><name>Tempo</name><workout><SteadyState Duration="600" Power="0.8"/></workout></workout_file>'

let server: Server | null = null
afterEach(() => server?.close())

/** A stand-in intervals.icu that answers the events call with `events`, and records what it was asked. */
async function fakeIntervals(events: unknown) {
  const seen: { path: string; query: URLSearchParams; auth: string }[] = []
  server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')
    seen.push({ path: url.pathname, query: url.searchParams, auth: String(req.headers.authorization) })
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify(events))
  })
  await new Promise<void>((r) => server!.listen(0, '127.0.0.1', () => r()))
  const base = `http://127.0.0.1:${(server!.address() as AddressInfo).port}/api/v1`
  const client = new IntervalsClient(SecretStore.inDir(mkdtempSync(join(tmpdir(), 'crankhog-intervals-')), plainCipher), base)
  return { client, seen }
}

describe('intervals.icu planned workouts', () => {
  it('asks for the workouts on the calendar in a date range, with the workout as a Zwift file', async () => {
    const { client, seen } = await fakeIntervals([
      { id: 11, start_date_local: '2026-11-18T00:00:00', name: 'Tempo', type: 'Ride', category: 'WORKOUT', description: '- 10m 80%', workout_file_base64: Buffer.from(ZWO).toString('base64'), workout_filename: 'Tempo.zwo' },
    ])
    client.configure({ apiKey: 'secret-key-123', athleteId: 'i42' })
    const events = await client.plannedWorkouts('2026-11-14', '2026-11-27')
    expect(seen[0]!.path).toBe('/api/v1/athlete/i42/events')
    expect(Object.fromEntries(seen[0]!.query)).toEqual({ oldest: '2026-11-14', newest: '2026-11-27', category: 'WORKOUT', ext: 'zwo' })
    expect(seen[0]!.auth).toBe(`Basic ${Buffer.from('API_KEY:secret-key-123').toString('base64')}`)
    expect(events).toEqual([{ id: '11', start_date_local: '2026-11-18T00:00:00', name: 'Tempo', type: 'Ride', description: '- 10m 80%', zwo: ZWO }])
  })

  it('drops events that are not workouts or are malformed, and passes on rides without a file', async () => {
    const { client } = await fakeIntervals([
      { id: 1, start_date_local: '2026-11-18T00:00:00', name: 'Note', category: 'NOTE' },
      { id: 2, name: 'No date', category: 'WORKOUT' },
      'nonsense',
      { id: 3, start_date_local: '2026-11-19T00:00:00', name: 'Text only', type: 'VirtualRide', category: 'WORKOUT', description: '- 20m 60%' },
    ])
    client.configure({ apiKey: 'secret-key-123', athleteId: '0' })
    expect(await client.plannedWorkouts('2026-11-14', '2026-11-27')).toEqual([{ id: '3', start_date_local: '2026-11-19T00:00:00', name: 'Text only', type: 'VirtualRide', description: '- 20m 60%', zwo: null }])
  })

  it('refuses without a key, or for a range of more than a few months', async () => {
    const { client, seen } = await fakeIntervals([])
    await expect(client.plannedWorkouts('2026-11-14', '2026-11-27')).rejects.toThrow(/not configured/)
    client.configure({ apiKey: 'secret-key-123', athleteId: '0' })
    await expect(client.plannedWorkouts('2026-01-01', '2026-12-31')).rejects.toThrow(/range/)
    expect(seen).toHaveLength(0)
  })
})
