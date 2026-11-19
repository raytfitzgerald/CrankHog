import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Map as MapLibre, Marker, setWorkerUrl, type GeoJSONSource, type LngLatBoundsLike } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import type { JourneyCourse } from '@core/journeys/course'
import { boundsOf, headingAt, lineBetween, mapWindow, pointAt, type LonLat, type MapZoom } from '@core/journeys/map'
import type { JourneyTick } from '@core/journeys/types'
import { ENGINE_TICK_MS } from '@core/ride/live-engine'
import { MAP_STYLE_BASE, TERRAIN_ATTRIBUTION, TERRAIN_MAX_ZOOM, TERRAIN_TILES } from '@shared/map-tiles'
import { useTheme, type Theme } from '../../app/theme'
import { gradeLines } from '../../routes/geometry'
import { GRADE_CLASSES } from '../../routes/grade'
import { useReducedMotion } from '../../ui/use-reduced-motion'

// The journey on a real map (MapLibre): OpenFreeMap's streets, towns and
// water, hill shading from the AWS terrain tiles, and in 3D the terrain
// itself, with the road coloured by grade, today's trail and the dot on top.
// Loaded only when a map tab is open. If the map can't start (no network,
// no WebGL), onFail hands back to the road drawn offline.

// MapLibre finds its worker next to its own module on http(s) pages only; the
// app is served from app://, so it is pointed at the bundled copy.
setWorkerUrl(workerUrl)

/** How long the style may take to arrive before the map gives up. */
const START_TIMEOUT_MS = 12_000
const PITCH_3D = 60
/** The 3D camera behind the dot: this zoom on a panel this wide, px. */
const CHASE_ZOOM = 12.2
const CHASE_WIDTH = 900
const EXAGGERATION = 1.4
/** Draw the trail again after the dot has moved this far, m. */
const TRAIL_STEP_M = 10
/** The whole-journey progress line is redrawn less often: the trail covers its fresh end. */
const DONE_STEP_M = 500

// GeoJSON, just the parts drawn here
interface Line {
  type: 'Feature'
  properties: Record<string, number>
  geometry: { type: 'LineString'; coordinates: LonLat[] }
}
interface Lines {
  type: 'FeatureCollection'
  features: Line[]
}
const EMPTY: Lines = { type: 'FeatureCollection', features: [] }
const line = (coords: LonLat[], properties: Record<string, number> = {}): Line => ({ type: 'Feature', properties, geometry: { type: 'LineString', coordinates: coords } })

const cssVar = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()

/** The theme's colours, read from its tokens: MapLibre paints with values, not CSS variables. */
function palette(theme: Theme) {
  return {
    style: `${MAP_STYLE_BASE}/${theme === 'dark' ? 'dark' : 'positron'}`,
    grades: GRADE_CLASSES.map((_, i) => cssVar(`--color-grade-${i}`)),
    accent: cssVar('--color-accent'),
    casing: cssVar(theme === 'dark' ? '--color-bg' : '--color-panel'),
    shadow: cssVar(theme === 'dark' ? '--color-bg' : '--color-ink-dim'),
    highlight: cssVar(theme === 'dark' ? '--color-line-strong' : '--color-panel'),
    exaggeration: theme === 'dark' ? 0.7 : 0.35,
  }
}

function addLayers(map: MapLibre, p: ReturnType<typeof palette>): void {
  map.addSource('ch-dem', { type: 'raster-dem', tiles: [TERRAIN_TILES], encoding: 'terrarium', tileSize: 256, maxzoom: TERRAIN_MAX_ZOOM, attribution: TERRAIN_ATTRIBUTION })
  // the 3D surface reads its own copy, as MapLibre recommends alongside hill shading
  map.addSource('ch-dem-3d', { type: 'raster-dem', tiles: [TERRAIN_TILES], encoding: 'terrarium', tileSize: 256, maxzoom: TERRAIN_MAX_ZOOM })
  const firstLabel = map.getStyle().layers.find((l) => l.type === 'symbol')?.id
  map.addLayer(
    {
      id: 'ch-hills',
      type: 'hillshade',
      source: 'ch-dem',
      paint: { 'hillshade-exaggeration': p.exaggeration, 'hillshade-shadow-color': p.shadow, 'hillshade-highlight-color': p.highlight, 'hillshade-accent-color': p.shadow },
    },
    firstLabel,
  )
  for (const id of ['ch-road', 'ch-done', 'ch-trail']) map.addSource(id, { type: 'geojson', data: EMPTY })
  const g = p.grades
  const layout = { 'line-join': 'round', 'line-cap': 'round' } as const
  map.addLayer({ id: 'ch-road-casing', type: 'line', source: 'ch-road', layout, paint: { 'line-color': p.casing, 'line-opacity': 0.9, 'line-width': ['interpolate', ['linear'], ['zoom'], 5, 4, 13, 9] } })
  map.addLayer({
    id: 'ch-road',
    type: 'line',
    source: 'ch-road',
    layout,
    paint: {
      'line-color': ['match', ['get', 'cls'], 0, g[0]!, 1, g[1]!, 2, g[2]!, 3, g[3]!, 4, g[4]!, g[5]!],
      'line-width': ['interpolate', ['linear'], ['zoom'], 5, 2.5, 13, 5.5],
    },
  })
  map.addLayer({ id: 'ch-done', type: 'line', source: 'ch-done', layout, paint: { 'line-color': p.accent, 'line-opacity': 0.45, 'line-width': ['interpolate', ['linear'], ['zoom'], 5, 2.5, 13, 5.5] } })
  map.addLayer({ id: 'ch-trail', type: 'line', source: 'ch-trail', layout, paint: { 'line-color': p.accent, 'line-width': ['interpolate', ['linear'], ['zoom'], 5, 3, 13, 6.5] } })
}

const setLine = (map: MapLibre, id: string, data: Line | Lines) => map.getSource<GeoJSONSource>(id)?.setData(data)

function dotElement(): HTMLElement {
  const el = document.createElement('div')
  el.className = 'size-4 rounded-full border-[3px] border-panel bg-accent shadow-[0_0_12px_var(--color-accent)]'
  el.dataset.testid = 'journey-dot'
  return el
}

function milestoneElement(name: string, kind: string, label: boolean): HTMLElement {
  const el = document.createElement('div')
  el.className = 'pointer-events-none flex items-center gap-1.5 whitespace-nowrap text-[11px] font-semibold text-ink [text-shadow:0_0_3px_var(--color-panel),0_0_3px_var(--color-panel)]'
  const pin = document.createElement('span')
  pin.className = kind === 'finish' ? 'size-2.5 rounded-sm border-2 border-panel bg-ink' : 'size-2.5 rounded-full border-2 border-ink-dim bg-panel'
  el.append(pin)
  if (label) el.append(kind === 'summit' ? `▲ ${name}` : name)
  return el
}

export interface TileMapProps {
  course: JourneyCourse
  tick: JourneyTick
  zoom: MapZoom
  /** The 3D view: terrain, tilted, the camera riding behind the dot. */
  tilt: boolean
  height: number
  onFail: () => void
}

export function TileMap({ course, tick, zoom, tilt, height, onFail }: TileMapProps) {
  const box = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibre | null>(null)
  const dot = useRef<Marker | null>(null)
  const [ready, setReady] = useState(0)
  const theme = useTheme()
  const reduced = useReducedMotion()
  const failRef = useRef(onFail)
  useEffect(() => {
    failRef.current = onFail
  }, [onFail])
  const points = course.route.points

  // the map itself, made again when the theme flips (its style and colours change with it)
  useEffect(() => {
    const el = box.current
    if (!el) return
    const p = palette(theme)
    let map: MapLibre
    try {
      map = new MapLibre({
        container: el,
        style: p.style,
        interactive: false,
        attributionControl: { compact: false },
        center: [tick.lon, tick.lat],
        zoom: 12,
        maxPitch: 70,
        fadeDuration: 0,
      })
    } catch {
      // no WebGL
      failRef.current()
      return
    }
    let started = false
    const timer = setTimeout(() => {
      if (!started) failRef.current()
    }, START_TIMEOUT_MS)
    // before the style is in, an error means there's no map to be had (offline); after it, a missing tile just stays blank
    map.on('error', () => {
      if (!started) failRef.current()
    })
    // a few of the style's icons (a wood pattern, a dot) aren't in its sprite: drawn as nothing rather than warned about
    map.setMissingStyleImageResolver((id) => {
      if (!map.hasImage(id)) map.addImage(id, { width: 1, height: 1, data: new Uint8Array(4) })
    })
    map.on('style.load', () => {
      started = true
      clearTimeout(timer)
      addLayers(map, p)
      setReady((n) => n + 1)
    })
    dot.current = new Marker({ element: dotElement() }).setLngLat([tick.lon, tick.lat]).addTo(map)
    mapRef.current = map
    return () => {
      clearTimeout(timer)
      map.remove()
      mapRef.current = null
      dot.current = null
      setReady(0)
    }
    // the dot's first position only places the camera; later ones are the effects' business
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme])

  // the road, graded, at full detail
  const road = useMemo<Lines>(() => ({ type: 'FeatureCollection', features: gradeLines(points, course.route.profile).map((l) => line(l.coords, { cls: l.cls })) }), [points, course.route.profile])
  useEffect(() => {
    const map = mapRef.current
    if (map && ready) setLine(map, 'ch-road', road)
  }, [road, ready])

  // terrain on for 3D
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    map.setTerrain(tilt ? { source: 'ch-dem-3d', exaggeration: EXAGGERATION } : null)
  }, [tilt, ready])

  // the progress lines, redrawn as the dot moves on
  const pos = tick.positionM
  const trailFrom = Math.min(tick.startM, pos)
  const trailTo = tick.reversed ? tick.progressM : pos
  const trailKey = Math.round(trailTo / TRAIL_STEP_M)
  // to the last whole step behind the journey's progress, and at least to where today began (the trail takes it from there)
  const doneTo = Math.min(tick.progressM, Math.max(Math.floor(tick.progressM / DONE_STEP_M) * DONE_STEP_M, tick.startM))
  useEffect(() => {
    const map = mapRef.current
    if (map && ready) setLine(map, 'ch-trail', trailTo > trailFrom ? line(lineBetween(points, trailFrom, trailTo)) : EMPTY)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trailKey, trailFrom, ready, points])
  useEffect(() => {
    const map = mapRef.current
    if (map && ready) setLine(map, 'ch-done', doneTo > 0 ? line(lineBetween(points, 0, doneTo)) : EMPTY)
  }, [doneTo, ready, points])

  // milestones in view, named as on the offline map: only borders, summits and the finish when the whole journey is crowded
  const [fromM, toM] = mapWindow(zoom, pos, course.lengthM)
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    const shown = zoom === 'journey' ? course.milestones.filter((m) => m.kind !== 'halfway') : course.milestones.filter((m) => m.atM >= fromM && m.atM <= toM)
    const crowded = zoom === 'journey' && shown.length > 10
    const markers = shown.map((m) =>
      new Marker({ element: milestoneElement(m.name, m.kind, !crowded || m.kind !== 'place'), anchor: 'left', offset: [-5, 0] }).setLngLat(pointAt(points, m.atM)).addTo(map),
    )
    if (zoom === 'journey' && points[0]) markers.push(new Marker({ element: milestoneElement('Start', 'start', false), anchor: 'left', offset: [-5, 0] }).setLngLat([points[0].lon, points[0].lat]).addTo(map))
    return () => markers.forEach((m) => m.remove())
  }, [zoom, fromM, toM, ready, course.milestones, points])

  // the dot
  useEffect(() => {
    dot.current?.setLngLat([tick.lon, tick.lat])
  }, [tick.lon, tick.lat])

  // the camera: the 2D map refits to its window; the 3D one frames the journey, or rides behind the dot today
  const chase = tilt && zoom === 'today'
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready || chase) return
    const bounds = boundsOf(lineBetween(points, fromM, toM, 2_000)) as LngLatBoundsLike
    const fit = map.cameraForBounds(bounds, { padding: 28, maxZoom: 15 })
    if (!fit) return
    const camera = tilt ? { ...fit, zoom: (fit.zoom ?? 10) - 0.3, pitch: 50, bearing: 0 } : { ...fit, pitch: 0, bearing: 0 }
    map.easeTo({ ...camera, duration: reduced ? 0 : 600 })
    if (!tilt) return
    // the camera's height over the terrain is only right once the terrain under it has loaded
    const settle = () => map.jumpTo(camera)
    map.once('idle', settle)
    return () => void map.off('idle', settle)
  }, [chase, tilt, fromM, toM, ready, points, reduced])

  const heading = useRef<number | null>(null)
  const chaseZoom = useRef(CHASE_ZOOM)
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready || !chase) return
    // the same stretch of road ahead whatever the panel's width: a zoom level doubles the ground shown
    chaseZoom.current = Math.min(13.5, Math.max(11, CHASE_ZOOM + Math.log2((box.current?.clientWidth ?? CHASE_WIDTH) / CHASE_WIDTH)))
    heading.current = null
    // the camera's height over the terrain is only right once the terrain under it has loaded (the dot may be standing still)
    const settle = () => map.jumpTo({ zoom: chaseZoom.current })
    map.once('idle', settle)
    return () => void map.off('idle', settle)
  }, [chase, ready])
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready || !chase) return
    // look a few hundred metres up the road, the way the dot is going, and turn into bends gently
    const want = headingAt(points, pos, tick.reversed ? -400 : 400)
    const was = heading.current ?? want
    const turn = ((want - was + 540) % 360) - 180
    heading.current = (was + turn * 0.25 + 360) % 360
    // the dot low in the frame, so most of the picture is the road ahead
    map.easeTo({
      center: [tick.lon, tick.lat],
      offset: [0, height * 0.22],
      bearing: heading.current,
      pitch: PITCH_3D,
      zoom: chaseZoom.current,
      duration: reduced ? 0 : ENGINE_TICK_MS,
      easing: (t) => t,
    })
  }, [chase, ready, pos, tick.lon, tick.lat, tick.reversed, points, reduced, height])

  return <div ref={box} className="journey-tiles w-full overflow-hidden rounded-xl bg-panel-2" style={{ height }} data-testid="journey-tiles" />
}
