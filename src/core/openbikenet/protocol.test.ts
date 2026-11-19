import { describe, expect, it } from 'vitest'
import { DEFAULT_GROUP_RIDE_SERVER, DEFAULT_SETTINGS } from '../../shared/settings'
import { DEFAULT_LIMITS, OBN_DEFAULT_SERVER, cleanRemoteName, displayNameProblem, encode, isLocalServer, normalizeServerUrl, parseServerMessage } from './protocol'

describe('Ride with others settings', () => {
  it('start off, with no name, on the public server', () => {
    expect(DEFAULT_GROUP_RIDE_SERVER).toBe(OBN_DEFAULT_SERVER)
    expect(DEFAULT_SETTINGS.groupRides).toEqual({ enabled: false, name: '', sharePower: true, shareHeartRate: false, server: OBN_DEFAULT_SERVER })
    expect(normalizeServerUrl(OBN_DEFAULT_SERVER)).toBe(OBN_DEFAULT_SERVER)
  })
})

describe('displayNameProblem (spec 6.3.1)', () => {
  it.each(['Ray', 'Anna-Lena', 'Ünal', '李雷', 'Ray 🐗', '👨‍👩‍👧 family', 'x'.repeat(32), '🐗'.repeat(32)])('accepts %j', (name) => {
    expect(displayNameProblem(name)).toBeNull()
  })

  it('refuses an empty or blank name', () => {
    expect(displayNameProblem('')).toMatch(/Choose/)
    expect(displayNameProblem('   ')).toMatch(/Choose/)
    expect(displayNameProblem(' 　')).toMatch(/Choose/)
  })

  it('counts code points, not UTF-16 units', () => {
    expect(displayNameProblem('x'.repeat(33))).toMatch(/32/)
    expect(displayNameProblem('🐗'.repeat(33))).toMatch(/32/)
  })

  it.each([
    ['a bidi override', 'evil‮Ray'],
    ['a zero-width space', 'Ra​y'],
    ['a newline', 'Ray\nSmith'],
    ['a private-use character', 'Ray'],
    ['a line separator', 'Ray '],
    ['a paragraph separator', 'Ray '],
    ['a C1 control', 'Ray\u0085'],
  ])('refuses %s', (_, name) => {
    expect(displayNameProblem(name)).toMatch(/invisible/)
  })
})

describe('cleanRemoteName', () => {
  it("takes invisible and direction-changing characters out of another app's rider name", () => {
    expect(cleanRemoteName('evil\u202eRay')).toBe('evilRay')
    expect(cleanRemoteName('Ra\u200by\n')).toBe('Ray')
    expect(cleanRemoteName('👨‍👩‍👧 family')).toBe('👨‍👩‍👧 family')
    expect(cleanRemoteName('\u200b\u200b')).toBe('Rider')
    expect([...cleanRemoteName('🐗'.repeat(40))]).toHaveLength(32)
  })
})

describe('normalizeServerUrl', () => {
  it.each([
    ['wss://openbikenet.cloud/v0', 'wss://openbikenet.cloud/v0'],
    ['  wss://OpenBikeNet.cloud/v0 ', 'wss://openbikenet.cloud/v0'],
    ['wss://net.example.org', 'wss://net.example.org/v0'],
    ['wss://net.example.org/', 'wss://net.example.org/v0'],
    ['wss://net.example.org:8443/obn/v0', 'wss://net.example.org:8443/obn/v0'],
    ['ws://localhost:8090', 'ws://localhost:8090/v0'],
    ['ws://127.0.0.1:8090/v0', 'ws://127.0.0.1:8090/v0'],
    ['ws://[::1]:8090/v0', 'ws://[::1]:8090/v0'],
  ])('takes %j as %j', (input, out) => {
    expect(normalizeServerUrl(input)).toBe(out)
  })

  it.each(['ws://openbikenet.cloud/v0', 'https://openbikenet.cloud/v0', 'openbikenet.cloud', 'wss://user:pw@example.org/v0', 'wss://example.org/v0?x=1', 'wss://example.org/v0#a', 'wss://', 'wss://.example.org', ''])(
    'refuses %j',
    (input) => {
      expect(normalizeServerUrl(input)).toBeNull()
    },
  )

  it('knows a server on this Mac', () => {
    expect(isLocalServer('ws://localhost:8090/v0')).toBe(true)
    expect(isLocalServer('wss://127.0.0.1/v0')).toBe(true)
    expect(isLocalServer('wss://openbikenet.cloud/v0')).toBe(false)
    expect(isLocalServer('not a url')).toBe(false)
  })
})

describe('encode', () => {
  it('writes one JSON object per message', () => {
    expect(JSON.parse(encode({ type: 'leave', rider: 'me' }))).toEqual({ type: 'leave', rider: 'me' })
  })
})

describe('parseServerMessage', () => {
  it('reads a welcome and its limits', () => {
    const m = parseServerMessage(
      JSON.stringify({ type: 'welcome', protocol: '0.2', connection: 'c9Qe4', limits: { max_update_hz: 4, rider_timeout_s: 10, max_riders: 200, max_subscriptions: 16, max_message_bytes: 65536 } }),
    )
    expect(m).toEqual({ type: 'welcome', protocol: '0.2', connection: 'c9Qe4', limits: DEFAULT_LIMITS })
  })

  it('falls back to the recommended limits when they are missing or odd', () => {
    const m = parseServerMessage(JSON.stringify({ type: 'welcome', protocol: '0.3', connection: 'x', limits: { max_update_hz: 'fast' } }))
    expect(m).toMatchObject({ type: 'welcome', limits: { max_update_hz: 4, rider_timeout_s: 10 } })
    expect(parseServerMessage(JSON.stringify({ type: 'welcome', protocol: '0.3', connection: 'x' }))).toMatchObject({ limits: DEFAULT_LIMITS })
  })

  it('keeps the good riders of a snapshot and drops a bad one', () => {
    const m = parseServerMessage(
      JSON.stringify({
        type: 'snapshot',
        route: 'velodrome-250',
        room: 'public',
        riders: [
          { id: 'r7Kx2', app: 'incyclist', name: 'Ben', lap: 5, distance: 201.3, speed: 12.1, power: 260 },
          { id: 'bad', app: 'x', name: 'Neg', lap: -1, distance: 3, speed: 1 },
          { id: 'r8', app: 'openradlr', name: 'Anna', lap: 0, distance: 0, speed: 0, mood: 'great' },
        ],
      }),
    )
    expect(m).toEqual({
      type: 'snapshot',
      route: 'velodrome-250',
      room: 'public',
      riders: [
        { id: 'r7Kx2', app: 'incyclist', name: 'Ben', lap: 5, distance: 201.3, speed: 12.1, power: 260 },
        { id: 'r8', app: 'openradlr', name: 'Anna', lap: 0, distance: 0, speed: 0 },
      ],
    })
  })

  it('reads joined, updated, left, error and pong', () => {
    expect(parseServerMessage('{"type":"joined","route":"velodrome-250","room":"public","rider":{"id":"r7","app":"incyclist","name":"Ben","lap":0,"distance":0,"speed":0}}')).toMatchObject({
      type: 'joined',
      rider: { id: 'r7', name: 'Ben' },
    })
    expect(parseServerMessage('{"type":"updated","route":"velodrome-250","room":"public","riders":[{"id":"r7","lap":5,"distance":213.4,"speed":12.1,"power":262}]}')).toMatchObject({
      type: 'updated',
      riders: [{ id: 'r7', distance: 213.4, power: 262 }],
    })
    expect(parseServerMessage('{"type":"left","route":"velodrome-250","room":"public","id":"r7","reason":"teleported"}')).toMatchObject({ type: 'left', reason: 'teleported' })
    expect(parseServerMessage('{"type":"error","code":"brand_new_code","message":"m","ref":"42","rider":"me","fatal":false}')).toEqual({
      type: 'error',
      code: 'brand_new_code',
      message: 'm',
      ref: '42',
      rider: 'me',
      fatal: false,
    })
    expect(parseServerMessage('{"type":"pong","ref":"hb-17"}')).toEqual({ type: 'pong', ref: 'hb-17' })
  })

  it('ignores what it does not know or cannot read', () => {
    expect(parseServerMessage('{"type":"fireworks"}')).toBeNull()
    expect(parseServerMessage('not json')).toBeNull()
    expect(parseServerMessage('[1,2]')).toBeNull()
    expect(parseServerMessage('null')).toBeNull()
    expect(parseServerMessage('{"type":"joined","route":"velodrome-250","room":"public","rider":{"id":"r7"}}')).toBeNull()
  })
})
