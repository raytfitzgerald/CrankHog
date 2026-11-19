import { RideAlong, RideAlongClock } from '../../coach/ride-along/RideAlong'
import { patchSettings, settingsStore } from '../../stores/settings'
import { Segmented } from '../../ui/Segmented'
import { JourneyMap } from '../journeys/JourneyMap'
import { VIEW_LABELS, type PanelView } from './ride-views'
import { usePanelView } from './use-panel-view'

const choose = (view: PanelView) => void patchSettings({ journeys: { ...settingsStore.getState().journeys, view } })

/**
 * The ride screen's panel: the coach's road, and on a journey the map, flat
 * or in 3D, one at a time behind tabs. The choice is kept for the next ride.
 */
export function RideViews() {
  const { views, shown } = usePanelView()
  if (shown === null) return null
  const switcher =
    views.length > 1 ? (
      <Segmented ariaLabel="Ride view" value={shown} onChange={choose} options={views.map((v) => ({ value: v, ...VIEW_LABELS[v] }))} />
    ) : null
  if (shown === 'road') return <RideAlong switcher={switcher} />
  return (
    <>
      {views.includes('road') && <RideAlongClock />}
      <JourneyMap view={shown} switcher={switcher} />
    </>
  )
}
