import { describe, expect, it, vi } from 'vitest'
import { BleError, type AcquireRequest, type BlePeripheral, type BleTransport, type GattSession } from '../ble/transport'
import { CHAR, SERVICE } from '../ble/uuids'
import { SensorHub } from '../sensors/hub'
import { FakeClock } from '../time/clock'
import type { Driver, DriverContext } from './driver'
import { defaultDriverFactory } from './drivers'
import { DeviceManager, type DeviceEvent } from './manager'

class FakePeripheral implements BlePeripheral {
  readonly id = 'p1'
  readonly chooserId = 'chooser-1'
  readonly name = 'KICKR TEST'
  connected = false
  failConnects = 0
  connectCount = 0
  session: GattSession = {
    services: async () => [],
    characteristics: async () => [],
    read: async () => new DataView(new ArrayBuffer(0)),
    write: async () => undefined,
    subscribe: async () => async () => undefined,
  }
  private dropListeners = new Set<() => void>()
  async connect(): Promise<GattSession> {
    this.connectCount++
    if (this.failConnects > 0) {
      this.failConnects--
      throw new BleError('nope', 'gatt')
    }
    this.connected = true
    return this.session
  }
  onDisconnect(l: () => void) {
    this.dropListeners.add(l)
    return () => this.dropListeners.delete(l)
  }
  disconnect() {
    this.connected = false
  }
  drop() {
    this.connected = false
    for (const l of this.dropListeners) l()
  }
}

class FakeTransport implements BleTransport {
  readonly kind = 'sim' as const
  lastRequest: AcquireRequest | null = null
  constructor(readonly peripheral: FakePeripheral) {}
  async isAvailable() {
    return true
  }
  async acquire(req: AcquireRequest) {
    this.lastRequest = req
    return this.peripheral
  }
}

function fakeDriverFactory(attaches: DriverContext[]) {
  return async (): Promise<Driver[]> => [
    {
      kind: 'hrs',
      role: 'hr',
      attach: async (_s: GattSession, ctx: DriverContext) => {
        attaches.push(ctx)
        ctx.emit('hr', 120)
      },
      detach: () => undefined,
    },
  ]
}

const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve()
}

/**
 * A heart-rate strap whose first service discovery takes `discoveryMs`, the
 * way a walk of a large GATT table over a slow link does. Later calls answer
 * at once, as they do from the platform's cache.
 */
function slowStrap(discoveryMs: number) {
  let discovered = false
  let listener: ((value: DataView) => void) | null = null
  const session: GattSession = {
    services: () =>
      new Promise((resolve) => {
        setTimeout(
          () => {
            discovered = true
            resolve([SERVICE.heartRate])
          },
          discovered ? 0 : discoveryMs,
        )
      }),
    characteristics: async () => [CHAR.heartRateMeasurement],
    read: async () => {
      throw new BleError('not readable', 'gatt')
    },
    write: async () => undefined,
    subscribe: async (_service, _characteristic, l) => {
      listener = l
      return async () => undefined
    },
  }
  /** One Heart Rate Measurement: flags 0x00 (uint8 bpm, nothing else), then the bpm. */
  const beat = (bpm: number) => listener?.(new DataView(Uint8Array.of(0x00, bpm).buffer))
  return { session, beat }
}

describe('DeviceManager', () => {
  it('connects, attaches drivers and exposes device state', async () => {
    const clock = new FakeClock()
    const hub = new SensorHub()
    const attaches: DriverContext[] = []
    const transport = new FakeTransport(new FakePeripheral())
    const mgr = new DeviceManager({ transport, hub, clock, driverFactory: fakeDriverFactory(attaches) })
    const dev = await mgr.connect('hr', { preferredChooserId: 'chooser-1' })
    expect(dev.state).toBe('connected')
    expect(dev.drivers).toEqual(['hrs'])
    expect(transport.lastRequest?.preferredChooserId).toBe('chooser-1')
    expect(transport.lastRequest?.optionalServices.length).toBeGreaterThan(5)
    expect(hub.value('hr', 0)).toBe(120)
    expect(attaches[0]?.sourceId).toBe('hr:hrs')
  })

  it('reconnects with backoff after a drop and re-attaches drivers', async () => {
    const clock = new FakeClock()
    const hub = new SensorHub()
    const attaches: DriverContext[] = []
    const peripheral = new FakePeripheral()
    const mgr = new DeviceManager({ transport: new FakeTransport(peripheral), hub, clock, driverFactory: fakeDriverFactory(attaches) })
    const events: DeviceEvent['type'][] = []
    mgr.onEvent((e) => events.push(e.type))
    await mgr.connect('hr')
    peripheral.failConnects = 1
    peripheral.drop()
    expect(mgr.get('hr')?.state).toBe('reconnecting')
    clock.advance(1000) // first retry fails
    await flush()
    expect(mgr.get('hr')?.state).toBe('reconnecting')
    clock.advance(2000) // second retry succeeds
    await flush()
    expect(mgr.get('hr')?.state).toBe('connected')
    expect(mgr.get('hr')?.reconnects).toBe(1)
    expect(attaches).toHaveLength(2)
    expect(events).toEqual(['connected', 'disconnected', 'reconnected'])
  })

  it('does not reconnect after a deliberate disconnect', async () => {
    const clock = new FakeClock()
    const peripheral = new FakePeripheral()
    const mgr = new DeviceManager({ transport: new FakeTransport(peripheral), hub: new SensorHub(), clock, driverFactory: fakeDriverFactory([]) })
    await mgr.connect('hr')
    mgr.disconnect('hr')
    peripheral.drop()
    clock.advance(30_000)
    await flush()
    expect(mgr.get('hr')).toBeUndefined()
    expect(peripheral.connectCount).toBe(1)
  })

  it('marks the device failed when no driver supports it', async () => {
    const mgr = new DeviceManager({
      transport: new FakeTransport(new FakePeripheral()),
      hub: new SensorHub(),
      clock: new FakeClock(),
      driverFactory: async () => [],
    })
    await expect(mgr.connect('trainer')).rejects.toThrow(/No supported protocol/)
    expect(mgr.get('trainer')?.state).toBe('failed')
  })

  it('connects a heart-rate strap whose discovery outlasts one round trip', async () => {
    // The Garmin HRM 200 in the Mac app: Chromium discovers the strap's whole
    // GATT table before services() answers, which takes longer than a read may.
    vi.useFakeTimers()
    try {
      const clock = new FakeClock()
      const hub = new SensorHub()
      const strap = slowStrap(6000)
      const peripheral = new FakePeripheral()
      peripheral.session = strap.session
      const mgr = new DeviceManager({ transport: new FakeTransport(peripheral), hub, clock, driverFactory: defaultDriverFactory })
      const connecting = mgr.connect('hr')
      await vi.advanceTimersByTimeAsync(6000)
      const dev = await connecting
      expect(dev.state).toBe('connected')
      expect(dev.drivers).toEqual(['hrs'])
      strap.beat(72)
      expect(hub.value('hr', clock.now())).toBe(72)
    } finally {
      vi.useRealTimers()
    }
  })
})
