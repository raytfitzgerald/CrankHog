import { describe, expect, it } from 'vitest'
import { panelViews, realMapAllowed, shownView } from './ride-views'

describe('ride panel views', () => {
  it('gives famous journeys the real map, and imported routes only when asked', () => {
    expect(realMapAllowed('famous', 'stelvio')).toBe(true)
    expect(realMapAllowed('famous', 'route:abc')).toBe(false)
    expect(realMapAllowed('all', 'route:abc')).toBe(true)
    expect(realMapAllowed('off', 'stelvio')).toBe(false)
  })

  it('offers the coach’s road, then the map, then 3D when the real map is on', () => {
    expect(panelViews({ rideAlong: true, journey: true, tiles: true })).toEqual(['road', 'map', '3d'])
    expect(panelViews({ rideAlong: true, journey: true, tiles: false })).toEqual(['road', 'map'])
    expect(panelViews({ rideAlong: false, journey: true, tiles: true })).toEqual(['map', '3d'])
    // no journey: just the ride-along, or nothing at all
    expect(panelViews({ rideAlong: true, journey: false, tiles: true })).toEqual(['road'])
    expect(panelViews({ rideAlong: false, journey: false, tiles: false })).toEqual([])
  })

  it('shows the choice when it can, else the nearest thing', () => {
    expect(shownView('3d', ['road', 'map', '3d'])).toBe('3d')
    expect(shownView('road', ['road', 'map', '3d'])).toBe('road')
    // 3D with the real map off is the flat map; with no journey it's the coach's road
    expect(shownView('3d', ['road', 'map'])).toBe('map')
    expect(shownView('3d', ['road'])).toBe('road')
    // the ride-along turned off in Settings: the map, in 3D when there is one
    expect(shownView('road', ['map', '3d'])).toBe('3d')
    expect(shownView('road', ['map'])).toBe('map')
    expect(shownView('map', [])).toBeNull()
  })
})
