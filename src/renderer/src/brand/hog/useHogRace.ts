// The race against Sir Loin, for whichever ride screen is on.
//
// One race for the whole app, like the coach ride-along's, so switching views
// or folding a panel doesn't reset who's ahead. It's advanced by whoever is on
// screen and started over for every new ride.
//
// It only moves while the rider is actually riding: paused, or stopped with no
// power, it holds. Missing is not zero, so a trainer dropout isn't a defeat.

import { HOG_RACE_START, stepHogRace, type HogRaceState } from '@core/mascot/race'
import { liveStore } from '../../stores/live'
import { rideStore } from '../../stores/ride'

const race = { state: HOG_RACE_START, rideId: null as string | null, last: 0 }

/** Moves the race to `now` (a performance.now() reading) and hands back where it is. */
export function advanceHogRace(now: number, ftpW: number): HogRaceState {
  const ride = rideStore.getState()
  if (ride.rideId !== race.rideId) {
    race.rideId = ride.rideId
    race.state = HOG_RACE_START
    race.last = 0
  }
  const dt = race.last === 0 ? 0 : (now - race.last) / 1000
  race.last = now
  const live = liveStore.getState()
  const paused = ride.snapshot?.state === 'paused'
  if (paused || (!ride.active && !(live.power3s ?? live.power))) return race.state
  race.state = stepHogRace(race.state, dt, { watts: live.power3s ?? live.power, kmh: live.speedKmh }, ftpW)
  return race.state
}

/** Where the race is, without moving it. */
export function hogRaceState(): HogRaceState {
  return race.state
}
