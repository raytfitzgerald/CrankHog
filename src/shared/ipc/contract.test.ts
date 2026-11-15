import { describe, expect, it } from 'vitest'
import { invoke, type EventMap } from './contract'
import { EVENT_CHANNELS, INVOKE_CHANNELS } from './channels'

describe('IPC contract', () => {
  it('preload invoke allowlist matches the contract exactly', () => {
    expect([...INVOKE_CHANNELS].sort()).toEqual(Object.keys(invoke).sort())
  })

  it('preload event allowlist matches EventMap', () => {
    // EventMap is a type; keep this list in sync by construction.
    const events: Record<keyof EventMap, true> = { 'app.log': true, 'settings.changed': true, 'ble.chooser': true, 'ble.chosen': true, 'power.suspend': true, 'uploads.changed': true, 'update.status': true, 'ai.stream.delta': true, 'ai.stream.end': true, 'live.broadcast': true, 'ride.command': true }
    expect([...EVENT_CHANNELS].sort()).toEqual(Object.keys(events).sort())
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
})
