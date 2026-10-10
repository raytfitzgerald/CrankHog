// The country the ride-along rides through.
//
// Three depths behind the fence, each drifting at its own speed, which is what
// makes a flat strip of tarmac read as somewhere: hills on the horizon, a line
// of trees and telegraph poles nearer, and the fence and road (drawn by
// RideAlong) nearest and fastest.
//
// Each layer is one tile repeated end to end and slid along with a transform,
// so a frame costs three style writes however long the ride is. The tiles are
// wide and unevenly packed, so the repeat doesn't read as a repeat.
//
// Everything is drawn in theme tokens, several steps back from the ink: it is
// scenery, and the numbers are the product (docs/BRAND.md). With Reduce Motion
// on it all stands still.

import { useEffect, useRef } from 'react'
import { useReducedMotion } from '../../ui/use-reduced-motion'

/** One tile of each layer, in px. Wide enough that the repeat isn't obvious. */
const FAR_W = 760
const MID_W = 560
/** How many metres of road go by for one pixel of drift, per layer. */
const FAR_PX_PER_M = 0.55
const MID_PX_PER_M = 2.6
/** Enough tiles to cover a wide window and still have one to wrap in. */
const COPIES = 4

/** Hills: low, soft and far enough back to be almost flat. */
function FarTile({ x }: { x: number }) {
  return (
    <g transform={`translate(${x} 0)`}>
      <path d="M0 48 L70 18 L130 36 L210 6 L300 40 L360 22 L430 48 Z" fill="var(--color-panel-3)" />
      <path d="M380 48 L450 26 L520 42 L590 14 L660 38 L720 24 L760 48 Z" fill="var(--color-panel-3)" />
      {/* a nearer ridge, a shade stronger */}
      <path d="M-20 48 L60 30 L120 44 L200 26 L260 48 Z" fill="var(--color-line)" opacity={0.75} />
      <path d="M470 48 L540 32 L610 46 L690 30 L760 48 Z" fill="var(--color-line)" opacity={0.75} />
      <Birds x={176} y={10} />
      <Birds x={560} y={6} />
    </g>
  )
}

/** A tree: a trunk and two blobs. Small enough to read at 40 px. */
function Tree({ x, s = 1 }: { x: number; s?: number }) {
  return (
    <g transform={`translate(${x} 62) scale(${s})`}>
      <path d="M-2 0 L-2 -16 L2 -16 L2 0 Z" fill="var(--color-line-strong)" />
      <circle cx={0} cy={-24} r={11} fill="var(--color-line-strong)" />
      <circle cx={-7} cy={-18} r={7} fill="var(--color-line-strong)" />
      <circle cx={7} cy={-19} r={6.5} fill="var(--color-line-strong)" />
    </g>
  )
}

/** A telegraph pole, with the wires that make a road feel like a road. */
function Pole({ x }: { x: number }) {
  return (
    <g transform={`translate(${x} 62)`} stroke="var(--color-line-strong)" fill="none">
      <path d="M0 0 L0 -44" strokeWidth={2.4} />
      <path d="M-9 -38 L9 -38 M-7 -31 L7 -31" strokeWidth={2} />
    </g>
  )
}

/** Birds, because an empty sky reads as a blank panel. */
function Birds({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`} stroke="var(--color-line)" strokeWidth={1.6} fill="none" strokeLinecap="round">
      <path d="M0 0 q3 -3 6 0 M7 1 q3 -3 6 0" />
      <path d="M16 -6 q2.5 -2.5 5 0" />
    </g>
  )
}

/** Hogs in a field, grazing, entirely uninterested in your ride. */
function Herd({ x }: { x: number }) {
  const hog = (dx: number, s: number) => (
    <g transform={`translate(${dx} 0) scale(${s})`} fill="var(--color-line)">
      <ellipse cx={0} cy={-6} rx={8} ry={5} />
      <circle cx={8} cy={-8} r={4} />
      <path d="M6 -11 l-3 -4 l5 1 Z" />
      <path d="M-5 -1 v2 M-1 -1 v2 M3 -1 v2 M6 -1 v2" stroke="var(--color-line)" strokeWidth={1.6} />
    </g>
  )
  return (
    <g transform={`translate(${x} 62)`}>
      {hog(0, 1)}
      {hog(22, 0.8)}
      {hog(40, 0.9)}
    </g>
  )
}

/** A bush, for the gaps. */
function Bush({ x }: { x: number }) {
  return (
    <g transform={`translate(${x} 62)`} fill="var(--color-line)">
      <circle cx={-6} cy={-5} r={6} />
      <circle cx={2} cy={-8} r={7.5} />
      <circle cx={9} cy={-5} r={5.5} />
    </g>
  )
}

/** A barn, so there is something with a straight edge among the round things. */
function Barn({ x }: { x: number }) {
  return (
    <g transform={`translate(${x} 62)`}>
      <path d="M0 0 L0 -20 L34 -20 L34 0 Z" fill="var(--color-line)" />
      <path d="M-4 -20 L17 -32 L38 -20 Z" fill="var(--color-line-strong)" />
    </g>
  )
}

/** Trees, poles and the odd building, spaced unevenly on purpose. */
function MidTile({ x }: { x: number }) {
  return (
    <g transform={`translate(${x} 0)`}>
      <Tree x={24} s={1.05} />
      <Bush x={66} />
      <Pole x={110} />
      <Tree x={158} s={0.85} />
      <Tree x={186} s={1.15} />
      <Bush x={232} />
      <Barn x={268} />
      <Herd x={332} />
      <Pole x={420} />
      <Tree x={456} s={0.95} />
      <Bush x={494} />
      <Tree x={526} s={1.1} />
    </g>
  )
}

/**
 * `roadM` is read every frame, the same contract the cyclists' `cadence` uses,
 * so the scenery stays in step with whatever is driving the road without this
 * component knowing anything about the race.
 */
export function Scenery({ roadM }: { roadM: () => number }) {
  const reduced = useReducedMotion()
  const farRef = useRef<SVGGElement>(null)
  const midRef = useRef<SVGGElement>(null)

  useEffect(() => {
    if (reduced) return
    let raf = 0
    const step = () => {
      const m = roadM()
      // wrap on the tile width, so the transform never grows without bound
      const far = -((m * FAR_PX_PER_M) % FAR_W)
      const mid = -((m * MID_PX_PER_M) % MID_W)
      farRef.current?.setAttribute('transform', `translate(${far.toFixed(1)} 0)`)
      midRef.current?.setAttribute('transform', `translate(${mid.toFixed(1)} 0)`)
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [roadM, reduced])

  const copies = Array.from({ length: COPIES }, (_, i) => i)
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[4.2rem] overflow-hidden" style={{ height: 96 }} aria-hidden data-testid="scenery">
      <svg className="absolute bottom-0 left-0 h-12 w-full overflow-visible" viewBox={`0 0 ${FAR_W} 48`} preserveAspectRatio="xMinYMax slice">
        <g ref={farRef}>
          {copies.map((i) => (
            <FarTile key={i} x={i * FAR_W} />
          ))}
        </g>
      </svg>
      <svg className="absolute bottom-0 left-0 h-16 w-full overflow-visible" viewBox={`0 0 ${MID_W} 64`} preserveAspectRatio="xMinYMax slice">
        <g ref={midRef}>
          {copies.map((i) => (
            <MidTile key={i} x={i * MID_W} />
          ))}
        </g>
      </svg>
    </div>
  )
}
