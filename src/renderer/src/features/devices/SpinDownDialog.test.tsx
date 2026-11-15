import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { SpinDown, type SpinDownFailure, type SpinDownStart, type SpinDownTrainer } from '@core/control/spin-down'
import type { SpinDownUpdate } from '@core/devices/driver'
import { FakeClock } from '@core/time/clock'
import { DEFAULT_SETTINGS, type AppSettings } from '@shared/settings'
import { EMPTY_FRAME } from '@shared/live'
import { liveStore } from '../../stores/live'
import { rideStore } from '../../stores/ride'
import { settingsStore } from '../../stores/settings'
import { SpinDownDialog } from './SpinDownDialog'

class FakeTrainer implements SpinDownTrainer {
  stops = 0
  private listeners = new Set<(u: SpinDownUpdate) => void>()
  constructor(private readonly reply: SpinDownStart = { result: 'ok', targets: { lowKmh: 30, highKmh: 35 } }) {}
  async startSpinDown() {
    return this.reply
  }
  async stopSpinDown() {
    this.stops++
    return 'ok' as const
  }
  onSpinDownStatus(l: (u: SpinDownUpdate) => void) {
    this.listeners.add(l)
    return () => this.listeners.delete(l)
  }
  send(u: SpinDownUpdate) {
    act(() => this.listeners.forEach((l) => l(u)))
  }
}

function open(trainer: FakeTrainer | (() => SpinDown | SpinDownFailure), settings: Partial<AppSettings> = {}) {
  settingsStore.setState({ ...DEFAULT_SETTINGS, speedUnit: 'kmh', ...settings }, true)
  let closed = false
  const create = trainer instanceof FakeTrainer ? () => new SpinDown(trainer, new FakeClock()) : trainer
  const view = render(<SpinDownDialog open onOpenChange={(o) => (closed = !o)} create={create} />)
  return { closed: () => closed, unmount: view.unmount }
}

const press = async (name: string) => {
  await act(async () => fireEvent.click(screen.getByRole('button', { name })))
}
const start = () => press('Start calibration')
const step = () => screen.getByTestId('spin-down-step').textContent

describe('SpinDownDialog', () => {
  afterEach(() => {
    cleanup()
    liveStore.setState(EMPTY_FRAME, true)
    rideStore.setState({ active: false })
  })

  it('walks the rider through speeding up, coasting, and the result', async () => {
    const trainer = new FakeTrainer()
    open(trainer)
    expect(screen.getByText(/warm up for 10 minutes/i)).toBeTruthy()
    await start()
    expect(step()).toBe('Speed up to 35 km/h')
    act(() => liveStore.setState({ ...EMPTY_FRAME, speedKmh: 28.4 }))
    expect(screen.getByTestId('spin-down-speed').textContent).toBe('28.4')
    trainer.send('stopPedaling')
    expect(step()).toBe('Stop pedalling')
    trainer.send('success')
    expect(step()).toBe('Calibrated')
    expect(trainer.stops).toBe(0)
  })

  it('tells the trainer to stop when the rider cancels', async () => {
    const trainer = new FakeTrainer()
    const { closed } = open(trainer)
    await start()
    await press('Cancel')
    expect(closed()).toBe(true)
    expect(trainer.stops).toBe(1)
  })

  it('tells the trainer to stop when the dialog goes away mid-calibration', async () => {
    const trainer = new FakeTrainer()
    const { unmount } = open(trainer)
    await start()
    trainer.send('stopPedaling')
    unmount()
    expect(trainer.stops).toBe(1)
  })

  it("shows the speed window in the rider's units", async () => {
    open(new FakeTrainer(), { speedUnit: 'mph' })
    await start()
    expect(step()).toBe('Speed up to 21.7 mph')
  })

  it('explains a failure and offers another go', async () => {
    const trainer = new FakeTrainer()
    open(trainer)
    await start()
    trainer.send('stopPedaling')
    trainer.send('error')
    expect(step()).toBe('The coast-down failed')
    expect(screen.getByText(/keep your legs still/i)).toBeTruthy()
    await press('Try again')
    expect(step()).toBe('Speed up to 35 km/h')
  })

  it('says the trainer is reconnecting, and keeps Try again, when there is no trainer to calibrate yet', async () => {
    let ready = false
    const trainer = new FakeTrainer()
    open(() => (ready ? new SpinDown(trainer, new FakeClock()) : 'disconnected'))
    await start()
    expect(step()).toBe("The trainer isn't connected")
    expect(screen.getByText(/wait for it to reconnect/i)).toBeTruthy()
    ready = true
    await press('Try again')
    expect(step()).toBe('Speed up to 35 km/h')
  })

  it('says what happened when another app takes the trainer partway through', async () => {
    const trainer = new FakeTrainer()
    open(trainer)
    await start()
    trainer.send('controlLost')
    expect(step()).toBe('Another app took the trainer')
    expect(screen.getByText(/stopped the calibration/i)).toBeTruthy()
  })

  it('says when another app holds the trainer', async () => {
    open(new FakeTrainer({ result: 'not-permitted', targets: null }))
    await start()
    expect(screen.getByText(/another app/i)).toBeTruthy()
  })

  it('will not start during a ride', () => {
    rideStore.setState({ active: true })
    open(new FakeTrainer())
    expect((screen.getByRole('button', { name: 'Start calibration' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText(/finish your ride first/i)).toBeTruthy()
  })

  it('starts with a free-ride target still held and nothing recording, and says it lets it go', () => {
    liveStore.setState({ ...EMPTY_FRAME, trainer: { ...EMPTY_FRAME.trainer, mode: 'erg' } })
    open(new FakeTrainer())
    expect((screen.getByRole('button', { name: 'Start calibration' }) as HTMLButtonElement).disabled).toBe(false)
    expect(screen.queryByText(/finish your ride first/i)).toBeNull()
    expect(screen.getByText(/free-ride target/i)).toBeTruthy()
  })
})
