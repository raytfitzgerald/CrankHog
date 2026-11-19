// The mini map's geometry: which stretch of road to show, thinned to a few
// hundred points, projected onto a box (equirectangular, scaled by the
// latitude, which is plenty at this size). No tiles, no network.
import type { RoutePoint } from '../routes/model'

export interface MapFrame {
  /** Projects lat/lon to x/y inside the box (y down). */
  project(lat: number, lon: number): [number, number]
  /** Back from x/y to lat/lon. */
  unproject(x: number, y: number): [number, number]
  /** Ground metres per pixel, for the scale bar and the grid. */
  metersPerPx: number
  /** The road from fromM to toM as an SVG points list. */
  path(fromM: number, toM: number): string
}

/** Metres in a degree of latitude. */
const M_PER_DEG = 111_195

/** A round ground distance (1, 2 or 5 × 10ⁿ m) close to `targetPx` pixels at this scale. */
export function niceStepM(metersPerPx: number, targetPx: number): number {
  const raw = metersPerPx * targetPx
  const p = 10 ** Math.floor(Math.log10(raw))
  const f = raw / p
  return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p
}

/**
 * Grid lines every `stepM` metres, anchored to the ground (lat/lon multiples),
 * so the grid slides with the map as the dot moves, like a real map's.
 */
export function gridLines(frame: MapFrame, width: number, height: number, stepM: number): { xs: number[]; ys: number[] } {
  const [latTop, lonLeft] = frame.unproject(0, 0)
  const [latBottom, lonRight] = frame.unproject(width, height)
  const dLat = stepM / M_PER_DEG
  const dLon = dLat / Math.max(0.05, Math.cos(((latTop + latBottom) / 2) * (Math.PI / 180)))
  const xs: number[] = []
  const ys: number[] = []
  for (let lon = Math.ceil(lonLeft / dLon) * dLon; lon <= lonRight && xs.length < 200; lon += dLon) xs.push(frame.project(latTop, lon)[0])
  for (let lat = Math.ceil(latBottom / dLat) * dLat; lat <= latTop && ys.length < 200; lat += dLat) ys.push(frame.project(lat, lonLeft)[1])
  return { xs, ys }
}

/** Index of the last point at or before `distM` (binary search). */
function indexAt(points: readonly RoutePoint[], distM: number): number {
  let lo = 0
  let hi = points.length - 1
  if (distM <= points[0]!.distM) return 0
  if (distM >= points[hi]!.distM) return hi
  while (hi - lo > 1) {
    const mid = (lo + hi) >>> 1
    if (points[mid]!.distM <= distM) lo = mid
    else hi = mid
  }
  return lo
}

/** The points between two distances, at most `max` of them (evenly thinned, ends kept). */
export function pointsBetween(points: readonly RoutePoint[], fromM: number, toM: number, max = 400): RoutePoint[] {
  if (points.length === 0) return []
  const a = indexAt(points, Math.min(fromM, toM))
  const b = Math.min(points.length - 1, indexAt(points, Math.max(fromM, toM)) + 1)
  const n = b - a + 1
  if (n <= max) return points.slice(a, b + 1)
  const out: RoutePoint[] = []
  for (let k = 0; k < max; k++) out.push(points[a + Math.round((k * (n - 1)) / (max - 1))]!)
  return out
}

/**
 * A frame that fits the road between `fromM` and `toM` into a width×height box
 * with `pad` around it, keeping the map's aspect (north up).
 */
export function mapFrame(points: readonly RoutePoint[], fromM: number, toM: number, width: number, height: number, pad = 12): MapFrame {
  const shown = pointsBetween(points, fromM, toM)
  let minLat = Infinity
  let maxLat = -Infinity
  let minLon = Infinity
  let maxLon = -Infinity
  for (const p of shown) {
    minLat = Math.min(minLat, p.lat)
    maxLat = Math.max(maxLat, p.lat)
    minLon = Math.min(minLon, p.lon)
    maxLon = Math.max(maxLon, p.lon)
  }
  if (!Number.isFinite(minLat)) minLat = maxLat = minLon = maxLon = 0
  const k = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180)
  // at least ~200 m across, so a ride that hasn't moved isn't a zoom into one pixel
  const spanX = Math.max((maxLon - minLon) * k, 0.002)
  const spanY = Math.max(maxLat - minLat, 0.002)
  const scale = Math.min((width - pad * 2) / spanX, (height - pad * 2) / spanY)
  const cx = (minLon + maxLon) / 2
  const cy = (minLat + maxLat) / 2
  const project = (lat: number, lon: number): [number, number] => [width / 2 + (lon - cx) * k * scale, height / 2 - (lat - cy) * scale]
  const unproject = (x: number, y: number): [number, number] => [cy - (y - height / 2) / scale, cx + (x - width / 2) / (k * scale)]
  const path = (a: number, b: number) =>
    pointsBetween(points, a, b)
      .map((p) => project(p.lat, p.lon).map((v) => v.toFixed(1)).join(','))
      .join(' ')
  return { project, unproject, metersPerPx: M_PER_DEG / scale, path }
}

// ---- the tiled map (MapLibre) ----

export type MapZoom = 'today' | 'journey'

/**
 * The stretch of road a map shows: the whole course, or for today a little
 * behind the dot and more ahead, moved on every 500 m so the frame doesn't swim.
 */
export function mapWindow(zoom: MapZoom, positionM: number, lengthM: number): [number, number] {
  if (zoom === 'journey') return [0, lengthM]
  const anchor = Math.floor(Math.max(0, positionM) / 500) * 500
  return [Math.max(0, anchor - 2_000), Math.min(lengthM, anchor + 8_000)]
}

/** [lon, lat], the order GeoJSON and MapLibre use. */
export type LonLat = [number, number]

/** The point `distM` along the road, between its vertices. */
export function pointAt(points: readonly RoutePoint[], distM: number): LonLat {
  const i = indexAt(points, distM)
  const a = points[i]!
  const b = points[i + 1]
  if (!b || b.distM <= a.distM) return [a.lon, a.lat]
  const t = Math.min(1, Math.max(0, (distM - a.distM) / (b.distM - a.distM)))
  return [a.lon + (b.lon - a.lon) * t, a.lat + (b.lat - a.lat) * t]
}

/**
 * The road from `fromM` to `toM` as [lon, lat] pairs, starting and ending
 * exactly there (so a trail stops at the dot, not at the next vertex), with at
 * most `max` vertices in between.
 */
export function lineBetween(points: readonly RoutePoint[], fromM: number, toM: number, max = 20_000): LonLat[] {
  if (points.length === 0) return []
  const a = Math.min(fromM, toM)
  const b = Math.max(fromM, toM)
  const inside = pointsBetween(points, a, b, max).filter((p) => p.distM > a && p.distM < b)
  return [pointAt(points, a), ...inside.map((p): LonLat => [p.lon, p.lat]), pointAt(points, b)]
}

/** The compass bearing (degrees, 0 = north, clockwise) from the road at `atM` to the road `aheadM` further on (negative looks back). */
export function headingAt(points: readonly RoutePoint[], atM: number, aheadM: number): number {
  if (points.length < 2) return 0
  const last = points[points.length - 1]!.distM
  const from = pointAt(points, Math.min(last, Math.max(0, atM)))
  const to = pointAt(points, Math.min(last, Math.max(0, atM + aheadM)))
  const k = Math.cos((from[1] * Math.PI) / 180)
  const dx = (to[0] - from[0]) * k
  const dy = to[1] - from[1]
  if (dx === 0 && dy === 0) return 0
  return ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360
}

/** The box around some points: [[west, south], [east, north]]. */
export function boundsOf(coords: readonly LonLat[]): [LonLat, LonLat] {
  let w = Infinity
  let s = Infinity
  let e = -Infinity
  let n = -Infinity
  for (const [lon, lat] of coords) {
    w = Math.min(w, lon)
    e = Math.max(e, lon)
    s = Math.min(s, lat)
    n = Math.max(n, lat)
  }
  if (!Number.isFinite(w)) return [
    [0, 0],
    [0, 0],
  ]
  return [
    [w, s],
    [e, n],
  ]
}
