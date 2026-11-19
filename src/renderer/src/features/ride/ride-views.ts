// The ride screen's big panel: the coach's road (the ride-along), and on a
// journey the map, flat or in 3D. One shows at a time, switched by tabs, and
// the choice is kept in settings. Pure, so it is tested without a DOM.
import type { AppSettings } from '@shared/settings'

export type PanelView = AppSettings['journeys']['view']
type RealMap = AppSettings['journeys']['realMap']

/** Whether a course gets the real map: imported routes ("route:<id>") are the rider's own and stay offline unless they say so. */
export function realMapAllowed(setting: RealMap, courseId: string): boolean {
  if (setting === 'off') return false
  return setting === 'all' || !courseId.startsWith('route:')
}

/** The views this ride can show, in tab order. */
export function panelViews(o: { rideAlong: boolean; journey: boolean; tiles: boolean }): PanelView[] {
  const views: PanelView[] = []
  if (o.rideAlong) views.push('road')
  if (o.journey) views.push('map')
  if (o.journey && o.tiles) views.push('3d')
  return views
}

/** What goes in the chosen view's place when the ride can't show it: the nearest thing to it. */
const STAND_INS: Record<PanelView, PanelView[]> = {
  road: ['3d', 'map'],
  map: ['3d', 'road'],
  '3d': ['map', 'road'],
}

/** The view to show: the rider's choice when this ride has it, otherwise its nearest stand-in, or null for none at all. */
export function shownView(chosen: PanelView, views: readonly PanelView[]): PanelView | null {
  if (views.includes(chosen)) return chosen
  return STAND_INS[chosen].find((v) => views.includes(v)) ?? null
}

export const VIEW_LABELS: Record<PanelView, { label: string; hint: string }> = {
  road: { label: 'Ride-along', hint: 'You and your coach on the road' },
  map: { label: 'Map', hint: 'The journey on a map' },
  '3d': { label: '3D', hint: 'The journey in 3D, hills and all' },
}
