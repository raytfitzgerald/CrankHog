import { describe, expect, it } from 'vitest'
import type { SpinDownUpdate } from '../devices/driver'
import type { CommandResult } from '../devices/types'
import { FakeClock } from '../time/clock'
import { SpinDown, type SpinDownStart, type SpinDownState, type SpinDownTrainer } from './spin-down'

/** A trainer the test answers by hand: how it replies to Start, and the statuses it sends afterwards. */
class FakeTrainer implements SpinDownTrainer {
  starts = 0
  stops = 0
  private listeners = new Set<(u: SpinDownUpdate) => void>()
  constructor(private readonly reply: SpinDownStart | Promise<SpinDownStart> = { result: 'ok', targets: { lowKmh: 30, highKmh: 35 } }) {}
  async startSpinDown(): Promise<SpinDownStart> {
    this.starts++
    return this.reply
  }
  async stopSpinDown(): Promise<CommandResult> {
    this.stops++
    return 'ok'
  }
  onSpinDownStatus(l: (u: SpinDownUpdate) => void): () => void {
    this.listeners.add(l)
    return () => this.listeners.delete(l)
  }
  send(u: SpinDownUpdate): void {
    for (const l of this.listeners) l(u)
  }
  get listening(): number {
    return this.listeners.size
  }
}

async function started(trainer: FakeTrainer, clock = new FakeClock()) {
  const sd = new SpinDown(trainer, clock)
  const seen: SpinDownState[] = []
  sd.subscribe((s) => seen.push(s))
  await sd.start()
  return { sd, seen, clock }
}

describe('SpinDown', () => {
  it('asks for the speed window, then to coast, then reports the calibration done', async () => {
    const trainer = new FakeTrainer()
    const { sd, seen } = await started(trainer)
    trainer.send('stopPedaling')
    trainer.send('success')
    expect(seen).toEqual([
      { phase: 'idle' },
      { phase: 'starting' },
      { phase: 'speedUp', targets: { lowKmh: 30, highKmh: 35 } },
      { phase: 'coast' },
      { phase: 'done' },
    ])
    expect(sd.state).toEqual({ phase: 'done' })
    expect(trainer.listening).toBe(0)
    // the trainer finished it: nothing to stop
    expect(trainer.stops).toBe(0)
  })

  it('still runs on a trainer that gives no speed window', async () => {
    const { sd } = await started(new FakeTrainer({ result: 'ok', targets: null }))
    expect(sd.state).toEqual({ phase: 'speedUp', targets: null })
  })

  it("fails with the trainer's refusal when the trainer will not start one", async () => {
    expect((await started(new FakeTrainer({ result: 'unsupported', targets: null }))).sd.state).toEqual({ phase: 'failed', reason: 'unsupported' })
    expect((await started(new FakeTrainer({ result: 'not-permitted', targets: null }))).sd.state).toEqual({ phase: 'failed', reason: 'not-permitted' })
  })

  it('tells a trainer that never answered Start to stop, in case it started anyway', async () => {
    const trainer = new FakeTrainer({ result: 'timeout', targets: null })
    const { sd } = await started(trainer)
    expect(sd.state).toEqual({ phase: 'failed', reason: 'no-answer' })
    expect(trainer.stops).toBe(1)
  })

  it('does not stop a trainer that refused to start', async () => {
    const trainer = new FakeTrainer({ result: 'rejected', targets: null })
    await started(trainer)
    expect(trainer.stops).toBe(0)
  })

  it('fails when the trainer reports an error, for example after pedalling during the coast', async () => {
    const trainer = new FakeTrainer()
    const { sd } = await started(trainer)
    trainer.send('stopPedaling')
    trainer.send('error')
    expect(sd.state).toEqual({ phase: 'failed', reason: 'trainer-error' })
    expect(trainer.stops).toBe(0)
  })

  it('gives up when the rider never reaches the speed, and tells the trainer to stop', async () => {
    const trainer = new FakeTrainer()
    const { sd, clock } = await started(trainer)
    clock.advance(89_000)
    expect(sd.state.phase).toBe('speedUp')
    expect(trainer.stops).toBe(0)
    clock.advance(1_000)
    expect(sd.state).toEqual({ phase: 'failed', reason: 'timeout' })
    expect(trainer.stops).toBe(1)
  })

  it('gives up when the trainer never finishes the coast', async () => {
    const trainer = new FakeTrainer()
    const { sd, clock } = await started(trainer)
    clock.advance(80_000)
    trainer.send('stopPedaling')
    // the coast gets its own minute, not what was left of the speed-up
    clock.advance(59_000)
    expect(sd.state.phase).toBe('coast')
    clock.advance(1_000)
    expect(sd.state).toEqual({ phase: 'failed', reason: 'timeout' })
    expect(trainer.stops).toBe(1)
  })

  it('fails when the trainer drops off, with nothing left to stop', async () => {
    const trainer = new FakeTrainer()
    const { sd } = await started(trainer)
    sd.lost()
    expect(sd.state).toEqual({ phase: 'failed', reason: 'disconnected' })
    expect(trainer.stops).toBe(0)
  })

  it('fails at once when another app takes control or the trainer resets', async () => {
    for (const [update, reason] of [
      ['controlLost', 'control-lost'],
      ['reset', 'trainer-reset'],
    ] as const) {
      const trainer = new FakeTrainer()
      const { sd } = await started(trainer)
      trainer.send('stopPedaling')
      trainer.send(update)
      expect(sd.state).toEqual({ phase: 'failed', reason })
      expect(trainer.listening).toBe(0)
      // the spin down is over on the trainer, and no longer ours to stop
      expect(trainer.stops).toBe(0)
    }
  })

  it('stops the trainer, stops listening, and ignores late statuses, once cancelled', async () => {
    const trainer = new FakeTrainer()
    const { sd, clock } = await started(trainer)
    sd.cancel()
    expect(trainer.stops).toBe(1)
    trainer.send('success')
    clock.advance(120_000)
    expect(sd.state).toEqual({ phase: 'idle' })
    expect(trainer.listening).toBe(0)
    expect(trainer.stops).toBe(1)
  })

  it('stops the trainer when cancelled before it answered Start, and ignores the answer', async () => {
    let answer: (s: SpinDownStart) => void = () => undefined
    const trainer = new FakeTrainer(new Promise<SpinDownStart>((resolve) => (answer = resolve)))
    const sd = new SpinDown(trainer, new FakeClock())
    const starting = sd.start()
    expect(sd.state.phase).toBe('starting')
    sd.cancel()
    expect(trainer.stops).toBe(1)
    answer({ result: 'ok', targets: { lowKmh: 30, highKmh: 35 } })
    await starting
    expect(sd.state).toEqual({ phase: 'idle' })
  })

  it('does not stop a trainer when there is nothing running', async () => {
    const trainer = new FakeTrainer()
    const { sd } = await started(trainer)
    trainer.send('success')
    sd.cancel()
    new SpinDown(trainer, new FakeClock()).cancel()
    expect(trainer.stops).toBe(0)
  })

  it('will not start while something else holds the trainer', async () => {
    const trainer = new FakeTrainer()
    let riding = true
    const sd = new SpinDown(trainer, new FakeClock(), { busy: () => riding })
    await sd.start()
    expect(sd.state).toEqual({ phase: 'failed', reason: 'busy' })
    expect(trainer.starts).toBe(0)
    riding = false
    await sd.start()
    expect(sd.state.phase).toBe('speedUp')
  })

  it('is running from start until it ends', async () => {
    const trainer = new FakeTrainer()
    const sd = new SpinDown(trainer, new FakeClock())
    expect(sd.running).toBe(false)
    const starting = sd.start()
    expect(sd.running).toBe(true)
    await starting
    trainer.send('stopPedaling')
    expect(sd.running).toBe(true)
    trainer.send('success')
    expect(sd.running).toBe(false)
  })

  it('can run again after it finished', async () => {
    const trainer = new FakeTrainer()
    const { sd } = await started(trainer)
    trainer.send('error')
    await sd.start()
    expect(sd.state.phase).toBe('speedUp')
    expect(trainer.starts).toBe(2)
  })
})
