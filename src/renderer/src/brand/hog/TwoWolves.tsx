// The two wolves: what's at the end of cranking the hog (`@core/mascot/crank`).
// It's all the picture, no words of ours. The curtain comes down over the
// app, and the picture's own captions go up one at a time, cut out of it and
// sitting where they sit in it. Then the punchline, cut out the same way,
// slams down into its place, and the rest of the picture comes up slowly
// behind it. A click skips to the punchline; once the picture is all up,
// another click, or Esc at any point, goes back to Home. Clicks that are
// still part of the run that cranked him don't count (`WOLVES_CALM_MS`), so
// nobody clicks straight through it. Under Reduce Motion the slam is a fade.
//
// HomeHero loads this on demand, so the picture is never fetched unless
// someone cranks him, and leaves it out of the iPhone build entirely.
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { TWO_WOLVES, WOLF_BEATS_MS, WOLVES_CALM_MS, WOLVES_REST_DELAY_MS, WOLVES_REST_MS } from '@core/mascot/crank'
import { cn } from '../../ui/cn'
import { useReducedMotion } from '../../ui/use-reduced-motion'
import crankYourHog from './crank-your-hog.jpg'

const PUNCHLINE = WOLF_BEATS_MS.length

/** The picture is this many pixels square. */
const SIZE = 447
/** Where its two captions sit, in its own pixel rows. */
const CAPTIONS = [
  { top: 3, bottom: 38 },
  { top: 329, bottom: 363 },
] as const
/** And "crank your hog", underneath them. */
const PUNCH = { top: 366, bottom: 444 } as const

const pct = (rows: number) => `${((rows / SIZE) * 100).toFixed(2)}%`
/** Just these rows of the picture. */
const rows = (r: { top: number; bottom: number }) => `inset(${pct(r.top)} 0 ${pct(SIZE - r.bottom)} 0)`

export function TwoWolves({ onClose }: { onClose: () => void }) {
  const reduced = useReducedMotion()
  // 0 the curtain, 1 and 2 the captions, 3 the punchline; it only ever goes forward
  const [beat, setBeat] = useState(0)
  // the rest of the picture is all the way up
  const [whole, setWhole] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  // the last click, with the curtain coming down counted as one
  const lastClick = useRef(0)
  const landed = beat >= PUNCHLINE

  useEffect(() => {
    lastClick.current = Date.now()
    ref.current?.focus()
    const timers = WOLF_BEATS_MS.map((ms, i) => setTimeout(() => setBeat((b) => Math.max(b, i + 1)), ms))
    return () => timers.forEach(clearTimeout)
  }, [])

  // the slow reveal runs in CSS; this says when it's done, however the punchline got here
  useEffect(() => {
    if (!landed) return
    const t = setTimeout(() => setWhole(true), WOLVES_REST_DELAY_MS + WOLVES_REST_MS)
    return () => clearTimeout(t)
  }, [landed])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const onClick = () => {
    const now = Date.now()
    const calm = now - lastClick.current >= WOLVES_CALM_MS
    lastClick.current = now
    // still clicking from cranking him: let it play
    if (!calm) return
    if (!landed) setBeat(PUNCHLINE)
    // and the picture comes up at its own pace
    else if (whole) onClose()
  }

  const rise = (from: number) =>
    cn('transition-all duration-700 ease-out', beat >= from ? 'opacity-100' : 'opacity-0', !reduced && (beat >= from ? 'translate-y-0' : 'translate-y-4'))

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label="Two wolves"
      tabIndex={-1}
      className="fixed inset-0 z-[100] flex cursor-pointer select-none items-center justify-center overflow-hidden bg-night p-6 outline-none"
      style={{ animation: 'wolves-fade 450ms ease-out both' }}
      onClick={onClick}
      data-whole={whole || undefined}
      data-testid="two-wolves"
    >
      {/* everything is the one picture, laid over itself, so the pieces line up exactly */}
      <div className="relative aspect-square w-[min(86vw,76vh,560px)]">
        {landed && (
          // the rest of it, coming up out of the dark behind the words; read out whole from the moment the punchline lands
          <img
            src={crankYourHog}
            alt={TWO_WOLVES.picture}
            draggable={false}
            className="absolute inset-0 size-full rounded-2xl shadow-2xl"
            style={{ animation: `wolves-emerge ${WOLVES_REST_MS}ms ease-in-out ${WOLVES_REST_DELAY_MS}ms both` }}
            data-testid="two-wolves-picture"
          />
        )}
        {CAPTIONS.map((c, i) => {
          // read out while it's the newest thing on screen
          const shown = beat >= i + 1 && !landed
          return (
            <img
              key={c.top}
              src={crankYourHog}
              alt={shown ? TWO_WOLVES.setup[i] : ''}
              aria-hidden={!shown || undefined}
              draggable={false}
              className={cn('absolute inset-0 size-full rounded-2xl', rise(i + 1))}
              style={{ clipPath: rows(c) }}
              data-testid="two-wolves-caption"
            />
          )
        })}
        {landed && (
          <img
            src={crankYourHog}
            alt=""
            aria-hidden
            draggable={false}
            className="absolute inset-0 size-full rounded-2xl"
            style={{
              clipPath: rows(PUNCH),
              // it slams down about its own middle, not the picture's
              transformOrigin: `50% ${pct((PUNCH.top + PUNCH.bottom) / 2)}`,
              animation: reduced ? 'wolves-fade 600ms ease-out both' : 'wolves-slam 900ms cubic-bezier(0.2, 0.9, 0.3, 1.15) both',
            }}
            data-testid="two-wolves-punchline"
          />
        )}
      </div>
      {/* the punchline lands hard: one flash, never under Reduce Motion */}
      {landed && !reduced && <div className="pointer-events-none absolute inset-0 bg-board" style={{ animation: 'wolves-flash 500ms ease-out both' }} aria-hidden />}
    </div>,
    document.body,
  )
}
