// Sir Loin: the hog. He is the only thing in CrankHog that is faster than the
// rider, and the only one who doesn't have to explain himself. He laps the
// Home velodrome, he takes over the track entirely on a week with no rides,
// and he passes you at random on a route.
//
// His lines are his own, not a coach's: dry, posh and completely unbothered.
// He never comments on a body, a weight or a number the rider can't change,
// and he is clean at every language setting, because he isn't a persona and
// doesn't go through the content gate.

export const HOG = {
  id: 'sir-loin',
  name: 'Sir Loin',
  /** For alt text and titles: "Sir Loin, a hog on a bike". */
  what: 'a hog on a bike',
} as const

/** What he says as he goes past on a route. */
export const FLYBY_QUIPS: readonly string[] = [
  'Sir Loin went past. He did not appear to be trying.',
  'That was Sir Loin. He has no FTP. He has never been tested.',
  'Sir Loin passed on the left. Sir Loin always passes on the left.',
  'Sir Loin does not acknowledge your W/kg.',
  'Sir Loin went by at 54 km/h. He is a pig.',
  'Sir Loin has gone. He left no watts behind.',
  'A hog just dropped you. Take from that what you need.',
  'Sir Loin waved. He has trotters, so it was more of a gesture.',
  'Sir Loin is not on Strava. Sir Loin has nothing to prove.',
  'Sir Loin took that gradient personally, and won.',
  'Sir Loin came through without changing gear. He has one.',
  'Sir Loin is gone. The road is yours again, such as it is.',
]

/** Tooltips for the rider circling the Home velodrome. */
export const TRACK_QUIPS: readonly string[] = [
  'Sir Loin, lapping the boards, as always',
  "Sir Loin, holding the stayers' line",
  'Sir Loin, who has not missed a week',
  'Sir Loin, pace pig',
  'Sir Loin, up on the banking',
  'Sir Loin, not here for your approval',
]

/** When he trots along the verge behind the ride-along. */
export const TROT_QUIPS: readonly string[] = [
  'Sir Loin trotted past the fence.',
  'Something went through the verge. It had tusks.',
  'Sir Loin is out for a walk. It is going well for him.',
]

/** Quiet corners: empty states and the loading screen. */
export const IDLE_QUIPS: readonly string[] = [
  'Sir Loin is waiting.',
  'Sir Loin has seen worse.',
  'Sir Loin is already warm.',
]

/** One line from a pool. */
export function hogLine(pool: readonly string[], rng: () => number = Math.random): string {
  return pool[Math.floor(rng() * pool.length) % pool.length]!
}

// --- Passing you on a route -------------------------------------------------

/** He leaves it a while before the first pass, so he isn't the first thing a ride does. */
export const FIRST_PASS_S = { min: 150, max: 330 } as const
/** And a good while between passes, so he stays a surprise. */
export const NEXT_PASS_S = { min: 240, max: 600 } as const
/** How long one pass takes to cross the screen. */
export const PASS_MS = 5_200

export interface PassRanges {
  first: { min: number; max: number }
  next: { min: number; max: number }
}

/** Coming past you on the road ahead: rare, and he says something each time. */
export const ROUTE_PASSES: PassRanges = { first: FIRST_PASS_S, next: NEXT_PASS_S }
/** Trotting along the verge behind the ride-along: often, and silent. He's scenery. */
export const VERGE_PASSES: PassRanges = { first: { min: 40, max: 110 }, next: { min: 90, max: 240 } }
/** How long the trot along the verge takes. He is walking, so it is slower. */
export const TROT_MS = 9_000

export interface HogPass {
  /** Rising, so React can key on it. */
  id: number
  quip: string
  /** Which side of the road he takes: it alternates, so two passes never overlay. */
  lane: 'near' | 'far'
}

export interface HogSchedule {
  /** Ride seconds at which the next pass is due. */
  nextAtS: number
  /** Passes so far this ride. */
  passes: number
  /** How often this one comes round; carried so step() doesn't need telling again. */
  ranges: PassRanges
}

const between = (r: { min: number; max: number }, rng: () => number): number => r.min + rng() * (r.max - r.min)

/** A fresh schedule for a ride that is just starting. */
export function startHogSchedule(rng: () => number = Math.random, ranges: PassRanges = ROUTE_PASSES): HogSchedule {
  return { nextAtS: between(ranges.first, rng), passes: 0, ranges }
}

/**
 * Moves the schedule to `elapsedS` of *moving* time. Returns a pass when one
 * has come due, and the schedule to hold onto either way. Only ever one pass
 * per call, so a long stall (a paused tab) doesn't send the whole herd
 * through at once.
 */
export function stepHogSchedule(s: HogSchedule, elapsedS: number, rng: () => number = Math.random): { schedule: HogSchedule; pass: HogPass | null } {
  if (elapsedS < s.nextAtS) return { schedule: s, pass: null }
  const passes = s.passes + 1
  return {
    schedule: { nextAtS: elapsedS + between(s.ranges.next, rng), passes, ranges: s.ranges },
    pass: { id: passes, quip: hogLine(FLYBY_QUIPS, rng), lane: passes % 2 === 1 ? 'far' : 'near' },
  }
}
