import { describe, expect, it } from 'vitest'
import type { RoutePoint } from '../routes/model'
import { boundsOf, gridLines, headingAt, lineBetween, mapFrame, mapWindow, niceStepM, pointAt, pointsBetween } from './map'

// 10 km due east along the equator, a point every 10 m
const road: RoutePoint[] = Array.from({ length: 1001 }, (_, i) => ({ lat: 0, lon: (i * 10) / 111_320, ele: 0, distM: i * 10 }))

describe('journey mini map', () => {
  it('thins a long stretch but keeps its ends', () => {
    const pts = pointsBetween(road, 0, 10_000, 50)
    expect(pts).toHaveLength(50)
    expect(pts[0]!.distM).toBe(0)
    expect(pts.at(-1)!.distM).toBe(10_000)
  })

  it('fits the stretch into the box, north up and west on the left', () => {
    const f = mapFrame(road, 0, 10_000, 300, 120)
    const [x0, y0] = f.project(0, 0)
    const [x1, y1] = f.project(0, 10_000 / 111_320)
    expect(x0).toBeCloseTo(12, 0)
    expect(x1).toBeCloseTo(288, 0)
    expect(y0).toBeCloseTo(60, 5)
    expect(y1).toBeCloseTo(60, 5)
    const [, yn] = f.project(0.01, 0)
    expect(yn).toBeLessThan(60)
  })

  it('draws only the part asked for', () => {
    const f = mapFrame(road, 0, 10_000, 300, 120)
    const xs = f.path(2_000, 3_000).split(' ').map((p) => Number(p.split(',')[0]))
    expect(Math.min(...xs)).toBeGreaterThan(60)
    expect(Math.max(...xs)).toBeLessThan(110)
  })

  it('knows its scale and can go back from pixels to the ground', () => {
    const f = mapFrame(road, 0, 10_000, 300, 120)
    // 10 km across 276 px
    expect(f.metersPerPx).toBeCloseTo(10_000 / 276, 0)
    const [lat, lon] = f.unproject(...f.project(0.001, 0.05))
    expect(lat).toBeCloseTo(0.001, 9)
    expect(lon).toBeCloseTo(0.05, 9)
  })

  it('picks a round scale-bar length and a ground-anchored grid', () => {
    expect(niceStepM(36, 80)).toBe(2000)
    expect(niceStepM(3.6, 80)).toBe(200)
    expect(niceStepM(500, 80)).toBe(50_000)
    const f = mapFrame(road, 0, 10_000, 300, 120)
    const { xs } = gridLines(f, 300, 120, 2000)
    // every 2 km along a 10 km road that starts at lon 0: 0, 2, 4, 6, 8, 10 km
    expect(xs).toHaveLength(6)
    expect(xs[1]! - xs[0]!).toBeCloseTo(2000 / f.metersPerPx, 0)
  })

  it('frames today around the dot in 500 m steps, and the whole road for the journey', () => {
    expect(mapWindow('journey', 3_000, 10_000)).toEqual([0, 10_000])
    expect(mapWindow('today', 3_499, 10_000)).toEqual([1_000, 10_000])
    expect(mapWindow('today', 3_500, 50_000)).toEqual([1_500, 11_500])
    expect(mapWindow('today', 100, 50_000)).toEqual([0, 8_000])
  })

  it('cuts a line that starts and stops exactly where asked', () => {
    // vertices only every 1 km, so a trail cut at a vertex would overshoot the dot
    const sparse = road.filter((p) => p.distM % 1_000 === 0)
    const line = lineBetween(sparse, 1_250, 3_600)
    expect(line[0]![0]).toBeCloseTo(1_250 / 111_320, 9)
    expect(line.at(-1)![0]).toBeCloseTo(3_600 / 111_320, 9)
    // 2 and 3 km are inside, 1 and 4 km are not
    expect(line).toHaveLength(4)
    expect(pointAt(sparse, 99_999)[0]).toBeCloseTo(10_000 / 111_320, 9)
  })

  it('knows which way the road goes, for the 3D camera', () => {
    // due east
    expect(headingAt(road, 2_000, 500)).toBeCloseTo(90, 3)
    // looking back west, and past the end it uses what is left
    expect(headingAt(road, 2_000, -500)).toBeCloseTo(270, 3)
    expect(headingAt(road, 9_900, 500)).toBeCloseTo(90, 3)
    const north: typeof road = road.map((p) => ({ ...p, lat: p.lon, lon: 0 }))
    expect(headingAt(north, 100, 200)).toBeCloseTo(0, 3)
  })

  it('boxes the points it is given', () => {
    expect(
      boundsOf([
        [1, 2],
        [-1, 5],
        [3, -4],
      ]),
    ).toEqual([
      [-1, -4],
      [3, 5],
    ])
  })
})
