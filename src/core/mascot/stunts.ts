// What Sir Loin is doing when he turns up.
//
// He isn't random scenery: what he does reads the road and the rider. On a
// wall he grinds up it in the big ring, or gives up and has lunch. On a
// descent he tucks. When you're going well he applauds; when you're soft
// pedalling he has a lie down. A long way up the road, he stops and waits,
// visibly, which is worse than being dropped.
//
// Two kinds of stunt:
//   passing   he's on the bike and comes past you, left to right;
//   roadside  he's stopped and you go past him, so he drifts right to left.
//
// Everything here is pure, so the choreography can be tested without a
// browser. The drawing is in src/renderer/src/brand/hog/.

export type HogStunt =
  // on the bike
  | 'cruise'
  | 'sprint'
  | 'wheelie'
  | 'draft'
  | 'tuck'
  | 'grind'
  // at the roadside
  | 'picnic'
  | 'nap'
  | 'sign'
  | 'cheer'
  | 'tumble'

export interface StuntSpec {
  kind: 'passing' | 'roadside'
  /** How long he's on screen, ms. */
  ms: number
  /** Pedalling speed while he's on the bike, rpm. Roadside stunts ignore it. */
  rpm: number
  lines: readonly string[]
}

export const STUNTS: Readonly<Record<HogStunt, StuntSpec>> = {
  cruise: {
    kind: 'passing',
    ms: 5_200,
    rpm: 96,
    lines: [
      'Sir Loin went past. He did not appear to be trying.',
      'Sir Loin is not drafting. Sir Loin drafts no one.',
      'Sir Loin came through without changing gear. He has one.',
      'Sir Loin does not acknowledge your W/kg.',
    ],
  },
  sprint: {
    kind: 'passing',
    ms: 3_200,
    rpm: 124,
    lines: [
      'Sir Loin got out of the saddle. For four seconds. It was enough.',
      'Sir Loin sprinted for a road sign, and took it.',
      'That was Sir Loin at 61 km/h. He is a pig.',
      'Sir Loin has gone. He left no watts behind.',
    ],
  },
  wheelie: {
    kind: 'passing',
    ms: 4_600,
    rpm: 88,
    lines: [
      'Sir Loin went by on one wheel. The other one was fine.',
      'Sir Loin pulled a wheelie on a six per cent gradient, and held it.',
      'Sir Loin has both trotters off the bars. This is not a stunt to him.',
    ],
  },
  draft: {
    kind: 'passing',
    ms: 6_400,
    rpm: 92,
    lines: [
      'Sir Loin sat on your wheel for a while, then got bored.',
      'Sir Loin took a turn on the front. You did not notice. He did.',
      'Sir Loin was behind you the whole time. He is not any more.',
    ],
  },
  tuck: {
    kind: 'passing',
    ms: 2_600,
    rpm: 0,
    lines: [
      'Sir Loin tucked and vanished down the hill.',
      'Sir Loin does not brake. Sir Loin negotiates.',
      'Sir Loin stopped pedalling and went faster. Take that up with physics.',
    ],
  },
  grind: {
    kind: 'passing',
    ms: 7_000,
    rpm: 54,
    lines: [
      'Sir Loin is grinding up this in the big ring, out of spite.',
      'Sir Loin stood up for the steep bit, then sat down, unbothered.',
      'Sir Loin is going up this slowly. He is still going up it faster.',
    ],
  },
  picnic: {
    kind: 'roadside',
    ms: 7_800,
    rpm: 0,
    lines: [
      'Sir Loin has stopped for lunch. He will still beat you.',
      'Sir Loin is having a sandwich on the verge. He waved.',
      'Sir Loin got here early enough to eat. Think about that.',
    ],
  },
  nap: {
    kind: 'roadside',
    ms: 8_600,
    rpm: 0,
    lines: [
      'Sir Loin is asleep on the verge. He has the time.',
      'Sir Loin arrived, had a look round, and went to sleep.',
      'Do not wake Sir Loin. He is between efforts.',
    ],
  },
  sign: {
    kind: 'roadside',
    ms: 7_400,
    rpm: 0,
    lines: [
      "Sir Loin's sign says ALLEZ. He is not sure who to.",
      'Sir Loin is holding a sign. It says WATTS, with a question mark.',
      'Sir Loin made a sign for this. It took him longer than the climb.',
    ],
  },
  cheer: {
    kind: 'roadside',
    ms: 6_800,
    rpm: 0,
    lines: [
      'Sir Loin is at the roadside, applauding. Sincerely, for once.',
      'Sir Loin rang a cowbell as you went by.',
      'Sir Loin nodded. From him, that is a standing ovation.',
    ],
  },
  tumble: {
    kind: 'roadside',
    ms: 6_000,
    rpm: 0,
    lines: [
      'Sir Loin went into the hedge. He meant to.',
      'Sir Loin is in a ditch. He will be up the road again by the next corner.',
      'Sir Loin has come off. He is already blaming the surface.',
    ],
  },
}

export const ALL_STUNTS = Object.keys(STUNTS) as readonly HogStunt[]

/** What the road and the rider are doing, when he decides what to do about it. */
export interface HogContext {
  /** The gradient now, %. Null when the ride isn't on a road. */
  gradePct: number | null
  /** How far through the route, 0-1. */
  progress: number
  /** The rider's power over their FTP. Null when there's no power. */
  intensity: number | null
  /** Where he is relative to the rider, m: positive is ahead. */
  gapM: number
}

/** Steeper than this is a wall; below the other is a descent worth tucking on. */
export const STEEP_PCT = 6
export const DESCENT_PCT = -4
/** Over FTP is "going well"; under this is soft pedalling. */
export const HARD_IF = 1.02
export const EASY_IF = 0.58
/** Past this gap he is visibly waiting, or visibly chasing. */
export const WAITING_M = 150

type Weighted = readonly (readonly [HogStunt, number])[]

/**
 * The odds for each stunt, given the road and the rider. One rule fires: they
 * are in order of how much they should override the others, so "he is miles up
 * the road" beats "this is steep", because him waiting is the better joke.
 */
export function stuntWeights(ctx: HogContext): Weighted {
  if (ctx.gapM > WAITING_M) return [['nap', 3], ['picnic', 3], ['sign', 2], ['cheer', 1]]
  if (ctx.gapM < -WAITING_M) return [['sprint', 4], ['grind', 2], ['draft', 2], ['tumble', 1]]
  if (ctx.progress >= 0.92) return [['cheer', 4], ['sign', 3], ['sprint', 2]]
  if (ctx.gradePct !== null && ctx.gradePct >= STEEP_PCT) return [['grind', 4], ['picnic', 2], ['cheer', 2], ['wheelie', 1]]
  if (ctx.gradePct !== null && ctx.gradePct <= DESCENT_PCT) return [['tuck', 4], ['sprint', 3], ['tumble', 1]]
  if (ctx.intensity !== null && ctx.intensity >= HARD_IF) return [['cheer', 3], ['draft', 3], ['sprint', 2], ['wheelie', 1]]
  if (ctx.intensity !== null && ctx.intensity <= EASY_IF) return [['nap', 3], ['sign', 3], ['picnic', 2], ['cruise', 1]]
  return [['cruise', 4], ['sprint', 3], ['wheelie', 2], ['draft', 2], ['sign', 1], ['tumble', 1]]
}

/** One stunt, by those odds. */
export function pickStunt(ctx: HogContext, rng: () => number = Math.random): HogStunt {
  const weights = stuntWeights(ctx)
  const total = weights.reduce((n, [, w]) => n + w, 0)
  let r = rng() * total
  for (const [stunt, w] of weights) {
    r -= w
    if (r < 0) return stunt
  }
  return weights[weights.length - 1]![0]
}

/** One of that stunt's lines. */
export function stuntLine(stunt: HogStunt, rng: () => number = Math.random): string {
  const lines = STUNTS[stunt].lines
  return lines[Math.floor(rng() * lines.length) % lines.length]!
}
