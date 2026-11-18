import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import { useReducedMotion } from '../../ui/use-reduced-motion'
import { CX1, CX2, CY, lanePoint, oval, type TrackRider } from './track'

// The velodrome from above (the brand mark's own geometry and colours), with
// one rider on the boards for every ride this week (with the rider's own
// face, if they added one). Harder rides lap faster. The coach stands in the
// infield with a megaphone. With nothing ridden yet, a dashed ghost waits on
// the line.
//
// Sir Loin is up on the stayers' line whatever the rider did this week. On a
// week with no rides he has the whole track to himself, which is the point.
// He can also be cranked (`@core/mascot/crank`): `hogSpeed` says how many
// times his usual pace he's lapping at, and `onCrank` hears every click on the
// track, and whether it landed on him.

const LANES = [128, 150, 172]

export function Velodrome({
  riders,
  hog,
  head,
  coach,
  hogSpeed,
  onCrank,
  className,
}: {
  riders: readonly TrackRider[]
  hog?: TrackRider
  head: ReactNode
  coach?: ReactNode
  /** Read every frame, on the `performance.now()` clock. */
  hogSpeed?: (nowMs: number) => number
  onCrank?: (onHog: boolean) => void
  className?: string
}) {
  const reduced = useReducedMotion()
  const ref = useRef<SVGSVGElement>(null)
  const onTrack = useMemo(() => (hog ? [...riders, hog] : [...riders]), [riders, hog])
  // read through a ref, so a new function from the parent doesn't restart the animation
  const speed = useRef(hogSpeed)
  useEffect(() => {
    speed.current = hogSpeed
  }, [hogSpeed])
  // how far round each rider is, by id: added up frame by frame, so Sir Loin
  // can speed up without jumping, and kept across renders, so nobody is put
  // back on the line when the page around the track changes
  const laps = useRef(new Map<string, number>())
  const hogId = hog?.id

  useEffect(() => {
    const svg = ref.current
    if (!svg) return
    const els = [...svg.querySelectorAll<SVGGElement>('[data-rider]')]
    // spread the pack out, then let each ride lap at its own pace
    onTrack.forEach((r, i) => laps.current.has(r.id) || laps.current.set(r.id, i / Math.max(1, onTrack.length)))
    const place = () =>
      els.forEach((el, i) => {
        const rider = onTrack[i]
        if (!rider) return
        const p = lanePoint(laps.current.get(rider.id) ?? 0, rider.lane ?? LANES[i % LANES.length]!)
        el.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`)
      })
    place()
    if (reduced) return
    let raf = 0
    let last: number | null = null
    const step = (now: number) => {
      const dt = last === null ? 0 : (now - last) / 1000
      last = now
      for (const rider of onTrack) {
        const x = rider.id === hogId ? (speed.current?.(now) ?? 1) : 1
        laps.current.set(rider.id, ((laps.current.get(rider.id) ?? 0) + (dt * x) / rider.lapS) % 1)
      }
      place()
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [onTrack, hogId, reduced])

  const start = lanePoint(0, 150)
  return (
    <svg
      ref={ref}
      viewBox="154 282 716 460"
      className={className}
      onClick={onCrank ? (e) => onCrank(e.target instanceof Element && e.target.closest('[data-hog]') !== null) : undefined}
      // no text selected by a run of clicks on the track
      onMouseDown={onCrank ? (e) => e.detail > 1 && e.preventDefault() : undefined}
      role="img"
      aria-label={
        riders.length === 0
          ? `The velodrome, with nobody on it but ${hog?.label ?? 'the hog'}`
          : `The velodrome, with ${riders.length} rider${riders.length === 1 ? '' : 's'}`
      }
    >
      <path d={`M${CX1} 413 L${CX2} 413 A99 99 0 0 1 ${CX2} 611 L${CX1} 611 A99 99 0 0 1 ${CX1} 413 Z`} fill="var(--color-stayer)" />
      {/* a hairline round the outside of the boards, so they still read on the light theme's pale ground */}
      <path d={oval(203)} fill="none" stroke="var(--color-line-strong)" strokeWidth={3} />
      <path d={oval(150)} fill="none" stroke="var(--color-board)" strokeWidth={104} />
      <path d={oval(114)} fill="none" stroke="var(--color-azure)" strokeWidth={20} />
      <path d={oval(136)} fill="none" stroke="var(--color-night)" strokeWidth={6} />
      <path d={oval(156)} fill="none" stroke="var(--color-sprinter)" strokeWidth={9} />
      <path d={oval(182)} fill="none" stroke="var(--color-stayer)" strokeWidth={9} />
      {/* the finish line across the home straight */}
      <line x1={512} y1={CY - 204} x2={512} y2={CY - 96} stroke="var(--color-night)" strokeWidth={5} />
      {coach && (
        <g transform={`translate(${(CX1 + CX2) / 2} ${CY})`} data-testid="velodrome-coach">
          {/* the megaphone, pointed at the track */}
          <path d="M40 -8 L78 -30 L78 18 L40 4 Z" fill="var(--color-board)" stroke="var(--color-night)" strokeWidth={4} strokeLinejoin="round" />
          <path d="M88 -26 Q98 -6 88 14 M100 -34 Q114 -6 100 22" fill="none" stroke="var(--color-board)" strokeWidth={5} strokeLinecap="round" />
          <circle r={50} fill="var(--color-board)" stroke="var(--color-night)" strokeWidth={4} />
          <g transform="scale(3.8)">{coach}</g>
        </g>
      )}
      {/* nothing ridden yet: a dashed ghost waits in your place on the line */}
      {riders.length === 0 && (
        <g transform={`translate(${start.x + 90} ${start.y})`} data-testid="velodrome-ghost">
          <circle r={22} fill="none" stroke="var(--color-night)" strokeWidth={5} strokeDasharray="8 7" opacity={0.6} />
        </g>
      )}
      {onTrack.map((r) => (
        <g key={r.id} data-rider data-hog={r.id === hog?.id || undefined} data-testid={r.id === hog?.id ? 'velodrome-hog' : 'velodrome-rider'}>
          <title>{r.label}</title>
          <circle r={26 * (r.scale ?? 1)} fill="var(--color-board)" stroke="var(--color-night)" strokeWidth={4} />
          <g transform={`scale(${1.8 * (r.scale ?? 1)})`}>{r.head ?? head}</g>
        </g>
      ))}
    </svg>
  )
}
