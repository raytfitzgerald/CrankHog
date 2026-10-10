// A distance board at the roadside, once a kilometre.
//
// It is the one piece of scenery carrying a real number: it counts the ride's
// own distance, in the rider's units, so passing one actually means something.
// It slides by at the fence's pace and then it's gone.
//
// Reduce Motion drops it, like the rest of the scenery.

import { useEffect, useState } from 'react'
import { distanceUnit } from '@core/units'
import { useRide } from '../../stores/ride'
import { useSettings } from '../../stores/settings'
import { useReducedMotion } from '../../ui/use-reduced-motion'

/** How long a board takes to cross, ms. Matches the fence's drift closely enough. */
const BOARD_MS = 5_600
const PER_UNIT_M = { km: 1000, mi: 1609.344 } as const

export function KmBoard() {
  const reduced = useReducedMotion()
  const units = useSettings((s) => s.units)
  const distanceM = useRide((s) => s.snapshot?.distanceM ?? 0)
  const unit = distanceUnit(units)
  const passed = Math.floor(distanceM / PER_UNIT_M[unit])
  const [showing, setShowing] = useState<number | null>(null)

  // a new whole kilometre (or mile) has gone by: put a board up for it
  const [last, setLast] = useState(passed)
  if (passed !== last) {
    setLast(passed)
    if (passed > 0 && passed > last) setShowing(passed)
  }

  useEffect(() => {
    if (showing === null) return
    const id = setTimeout(() => setShowing(null), BOARD_MS)
    return () => clearTimeout(id)
  }, [showing])

  if (showing === null || reduced) return null
  return (
    <div
      key={showing}
      className="pointer-events-none absolute bottom-[4.6rem] left-0 animate-[hog-verge_5.6s_linear_1]"
      aria-hidden
      data-testid="km-board"
      data-km={showing}
    >
      <div className="flex flex-col items-center">
        <div className="rounded-sm border border-line-strong bg-panel-2 px-1.5 py-0.5 shadow-sm">
          <span className="tabular font-display text-[11px] font-semibold leading-none text-ink-dim">
            {showing} {unit}
          </span>
        </div>
        <div className="h-3 w-0.5 bg-line-strong" />
      </div>
    </div>
  )
}
