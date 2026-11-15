import { describe, expect, it } from 'vitest'
import { DEFAULT_BIKE, steadySpeedForPower } from '../physics/bike'
import { FlatRoadLayer } from './flat-road'
import { IDLE_TICK, type PlanInput, type PlanTick } from './plan'

const input = (movingS: number, power: number | null): PlanInput => ({ now: movingS * 1000, movingS, dtS: 0.25, power, cadence: 90, hr: 140 })
function ride(layer: FlatRoadLayer, fromS: number, toS: number, power: number | null, base: PlanTick = IDLE_TICK): PlanTick[] {
  const ticks: PlanTick[] = []
  for (let k = Math.round(fromS * 4) + 1; k <= Math.round(toS * 4); k++) ticks.push(layer.tick(input(k / 4, power), base))
  return ticks
}

describe('FlatRoadLayer', () => {
  it('moves at the physics speed for the power on a flat road', () => {
    const last = ride(new FlatRoadLayer(), 0, 300, 200).at(-1)!
    expect(last.speed).toBeCloseTo(steadySpeedForPower(200, 0, DEFAULT_BIKE), 3)
    expect(last.speed! * 3.6).toBeCloseTo(33.3, 1)
    // a flat road it is, and not one to coast down: auto-pause works as it always has
    expect(last.freewheels).toBeUndefined()
    expect(last.grade).toBeUndefined()
  })

  it('uses the rider and bike it is given', () => {
    const light = ride(new FlatRoadLayer({ riderKg: 60, cda: 0.3 }), 0, 300, 200).at(-1)!
    expect(light.speed).toBeCloseTo(steadySpeedForPower(200, 0, { ...DEFAULT_BIKE, riderKg: 60, cda: 0.3 }), 3)
    expect(light.speed!).toBeGreaterThan(ride(new FlatRoadLayer(), 0, 300, 200).at(-1)!.speed!)
  })

  it('rolls to a stop on the flat with no power, rather than stopping dead', () => {
    const layer = new FlatRoadLayer()
    ride(layer, 0, 120, 250)
    const coasting = ride(layer, 120, 400, 0)
    expect(coasting[4]!.speed! * 3.6).toBeGreaterThan(30) // a second after the last stroke
    expect(coasting.at(-1)!.speed).toBe(0)
  })

  it('stands still while moving time does (a pause), and carries on from the same speed', () => {
    const layer = new FlatRoadLayer()
    const before = ride(layer, 0, 120, 200).at(-1)!.speed!
    const held = layer.tick(input(120, 0), IDLE_TICK)
    expect(held.speed).toBe(before)
    expect(ride(layer, 120, 121, 200).at(-1)!.speed).toBeCloseTo(before, 3)
  })

  it('leaves the tick alone without a power reading, so a bike with only a speed sensor keeps its wheel speed', () => {
    const layer = new FlatRoadLayer()
    const tick = layer.tick(input(1, null), IDLE_TICK)
    expect(tick).toBe(IDLE_TICK)
    expect('speed' in tick).toBe(false)
  })

  it('picks up where it was when the power comes back after a dropout', () => {
    const layer = new FlatRoadLayer()
    const before = ride(layer, 0, 120, 200).at(-1)!.speed!
    ride(layer, 120, 122, null)
    expect(ride(layer, 122, 122.25, 200).at(-1)!.speed).toBeCloseTo(before, 2)
  })

  it('passes a route straight through: it sets its own speed', () => {
    const route: PlanTick = { ...IDLE_TICK, speed: 4.2, freewheels: true }
    expect(new FlatRoadLayer().tick(input(1, 300), route)).toBe(route)
  })
})
