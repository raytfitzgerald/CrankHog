import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BleError, GattQueue, dataView, fromHex, queuedSession, toHex, type GattSession } from './transport'

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))
const HEART_RATE = '0000180d-0000-1000-8000-00805f9b34fb'
const HR_MEASUREMENT = '00002a37-0000-1000-8000-00805f9b34fb'

/** A device where each operation answers after its own delay; Infinity never answers. */
function deviceAnswering(ms: Partial<Record<keyof GattSession, number>>): GattSession {
  const after = <T>(wait: number | undefined, value: T) =>
    new Promise<T>((resolve) => {
      if (wait !== Infinity) setTimeout(() => resolve(value), wait ?? 0)
    })
  return {
    services: () => after(ms.services, [HEART_RATE]),
    characteristics: () => after(ms.characteristics, [HR_MEASUREMENT]),
    read: () => after(ms.read, dataView([0x01])),
    write: () => after(ms.write, undefined),
    subscribe: () => after(ms.subscribe, async () => undefined),
  }
}

describe('GattQueue', () => {
  it('never runs two operations at once, preserving order', async () => {
    const q = new GattQueue()
    let active = 0
    let maxActive = 0
    const order: number[] = []
    const op = (i: number, ms: number) =>
      q.run(`op${i}`, async () => {
        active++
        maxActive = Math.max(maxActive, active)
        await delay(ms)
        order.push(i)
        active--
        return i
      })
    const results = await Promise.all([op(1, 15), op(2, 1), op(3, 5)])
    expect(results).toEqual([1, 2, 3])
    expect(order).toEqual([1, 2, 3])
    expect(maxActive).toBe(1)
  })

  it('times out a hung operation and keeps serving later ones', async () => {
    const q = new GattQueue(20)
    const hung = q.run('hung', () => new Promise(() => undefined))
    const next = q.run('next', async () => 'ok')
    await expect(hung).rejects.toBeInstanceOf(BleError)
    await expect(next).resolves.toBe('ok')
  })

  it('a failing operation does not poison the queue', async () => {
    const q = new GattQueue()
    const bad = q.run('bad', async () => {
      throw new Error('boom')
    })
    await expect(bad).rejects.toThrow('boom')
    await expect(q.run('good', async () => 42)).resolves.toBe(42)
    expect(q.depth).toBe(0)
  })
})

describe('queuedSession', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('waits for a discovery that takes longer than one round trip', async () => {
    // Chromium on macOS walks the whole GATT table before the first services() answers.
    const session = queuedSession(deviceAnswering({ services: 6000 }))
    const found = session.services()
    await vi.advanceTimersByTimeAsync(6000)
    await expect(found).resolves.toEqual([HEART_RATE])
  })

  it('waits for a subscription the system has to encrypt or pair the link for', async () => {
    const session = queuedSession(deviceAnswering({ subscribe: 10_000 }))
    const subscribed = session.subscribe(HEART_RATE, HR_MEASUREMENT, () => undefined)
    await vi.advanceTimersByTimeAsync(10_000)
    await expect(subscribed).resolves.toBeTypeOf('function')
  })

  it('gives up on a discovery that never finishes', async () => {
    const session = queuedSession(deviceAnswering({ services: Infinity }))
    const failed = expect(session.services()).rejects.toMatchObject({ code: 'timeout' })
    await vi.advanceTimersByTimeAsync(60_000)
    await failed
  })

  it.each(['read', 'write'] as const)('still gives up on a %s after 4 s, so a silent trainer cannot stall control', async (op) => {
    const session = queuedSession(deviceAnswering({ [op]: 6000 }))
    const pending = op === 'read' ? session.read(HEART_RATE, HR_MEASUREMENT) : session.write(HEART_RATE, HR_MEASUREMENT, Uint8Array.of(1))
    const failed = expect(pending).rejects.toMatchObject({ code: 'timeout' })
    await vi.advanceTimersByTimeAsync(4000)
    await failed
  })
})

describe('hex helpers', () => {
  it('round-trips bytes', () => {
    const bytes = fromHex('44 00 18 01 5a 00 c8 00')
    expect(toHex(bytes)).toBe('44 00 18 01 5a 00 c8 00')
    expect(dataView(bytes).getUint16(0, true)).toBe(0x0044)
  })
})
