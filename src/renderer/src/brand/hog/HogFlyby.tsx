// Sir Loin coming past you on a route.
//
// Every few minutes of *moving* time he crosses the road ahead, left to right,
// faster than you, and says something about it. The timing lives in
// @core/mascot/hog so it can be tested without a browser; this only draws it.
//
// With Reduce Motion on he doesn't ride across — the line still arrives, as a
// polite status message, because that's the part with the joke in it.

import { useEffect, useRef, useState } from 'react'
import { PASS_MS, startHogSchedule, stepHogSchedule, type HogPass } from '@core/mascot/hog'
import { Cyclist } from '../../coach/ride-along/Cyclist'
import { useReducedMotion } from '../../ui/use-reduced-motion'
import { HogHead } from './HogHead'

/** He rides a bigger gear than you. */
const HOG_RPM = 102
const hogCadence = () => HOG_RPM
/** The near lane is lower and larger; the far lane sits back against the fence. */
const LANES = { near: { bottom: 2, height: 62 }, far: { bottom: 30, height: 44 } }

// Mount this with key={rideId}: every ride then starts him over, instead of
// inheriting the last one's clock.
export function HogFlyby({ elapsedS, moving }: { elapsedS: number; moving: boolean }) {
  const reduced = useReducedMotion()
  const schedule = useRef(startHogSchedule())
  const [pass, setPass] = useState<HogPass | null>(null)

  useEffect(() => {
    if (!moving) return
    const next = stepHogSchedule(schedule.current, elapsedS)
    schedule.current = next.schedule
    if (next.pass) setPass(next.pass)
  }, [elapsedS, moving])

  useEffect(() => {
    if (!pass) return
    const id = setTimeout(() => setPass(null), PASS_MS)
    return () => clearTimeout(id)
  }, [pass])

  if (!pass) return null
  const lane = LANES[pass.lane]

  return (
    <>
      {!reduced && (
        <div
          key={pass.id}
          className="pointer-events-none absolute left-0 w-full animate-[hog-pass_5.2s_linear_1]"
          style={{ bottom: lane.bottom }}
          aria-hidden
          data-testid="hog-flyby"
        >
          <Cyclist jersey="var(--color-hog)" cadence={hogCadence} height={lane.height} label={pass.quip} head={<HogHead />} />
        </div>
      )}
      <p className="pointer-events-none absolute inset-x-0 bottom-1 text-center text-xs text-ink-faint" role="status" data-testid="hog-flyby-line">
        {pass.quip}
      </p>
    </>
  )
}
