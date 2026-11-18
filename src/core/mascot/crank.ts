// Cranking the hog: the one secret in CrankHog.
//
// Click Sir Loin as he laps the Home velodrome and he goes faster. Keep at it
// and he winds up until he is a blur round the boards, and then the two
// wolves come out (`TwoWolves`). Stop clicking and he winds back down to his
// usual pace, so a click or two out of curiosity only shows there is
// something there.
//
// Once he is wound up he is too quick to hit, so a click anywhere on the
// track keeps cranking him; it's only the first one that has to land on him.

/** Each click winds him up by one. At this many he's gone. */
export const CRANK_FIRES_AT = 8
/** How fast he winds back down when you stop, per second. */
export const CRANK_DECAY_PER_S = 1.2
/** How long he's a blur on the boards before the curtain comes down. */
export const CRANK_BLUR_MS = 1_100

/** What the picture says, for screen readers: its two captions go up one at a time, then the punchline lands with the rest. */
export const TWO_WOLVES = {
  setup: ['Inside you there are two wolves.', 'Both of them want you to'],
  picture: 'Inside you there are two wolves. Both of them want you to crank your hog.',
} as const
/** When each caption goes up, then the punchline slams down, ms after the curtain starts coming down. */
export const WOLF_BEATS_MS = [500, 2_300, 4_200] as const
/** Once the punchline has landed, the rest of the picture comes up slowly behind it: it starts this long after the slam, */
export const WOLVES_REST_DELAY_MS = 900
/** and takes this long. Until it's all up, a click doesn't close it. */
export const WOLVES_REST_MS = 2_800

/**
 * Cranking him is a run of quick clicks, and the run doesn't stop the moment
 * the curtain comes down. On the wolves a click only counts once the clicking
 * has stopped: this long after the one before it, with the curtain coming down
 * counted as one. It's slower than anyone can click and still wind him up
 * (see the test), so the run that set it off can never skip the setup or
 * close the picture.
 */
export const WOLVES_CALM_MS = 900

export interface Crank {
  /** How wound up he was at `atMs`. */
  level: number
  /** When that was, on the caller's clock. */
  atMs: number
}

export const CRANK_IDLE: Crank = { level: 0, atMs: 0 }

/** How wound up he is now: each click adds one, and it bleeds away while nobody clicks. */
export function crankLevel(c: Crank, nowMs: number): number {
  return Math.max(0, c.level - (Math.max(0, nowMs - c.atMs) / 1000) * CRANK_DECAY_PER_S)
}

/** One click. `fired` on the click that winds him all the way; he winds down from there like any other time. */
export function crankHog(c: Crank, nowMs: number): { crank: Crank; fired: boolean } {
  const level = crankLevel(c, nowMs) + 1
  if (level >= CRANK_FIRES_AT) return { crank: { level: CRANK_FIRES_AT, atMs: nowMs }, fired: true }
  return { crank: { level, atMs: nowMs }, fired: false }
}

/** How many times his usual pace he laps at, wound up this far. One click is plain to see; all of them is a blur. */
export function crankSpeed(level: number): number {
  const l = Math.max(0, level)
  return 1 + 0.5 * l + 0.3 * l * l
}
