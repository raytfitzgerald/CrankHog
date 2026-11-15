// The countdown beeps' sound: a short sine tone for each tick, a longer and
// higher one for the go. Generated with Web Audio, so there is no file to ship
// and nothing to load. What to play, and when, is decided in
// @core/ride/countdown and src/renderer/src/runtime/beeps.ts.
import type { Beep } from '@core/ride/countdown'

const TONE: Record<Beep, { hz: number; seconds: number }> = {
  tick: { hz: 880, seconds: 0.12 },
  go: { hz: 1320, seconds: 0.45 },
}
/** Fade in and out over a few ms, so the tone starts and stops without a click. */
const ATTACK_S = 0.005
/** A beep waiting for its context to wake is dropped past this: it would no longer mark the second it was for. */
const LATE_MS = 250
/** What wakes a suspended context: a click or tap (down for a mouse, up for a finger) or a key. */
const GESTURES = ['pointerdown', 'pointerup', 'keydown'] as const

let ctx: AudioContext | null = null

function context(): AudioContext | null {
  if (typeof AudioContext === 'undefined') return null
  if (!ctx || ctx.state === 'closed') ctx = new AudioContext()
  return ctx
}

/** Plays one beep at `volume` (0 to 1). Silent where there is no Web Audio. */
export function playBeep(beep: Beep, volume: number): void {
  if (volume <= 0) return
  const ac = context()
  if (!ac) return
  if (ac.state === 'running') {
    tone(ac, beep, volume)
    return
  }
  // A context that isn't running has a stopped clock: tones scheduled on it
  // would pile up and sound all at once when it wakes, or never. So the beep
  // waits for the wake, and is dropped if it is late. Without a recent click
  // or tap, iOS and browsers keep the context asleep until the next one.
  const asked = performance.now()
  void ac.resume().then(
    () => {
      if (ac.state === 'running' && performance.now() - asked <= LATE_MS) tone(ac, beep, volume)
    },
    () => undefined,
  )
}

function tone(ac: AudioContext, beep: Beep, volume: number): void {
  const { hz, seconds } = TONE[beep]
  const t = ac.currentTime
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(hz, t)
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.linearRampToValueAtTime(Math.min(1, volume), t + ATTACK_S)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + seconds)
  osc.connect(gain).connect(ac.destination)
  osc.start(t)
  osc.stop(t + seconds + ATTACK_S)
}

/**
 * Browsers and iOS start an audio context suspended until the page gets a
 * click, a tap or a key press, and iOS suspends it again after an interruption
 * (a call, Siri, switching apps). Mid-ride there may be no gesture for a long
 * time, so every gesture wakes a context that isn't running, before the next
 * beep is due. Nothing is created while `enabled` says the beeps are off.
 * Returns a function that stops listening.
 */
export function primeBeeps(enabled: () => boolean): () => void {
  if (typeof window === 'undefined') return () => undefined
  const wake = () => {
    if (!enabled()) return
    const ac = context()
    if (ac && ac.state !== 'running') void ac.resume().catch(() => undefined)
  }
  for (const e of GESTURES) window.addEventListener(e, wake)
  return () => {
    for (const e of GESTURES) window.removeEventListener(e, wake)
  }
}
