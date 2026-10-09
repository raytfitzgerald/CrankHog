// Sir Loin trotting along the verge behind the ride-along.
//
// He is scenery here, not an event: no line, no fuss. He walks the way you're
// going and you overtake him, which is the joke — he's on foot and he still
// turns up more often than you do. Timing comes from @core/mascot/hog on the
// verge cadence (more often than the road passes, because it costs nothing).

import { useEffect, useRef, useState } from 'react'
import { TROT_MS, VERGE_PASSES, startHogSchedule, stepHogSchedule, type HogPass } from '@core/mascot/hog'
import { useReducedMotion } from '../../ui/use-reduced-motion'
import { HogTrot } from './HogTrot'

// Mount this with key={rideId}, so each ride starts him over.
export function HogVerge({ elapsedS, moving }: { elapsedS: number; moving: boolean }) {
  const reduced = useReducedMotion()
  const schedule = useRef(startHogSchedule(Math.random, VERGE_PASSES))
  const [pass, setPass] = useState<HogPass | null>(null)

  useEffect(() => {
    if (!moving || reduced) return
    const next = stepHogSchedule(schedule.current, elapsedS)
    schedule.current = next.schedule
    if (next.pass) setPass(next.pass)
  }, [elapsedS, moving, reduced])

  useEffect(() => {
    if (!pass) return
    const id = setTimeout(() => setPass(null), TROT_MS)
    return () => clearTimeout(id)
  }, [pass])

  if (!pass || reduced) return null
  return (
    <div key={pass.id} className="pointer-events-none absolute bottom-[4.25rem] left-0 w-full animate-[hog-verge_9s_linear_1]" aria-hidden data-testid="hog-verge">
      <HogTrot height={34} label="Sir Loin, on foot" />
    </div>
  )
}
