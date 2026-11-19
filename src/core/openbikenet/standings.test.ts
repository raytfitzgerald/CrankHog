import { describe, expect, it } from 'vitest'
import type { ObnRemoteRider } from './session'
import { loopGapM, positionNow, standings } from './standings'

const rider = (id: string, distance: number, speed = 0, at = 0): ObnRemoteRider => ({
  id,
  app: 'openradlr',
  name: id,
  lap: 0,
  distance,
  speed,
  power: null,
  cadence: null,
  heartRate: null,
  at,
})

describe('loopGapM', () => {
  it('measures the short way round', () => {
    expect(loopGapM(10, 30, 250)).toBe(20)
    expect(loopGapM(30, 10, 250)).toBe(-20)
    expect(loopGapM(240, 5, 250)).toBe(15)
    expect(loopGapM(5, 240, 250)).toBe(-15)
    expect(loopGapM(0, 125, 250)).toBe(125)
    expect(loopGapM(0, 126, 250)).toBe(-124)
  })
})

describe('positionNow', () => {
  it('carries a rider on at their speed, around the loop', () => {
    expect(positionNow(rider('a', 240, 10, 0), 1500, 250, true)).toBeCloseTo(5)
  })

  it('stops guessing after 3 s without news', () => {
    expect(positionNow(rider('a', 100, 10, 0), 60_000, 250, true)).toBeCloseTo(130)
  })

  it('stops at the end of a route that is not a loop', () => {
    expect(positionNow(rider('a', 990, 10, 0), 3000, 1000, false)).toBe(1000)
  })
})

describe('standings', () => {
  it('lists the riders ahead first, with the gap to each', () => {
    const list = standings([rider('behind', 200), rider('ahead', 60), rider('level', 20)], 20, 0, 250, true)
    expect(list.map((s) => [s.rider.name, s.gapM])).toEqual([
      ['ahead', 40],
      ['level', 0],
      ['behind', -70],
    ])
  })

  it('orders by position around the track while just watching', () => {
    const list = standings([rider('b', 10), rider('a', 200)], null, 0, 250, true)
    expect(list.map((s) => [s.rider.name, s.gapM])).toEqual([
      ['a', null],
      ['b', null],
    ])
  })
})
