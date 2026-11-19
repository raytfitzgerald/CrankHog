import { useRide } from '../../stores/ride'
import { useSettings } from '../../stores/settings'
import { panelViews, realMapAllowed, shownView, type PanelView } from './ride-views'

/** The views this ride can show, and the one on screen (null: nothing to show). */
export function usePanelView(): { views: PanelView[]; shown: PanelView | null } {
  const rideAlong = useSettings((s) => s.coach.rideAlong !== 'off')
  const chosen = useSettings((s) => s.journeys.view)
  const realMap = useSettings((s) => s.journeys.realMap)
  const courseId = useRide((s) => (s.journeyCourse && s.plan?.journey ? s.journeyCourse.id : null))
  const views = panelViews({ rideAlong, journey: courseId !== null, tiles: courseId !== null && realMapAllowed(realMap, courseId) })
  return { views, shown: shownView(chosen, views) }
}
