import { Activity, Dumbbell, Footprints, Waves, type LucideIcon } from 'lucide-react'
import type { OtherActivity } from '../../db/db'

/** The sport's icon: runs and walks, swims, strength, anything else. */
export function sportIcon(a: Pick<OtherActivity, 'sport' | 'subSport'>): LucideIcon {
  if (a.sport === 'running' || a.sport === 'walking' || a.sport === 'hiking') return Footprints
  if (a.sport === 'swimming') return Waves
  if (a.sport === 'training' || a.subSport === 'strength_training') return Dumbbell
  return Activity
}

export { sportLabel } from '@core/fit/sport'
