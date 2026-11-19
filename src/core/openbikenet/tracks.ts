// The shared tracks: OpenBikeNet's route catalogue (routes/*.json in
// github.com/OpenBikeNet/protocol, MIT), as CrankHog routes. A position on a
// shared route is a distance along it, so CrankHog has to ride exactly the
// published length and profile: these are built from the JSON, never from a
// GPX, and never smoothed into a different shape.
//
// A published route never changes (spec 4.2); a new one gets a new ID, and
// is added here.
import type { Route } from '../routes/model'
import { syntheticRoute, type SyntheticSegment } from '../routes/synthetic'

export interface SharedTrack {
  /** OpenBikeNet route ID. */
  obnId: string
  /** The CrankHog route ID: the network's, prefixed so it can't meet an imported route's. */
  routeId: string
  name: string
  /** m */
  lengthM: number
  loop: boolean
  /** [distance m, elevation m] points, as published. */
  profile: readonly (readonly [number, number])[]
  /** One line for the library. */
  blurb: string
}

const track = (obnId: string, name: string, lengthM: number, blurb: string): SharedTrack => ({
  obnId,
  routeId: `obn-${obnId}`,
  name,
  lengthM,
  loop: true,
  profile: [
    [0, 0],
    [lengthM, 0],
  ],
  blurb,
})

export const SHARED_TRACKS: readonly SharedTrack[] = [
  track('velodrome-250', 'Velodrome 250 m', 250, 'A flat 250 m indoor track: the one every app builds the same way.'),
  track('herne-hill-450', 'Herne Hill Velodrome', 450, 'The flat 450 m outdoor track in London, ridden anticlockwise.'),
  track('herne-hill-450-clockwise', 'Herne Hill Velodrome (clockwise)', 450, 'Herne Hill the other way round.'),
]

const byRouteId = new Map(SHARED_TRACKS.map((t) => [t.routeId, t]))
const byObnId = new Map(SHARED_TRACKS.map((t) => [t.obnId, t]))

/** The shared track behind a CrankHog route, or null for any other route. */
export function sharedTrackForRoute(routeId: string): SharedTrack | null {
  return byRouteId.get(routeId) ?? null
}

export function sharedTrack(obnId: string): SharedTrack | null {
  return byObnId.get(obnId) ?? null
}

/**
 * The track as a CrankHog route: a circle with the track's length as its
 * circumference (no real streets under it, so it stays off the FIT map like
 * the demo routes), climbing and descending as the profile says.
 */
export function sharedTrackRoute(t: SharedTrack): Route {
  const segments: SyntheticSegment[] = []
  for (let i = 1; i < t.profile.length; i++) {
    const [d0, e0] = t.profile[i - 1]!
    const [d1, e1] = t.profile[i]!
    const gradePct = ((e1 - e0) / (d1 - d0)) * 100
    segments.push(gradePct === 0 ? { kind: 'flat', lengthM: d1 - d0 } : { kind: 'climb', lengthM: d1 - d0, gradePct })
  }
  const route = syntheticRoute({
    id: t.routeId,
    name: t.name,
    shape: t.loop ? 'loop' : 'line',
    segments,
    startEleM: t.profile[0]![1],
    spacingM: 5,
  })
  // a velodrome is shorter than the shortest route CrankHog would guess is a loop
  return t.loop ? { ...route, loop: true } : route
}

export function sharedTrackRoutes(): Route[] {
  return SHARED_TRACKS.map(sharedTrackRoute)
}
