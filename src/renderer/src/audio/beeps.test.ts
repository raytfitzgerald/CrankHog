import { afterEach, describe, expect, it, vi } from 'vitest'

/** Records the tones a page would make: each oscillator's pitch and length, and each gain node's peak. */
class FakeAudioContext {
  static made: FakeAudioContext[] = []
  /** The state a new context starts in. */
  static startState: AudioContextState = 'suspended'
  state: AudioContextState = FakeAudioContext.startState
  currentTime = 10
  destination = {}
  oscillators: { hz: number; startAt: number; stopAt: number }[] = []
  gains: { peak: number }[] = []
  /** resume() calls not answered yet: the context wakes only when the test says so. */
  private waiting: (() => void)[] = []
  constructor() {
    FakeAudioContext.made.push(this)
  }
  resume = vi.fn(() => new Promise<void>((resolve) => this.waiting.push(resolve)))
  /** The browser lets the context run, answering every resume() so far. */
  wake() {
    this.state = 'running'
    for (const resolve of this.waiting.splice(0)) resolve()
  }
  createOscillator() {
    const o = { hz: 0, startAt: NaN, stopAt: NaN }
    this.oscillators.push(o)
    return {
      type: 'sine',
      frequency: { setValueAtTime: (v: number) => (o.hz = v) },
      connect: (n: unknown) => n,
      start: (t: number) => (o.startAt = t),
      stop: (t: number) => (o.stopAt = t),
    }
  }
  createGain() {
    const g = { peak: 0 }
    this.gains.push(g)
    const track = (v: number) => (g.peak = Math.max(g.peak, v))
    return {
      gain: { setValueAtTime: track, linearRampToValueAtTime: track, exponentialRampToValueAtTime: track },
      connect: (n: unknown) => n,
    }
  }
  /** One oscillator and one gain per beep, in order. */
  get tones() {
    return this.oscillators.map((o, i) => ({ ...o, peak: this.gains[i]!.peak }))
  }
}

const load = async (startState: AudioContextState = 'suspended') => {
  vi.resetModules()
  FakeAudioContext.made = []
  FakeAudioContext.startState = startState
  vi.stubGlobal('AudioContext', FakeAudioContext)
  return import('./beeps')
}

/** Lets resume() promises settle. */
const settle = () => new Promise<void>((r) => setTimeout(r, 0))

/** Moves performance.now() by hand. */
function clockAt(ms: number) {
  let now = ms
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  return (to: number) => (now = to)
}

const offs: (() => void)[] = []

afterEach(() => {
  for (const off of offs.splice(0)) off()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('playBeep', () => {
  it('sounds the go longer and higher than a tick, as loud as asked', async () => {
    const { playBeep } = await load('running')
    playBeep('tick', 0.5)
    playBeep('go', 0.5)
    const [tick, go] = FakeAudioContext.made[0]!.tones
    expect(go!.hz).toBeGreaterThan(tick!.hz)
    expect(go!.stopAt - go!.startAt).toBeGreaterThan(tick!.stopAt - tick!.startAt)
    expect(tick!.peak).toBeCloseTo(0.5)
    expect(go!.peak).toBeCloseTo(0.5)
  })

  it('makes no sound, and no audio context, at volume 0', async () => {
    const { playBeep } = await load()
    playBeep('go', 0)
    expect(FakeAudioContext.made).toHaveLength(0)
  })

  it('wakes a suspended context and plays the beep once it runs, when that is at once', async () => {
    const { playBeep } = await load()
    playBeep('tick', 1)
    const ac = FakeAudioContext.made[0]!
    expect(ac.resume).toHaveBeenCalled()
    expect(ac.tones).toHaveLength(0)
    ac.wake()
    await settle()
    expect(ac.tones).toHaveLength(1)
    expect(ac.tones[0]!.startAt).toBe(ac.currentTime)
  })

  it('schedules nothing on a context that stays asleep, and drops the late beeps when it wakes instead of playing them at once', async () => {
    const { playBeep } = await load()
    const setNow = clockAt(0)
    playBeep('tick', 1)
    setNow(1000)
    playBeep('tick', 1)
    setNow(2000)
    playBeep('tick', 1)
    const ac = FakeAudioContext.made[0]!
    await settle()
    expect(ac.tones).toHaveLength(0)
    // a tap a little after the third tick: only that one is still on time
    setNow(2100)
    ac.wake()
    await settle()
    expect(ac.tones).toHaveLength(1)
  })

  it('replaces a closed context', async () => {
    const { playBeep } = await load('running')
    playBeep('tick', 1)
    FakeAudioContext.made[0]!.state = 'closed'
    playBeep('tick', 1)
    expect(FakeAudioContext.made).toHaveLength(2)
    expect(FakeAudioContext.made[1]!.tones).toHaveLength(1)
  })

  it('does nothing where the browser has no Web Audio', async () => {
    vi.resetModules()
    vi.stubGlobal('AudioContext', undefined)
    const { playBeep } = await import('./beeps')
    expect(() => playBeep('tick', 1)).not.toThrow()
  })
})

describe('primeBeeps', () => {
  it('wakes a suspended audio context at the first click, so the first beep is heard', async () => {
    const { primeBeeps } = await load()
    offs.push(primeBeeps(() => true))
    expect(FakeAudioContext.made).toHaveLength(0)
    window.dispatchEvent(new Event('pointerdown'))
    expect(FakeAudioContext.made[0]!.resume).toHaveBeenCalledTimes(1)
  })

  it('keeps listening, so a context iOS suspended again wakes at the next tap or key', async () => {
    const { primeBeeps } = await load()
    offs.push(primeBeeps(() => true))
    window.dispatchEvent(new Event('pointerup'))
    const ac = FakeAudioContext.made[0]!
    ac.wake()
    window.dispatchEvent(new Event('pointerup'))
    expect(ac.resume).toHaveBeenCalledTimes(1)
    // a phone call
    ac.state = 'interrupted' as AudioContextState
    window.dispatchEvent(new Event('keydown'))
    expect(ac.resume).toHaveBeenCalledTimes(2)
  })

  it('makes no audio context while the beeps are off', async () => {
    const { primeBeeps } = await load()
    let on = false
    offs.push(primeBeeps(() => on))
    window.dispatchEvent(new Event('pointerdown'))
    expect(FakeAudioContext.made).toHaveLength(0)
    on = true
    window.dispatchEvent(new Event('pointerdown'))
    expect(FakeAudioContext.made).toHaveLength(1)
  })

  it('stops listening when asked', async () => {
    const { primeBeeps } = await load()
    primeBeeps(() => true)()
    window.dispatchEvent(new Event('pointerdown'))
    expect(FakeAudioContext.made).toHaveLength(0)
  })
})
