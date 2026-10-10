// Sir Loin turning up on the road ahead.
//
// Every few minutes of *moving* time he does something, and what he does reads
// the road and the race: he grinds up a wall, tucks down a descent, applauds a
// hard effort, and when he is a long way up the road he stops and waits where
// you can see him. The choosing is in @core/mascot/stunts; this only draws it.
//
// Stunts on a bike come past you, left to right. Roadside ones are things you
// ride past, so they drift the other way.
//
// With Reduce Motion on nothing animates — the line still arrives, as a status
// message, because that's the part with the joke in it.

import { useEffect, useRef, useState } from 'react'
import { startHogSchedule, stepHogSchedule } from '@core/mascot/hog'
import { STUNTS, pickStunt, stuntLine, type HogContext, type HogStunt } from '@core/mascot/stunts'
import { useReducedMotion } from '../../ui/use-reduced-motion'
import { HogRider } from './HogRider'

// The strip keeps a band clear under the chart (pb-8) so he never lands on the
// axis labels. The near lane is lower and larger; the far lane sits back.
const LANES = { near: { bottom: 16, height: 64 }, far: { bottom: 38, height: 46 } }
/** Roadside stunts stand on the band itself. */
const ROADSIDE_BOTTOM = 14

interface Appearance {
  id: number
  stunt: HogStunt
  line: string
  lane: 'near' | 'far'
}

// Mount this with key={rideId}: every ride then starts him over, instead of
// inheriting the last one's clock.
export function HogFlyby({ elapsedS, moving, context }: { elapsedS: number; moving: boolean; context: HogContext }) {
  const reduced = useReducedMotion()
  const schedule = useRef(startHogSchedule())
  // Read in the effect, never rendered from: the stunt is chosen on the tick
  // the pass comes due, from the road as it is then, and must not change under
  // him afterwards. Written in its own effect so render stays pure.
  const latest = useRef(context)
  useEffect(() => {
    latest.current = context
  })
  const [now, setNow] = useState<Appearance | null>(null)

  useEffect(() => {
    if (!moving) return
    const next = stepHogSchedule(schedule.current, elapsedS)
    schedule.current = next.schedule
    if (!next.pass) return
    const stunt = pickStunt(latest.current)
    setNow({ id: next.pass.id, stunt, line: stuntLine(stunt), lane: next.pass.lane })
  }, [elapsedS, moving])

  useEffect(() => {
    if (!now) return
    const id = setTimeout(() => setNow(null), STUNTS[now.stunt].ms)
    return () => clearTimeout(id)
  }, [now])

  if (!now) return null
  const spec = STUNTS[now.stunt]
  const passing = spec.kind === 'passing'
  const lane = passing ? LANES[now.lane] : LANES.far
  const seconds = spec.ms / 1000

  return (
    <>
      {!reduced && (
        <div
          key={now.id}
          className="pointer-events-none absolute left-0 w-full will-change-transform"
          style={{
            bottom: passing ? lane.bottom : ROADSIDE_BOTTOM,
            animation: `${passing ? 'hog-pass' : 'hog-verge'} ${seconds}s linear 1`,
          }}
          aria-hidden
          data-testid="hog-flyby"
          data-stunt={now.stunt}
        >
          <HogRider stunt={now.stunt} height={passing ? lane.height : 58} label={now.line} />
        </div>
      )}
      <p className="pointer-events-none absolute inset-x-0 bottom-1 text-center text-xs text-ink-faint" role="status" data-testid="hog-flyby-line">
        {now.line}
      </p>
    </>
  )
}
