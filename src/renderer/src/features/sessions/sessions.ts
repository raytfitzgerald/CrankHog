// Run, swim and other sessions as the Workouts page, the builder and the
// calendar's picker show them.
import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import type { SessionSport, SessionWorkout } from '@core/multisport/model'
import { listSessionWorkouts } from '../../workouts/sessions-repo'

/** "runs", "swims", "other sessions". */
export const SESSIONS_NOUN: Record<SessionSport, string> = { run: 'runs', swim: 'swims', other: 'other sessions' }

/** Whether the builder builds this sport: runs and swims have steps; other sessions are a time and an effort. */
export const buildable = (sport: SessionSport): sport is 'run' | 'swim' => sport !== 'other'

/** The sessions of one sport (or all of them), searched by name, notes and steps. */
export function useSessions(sport: SessionSport | undefined, query: string): SessionWorkout[] | undefined {
  const sessions = useLiveQuery(() => listSessionWorkouts(), [])
  return useMemo(() => {
    const q = query.trim().toLowerCase()
    return sessions?.filter((w) => (!sport || w.sport === sport) && (!q || w.name.toLowerCase().includes(q) || (w.notes ?? '').toLowerCase().includes(q) || w.text.toLowerCase().includes(q)))
  }, [sessions, sport, query])
}
