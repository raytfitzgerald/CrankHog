import { describe, expect, it } from 'vitest'
import { invoke, type EventMap } from './contract'
import { EVENT_CHANNELS, INVOKE_CHANNELS } from './channels'

describe('IPC contract', () => {
  it('preload invoke allowlist matches the contract exactly', () => {
    expect([...INVOKE_CHANNELS].sort()).toEqual(Object.keys(invoke).sort())
  })

  it('preload event allowlist matches EventMap', () => {
    // EventMap is a type; keep this list in sync by construction.
    const events: Record<keyof EventMap, true> = { 'app.log': true, 'settings.changed': true, 'ble.chooser': true, 'ble.chosen': true, 'power.suspend': true, 'uploads.changed': true, 'google.calendar.changed': true, 'update.status': true, 'ai.stream.delta': true, 'ai.stream.end': true, 'live.broadcast': true, 'ride.command': true, 'mcp.call': true, 'mcp.status': true, 'groupRide.state': true }
    expect([...EVENT_CHANNELS].sort()).toEqual(Object.keys(events).sort())
  })

  it('takes a shared track and the rider on it, and nothing odd', () => {
    const set = (req: unknown) => invoke['groupRide.set'].req.safeParse(req).success
    const rider = { lap: 3, distance: 112.4, speed: 11.8, power: 245, cadence: 92, heartRate: null }
    expect(set({ watch: 'velodrome-250', rider, simulated: false })).toBe(true)
    expect(set({ watch: null, rider: null, simulated: false })).toBe(true)
    expect(set({ watch: 'Velodrome 250', rider: null, simulated: false })).toBe(false)
    expect(set({ watch: 'velodrome-250', rider: { ...rider, lap: -1 }, simulated: false })).toBe(false)
    expect(set({ watch: 'velodrome-250', rider: { ...rider, speed: Number.NaN }, simulated: false })).toBe(false)
    expect(set({ watch: 'velodrome-250', rider })).toBe(false)
  })

  it('rejects oversized ping payloads', () => {
    expect(invoke['app.ping'].req.safeParse({ msg: 'x'.repeat(201) }).success).toBe(false)
    expect(invoke['app.ping'].req.safeParse({ msg: 'hi' }).success).toBe(true)
  })

  it('takes only real days for the intervals.icu calendar', () => {
    const ok = (oldest: string, newest = '2026-12-15') => invoke['intervals.planned'].req.safeParse({ oldest, newest }).success
    expect(ok('2026-11-18')).toBe(true)
    expect(ok('2028-02-29')).toBe(true)
    expect(ok('2026-13-45')).toBe(false)
    expect(ok('2026-02-30')).toBe(false)
    expect(ok('2026-11-8')).toBe(false)
  })

  it('takes a Google desktop client, and bounded calendar syncs', () => {
    const app = (clientId: string, clientSecret = 'GOCSPX-fake-xxxxxxxxxxxxxxxx') => invoke['google.setApp'].req.safeParse({ clientId, clientSecret }).success
    expect(app('123456789012-abcdefghijklmnop1234.apps.googleusercontent.com')).toBe(true)
    expect(app('not-a-client-id')).toBe(false)
    expect(app('123456789012-abcdefghijklmnop1234.apps.googleusercontent.com', 'short')).toBe(false)
    const sync = (events: unknown[]) => invoke['google.calendar.sync'].req.safeParse({ windowStart: '2026-10-17', events }).success
    expect(sync([{ key: 's1', date: '2026-11-18', title: 'Sweet spot', description: '' }])).toBe(true)
    expect(sync([{ key: 's1', date: '2026-02-30', title: 'Sweet spot', description: '' }])).toBe(false)
    expect(sync([{ key: 's1', date: '2026-11-18', title: '', description: '' }])).toBe(false)
  })
})
