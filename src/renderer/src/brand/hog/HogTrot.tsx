// Sir Loin on his own four trotters, for when he goes through the background
// rather than past you on a bike.
//
// A trot is a diagonal gait: near-front and far-rear swing together, then the
// other pair. Both legs use the same two-bone solver as the ride-along
// cyclist, so he bends at the knee instead of bending in the middle. With
// Reduce Motion on he simply stands there, which is worse for him and better
// for the rider.

import { useEffect, useRef } from 'react'
import { knee } from '../../coach/toon/motion'
import { useReducedMotion } from '../../ui/use-reduced-motion'
import { HogHead } from './HogHead'

const VIEW = { w: 128, h: 76 }
const GROUND = 64
const BODY = { x: 50, y: 34, rx: 25, ry: 16 }
/** Where each leg hangs from, and how far forward its hoof reaches. */
const LEGS = [
  { id: 'rear-far', hip: { x: 32, y: 44 }, reach: 30, phase: 0, far: true },
  { id: 'front-far', hip: { x: 66, y: 43 }, reach: 72, phase: Math.PI, far: true },
  { id: 'rear-near', hip: { x: 36, y: 45 }, reach: 34, phase: Math.PI, far: false },
  { id: 'front-near', hip: { x: 70, y: 44 }, reach: 76, phase: 0, far: false },
] as const
const THIGH = 13
const SHIN = 13
/** How far a hoof swings fore and aft, and how high it lifts. */
const SWING = 9
const LIFT = 8
/** Trotter strides per second at a walking pace. */
const STRIDE_HZ = 1.9

const pt = (p: { x: number; y: number }) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`

function legPath(hip: { x: number; y: number }, reach: number, phase: number): string {
  const hoof = { x: reach + SWING * Math.cos(phase), y: GROUND - Math.max(0, LIFT * Math.sin(phase)) }
  return `M${pt(hip)} L${pt(knee(hip, hoof, THIGH, SHIN))} L${pt(hoof)}`
}

export function HogTrot({ height = 72, label, className }: { height?: number; label: string; className?: string }) {
  const reduced = useReducedMotion()
  const ref = useRef<SVGSVGElement>(null)

  useEffect(() => {
    const svg = ref.current
    if (!svg || reduced) return
    const legs = LEGS.map((l) => ({ ...l, el: svg.querySelector(`[data-leg="${l.id}"]`) }))
    const body = svg.querySelector<SVGGElement>('[data-part="body"]')
    let raf = 0
    const step = (t: number) => {
      const p = (t / 1000) * STRIDE_HZ * Math.PI * 2
      for (const l of legs) l.el?.setAttribute('d', legPath(l.hip, l.reach, p + l.phase))
      // the body rises on each diagonal pair
      body?.setAttribute('transform', `translate(0 ${(-1.6 * Math.abs(Math.sin(p))).toFixed(2)})`)
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [reduced])

  const width = (height * VIEW.w) / VIEW.h
  const leg = (l: (typeof LEGS)[number]) => (
    <path
      key={l.id}
      data-leg={l.id}
      d={legPath(l.hip, l.reach, l.phase)}
      fill="none"
      stroke={l.far ? 'var(--color-hog-shade)' : 'var(--color-hog)'}
      strokeWidth={l.far ? 6 : 7}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  )

  return (
    <svg ref={ref} viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} width={width} height={height} role="img" aria-label={label} className={className}>
      <g data-part="body">
        {LEGS.filter((l) => l.far).map(leg)}
        {/* the tail, curled */}
        <path
          d="M26 28 q-7 -4 -9 1 q-2 5 3 5 q4 0 3 -4"
          fill="none"
          stroke="var(--color-hog)"
          strokeWidth={3.4}
          strokeLinecap="round"
          transform="translate(-1 0)"
        />
        <ellipse cx={BODY.x} cy={BODY.y} rx={BODY.rx} ry={BODY.ry} fill="var(--color-hog)" stroke="var(--color-night)" strokeWidth={2.4} />
        {LEGS.filter((l) => !l.far).map(leg)}
        <g transform="translate(80 27) scale(1.45)">
          <HogHead />
        </g>
      </g>
    </svg>
  )
}
