import { describe, expect, it } from 'vitest'
import { isLoopRoute } from '../ride/route-course'
import { ROUTE_ID } from './protocol'
import { SHARED_TRACKS, sharedTrack, sharedTrackForRoute, sharedTrackRoute, sharedTrackRoutes } from './tracks'

describe('shared tracks', () => {
  it('use valid, unique OpenBikeNet IDs and their own CrankHog route IDs', () => {
    const ids = SHARED_TRACKS.map((t) => t.obnId)
    expect(new Set(ids).size).toBe(ids.length)
    for (const t of SHARED_TRACKS) {
      expect(t.obnId).toMatch(ROUTE_ID)
      expect(t.routeId).toBe(`obn-${t.obnId}`)
      expect(sharedTrack(t.obnId)).toBe(t)
      expect(sharedTrackForRoute(t.routeId)).toBe(t)
    }
    expect(sharedTrackForRoute('demo-test-loop')).toBeNull()
    expect(sharedTrack('nowhere')).toBeNull()
  })

  it.each(SHARED_TRACKS.map((t) => [t.obnId, t] as const))('%s rides exactly its published length, flat, as a loop', (_, t) => {
    const route = sharedTrackRoute(t)
    expect(route.id).toBe(t.routeId)
    expect(route.name).toBe(t.name)
    expect(route.source).toBe('synthetic')
    expect(route.profile[0]!.distM).toBe(0)
    expect(route.profile[route.profile.length - 1]!.distM).toBeCloseTo(t.lengthM, 6)
    expect(route.distanceM).toBeCloseTo(t.lengthM, 6)
    expect(isLoopRoute(route)).toBe(true)
    for (const p of route.profile) expect(p.gradePct).toBe(0)
    expect(route.elevationGainM).toBe(0)
  })

  it('builds every track', () => {
    expect(sharedTrackRoutes().map((r) => r.id)).toEqual(SHARED_TRACKS.map((t) => t.routeId))
  })
})
