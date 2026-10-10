// Where Sir Loin is, in words, over the road ahead.
//
// A readout rather than a tile on purpose: the numbers grid is the product
// (docs/BRAND.md), and a pig is not allowed to compete with a power figure.
// The arrow has a word beside it, so the direction is never colour alone.

import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, Minus } from 'lucide-react'
import { hogGapLabel, hogMood } from '@core/mascot/race'
import { useFtp } from '../../db/use-athlete'
import { useSettings } from '../../stores/settings'
import { cn } from '../../ui/cn'
import { advanceHogRace } from './useHogRace'

const MOOD = {
  'hog-ahead': { Icon: ChevronUp, tone: 'text-warn' },
  'you-ahead': { Icon: ChevronDown, tone: 'text-good' },
  together: { Icon: Minus, tone: 'text-ink-faint' },
} as const

export function HogRaceReadout({ className }: { className?: string }) {
  const units = useSettings((s) => s.units)
  const { ftpW } = useFtp()
  const [gapM, setGapM] = useState(() => advanceHogRace(performance.now(), ftpW).gapM)

  useEffect(() => {
    // twice a second: the gap is a mood, not a measurement
    const id = setInterval(() => setGapM(advanceHogRace(performance.now(), ftpW).gapM), 500)
    return () => clearInterval(id)
  }, [ftpW])

  const mood = hogMood(gapM)
  const { Icon, tone } = MOOD[mood]
  return (
    <span className={cn('flex items-center gap-1.5 text-xs text-ink-dim', className)} data-testid="hog-race" data-mood={mood} aria-live="off">
      <Icon className={cn('size-3.5', tone)} aria-hidden />
      {hogGapLabel(gapM, units)}
    </span>
  )
}
