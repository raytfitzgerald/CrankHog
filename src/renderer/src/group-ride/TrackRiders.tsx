import { useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Users } from 'lucide-react'
import type { SharedTrack } from '@core/openbikenet/tracks'
import { standings, type Standing } from '@core/openbikenet/standings'
import type { RouteProgress } from '@core/ride/route-plan'
import { formatSpan, formatSpeedMps, speedUnit, type UnitSystem } from '@core/units'
import { getRuntime } from '../runtime/composition'
import { useSettings } from '../stores/settings'
import { BetaBadge } from '../ui/BetaBadge'
import { Button } from '../ui/Button'
import { cn } from '../ui/cn'
import { useNow } from '../ui/useNow'
import { GroupRideStatus } from './GroupRideStatus'
import { holdText } from './hold'
import { useGroupRide } from './runtime'

/** Riders closer than this are level with you, m. */
const LEVEL_M = 2

function gapText(gapM: number, units: UnitSystem): string {
  if (Math.abs(gapM) < LEVEL_M) return 'level'
  return `${formatSpan(gapM, units)} ${gapM > 0 ? 'ahead' : 'behind'}`
}

function OffNote({ what }: { what: string }) {
  const navigate = useNavigate()
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-ink-dim" data-testid="group-ride-off">
      <span>{what}</span>
      <Button size="sm" variant="secondary" onClick={() => void navigate({ to: '/settings', search: { tab: 'group-rides' } })}>
        <Users className="size-3.5" /> Turn on Ride with others
      </Button>
    </div>
  )
}

/** The route dialog: who's on a shared track right now, before you ride it. */
export function TrackRidersNow({ track }: { track: SharedTrack }) {
  const enabled = useSettings((s) => s.groupRides.enabled)
  const state = useGroupRide((s) => s)
  const now = useNow(1000)
  useEffect(() => {
    if (!enabled) return
    const rt = getRuntime().groupRides
    rt?.browse(track.obnId)
    return () => rt?.browse(null)
  }, [track.obnId, enabled])

  const here = state.route === track.obnId ? standings(state.riders, null, now, track.lengthM, track.loop) : []
  return (
    <div className="rounded-xl border border-line bg-panel-2/40 p-3" data-testid="track-riders-now">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 eyebrow text-ink-faint">
          <Users className="size-3.5" aria-hidden /> On the track now <BetaBadge />
        </div>
        {enabled && (
          <div className="text-xs text-ink-dim">
            <GroupRideStatus state={state} idle="Connecting…" />
          </div>
        )}
      </div>
      {!enabled ? (
        <OffNote what="Ride it alone, or turn on Ride with others to see who's here and ride with riders of other apps." />
      ) : state.status !== 'connected' ? null : here.length === 0 ? (
        <div className="text-sm text-ink-dim">Nobody's riding it right now. Start a ride and anyone who joins will see you.</div>
      ) : (
        <ul className="flex flex-wrap gap-2" data-testid="track-riders-list">
          {here.map(({ rider }) => (
            <li key={rider.id} className="rounded-lg border border-line bg-panel px-2.5 py-1 text-sm">
              {rider.name} <span className="text-xs text-ink-faint">· {rider.app}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** In the ride: everyone on the track, ahead first, with the gap to each and their speed. */
export function TrackRidersPanel({ track, r }: { track: SharedTrack; r: RouteProgress }) {
  const enabled = useSettings((s) => s.groupRides.enabled)
  const myName = useSettings((s) => s.groupRides.name)
  const units = useSettings((s) => s.units)
  const speed = useSettings((s) => s.speedUnit)
  const state = useGroupRide((s) => s)
  const now = useNow(250)
  const list = state.route === track.obnId ? standings(state.riders, r.distM, now, track.lengthM, track.loop) : []
  const hold = holdText(state.hold, state.problem)
  const ahead = list.filter((s) => (s.gapM ?? 0) >= LEVEL_M)
  const rest = list.filter((s) => (s.gapM ?? 0) < LEVEL_M)
  const you = state.riding ? myName.trim() || 'You' : null

  return (
    <div className="flex h-full flex-col rounded-2xl border border-line bg-panel p-4" data-testid="track-riders-panel">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 eyebrow text-ink-faint">
          <Users className="size-3.5" aria-hidden /> On the track <BetaBadge />
        </div>
        {enabled && (
          <div className="text-xs text-ink-dim" data-testid="track-riders-status">
            <GroupRideStatus state={state} />
          </div>
        )}
      </div>
      {!enabled ? (
        <OffNote what="You're riding alone." />
      ) : (
        <>
          {hold && (
            <div className="mb-2 rounded-lg border border-warn/40 bg-warn/10 px-3 py-1.5 text-xs" role="status" data-testid="track-riders-hold">
              {hold}
            </div>
          )}
          {list.length === 0 && state.status === 'connected' ? (
            <div className="text-sm text-ink-dim">Nobody else is on the track right now.{state.riding ? ' Anyone who joins will see you.' : ''}</div>
          ) : (
            <ol className="space-y-1 overflow-y-auto" data-testid="track-riders-list">
              {ahead.map((s) => (
                <Row key={s.rider.id} s={s} units={units} speed={speed} />
              ))}
              {you !== null && (
                <li className="flex items-center gap-3 rounded-lg bg-accent/15 px-3 py-1.5 text-sm" data-testid="track-riders-you">
                  <span className="size-2.5 shrink-0 rounded-full bg-accent" aria-hidden />
                  <span className="min-w-0 flex-1 truncate font-medium">{you}</span>
                  <span className="text-xs text-ink-dim">you</span>
                </li>
              )}
              {rest.map((s) => (
                <Row key={s.rider.id} s={s} units={units} speed={speed} />
              ))}
            </ol>
          )}
        </>
      )}
    </div>
  )
}

function Row({ s, units, speed }: { s: Standing; units: UnitSystem; speed: Parameters<typeof speedUnit>[0] }) {
  const v = formatSpeedMps(s.rider.speed, speed)
  const gap = s.gapM ?? 0
  return (
    <li className="flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm hover:bg-panel-2" data-testid="track-rider">
      <span className="size-2.5 shrink-0 rounded-full bg-ink-dim" aria-hidden />
      <span className="min-w-0 flex-1 truncate">
        {s.rider.name} <span className="text-xs text-ink-faint">· {s.rider.app}</span>
      </span>
      <span className={cn('tabular text-xs', Math.abs(gap) < LEVEL_M ? 'text-ink' : 'text-ink-dim')}>{gapText(gap, units)}</span>
      <span className="tabular w-32 text-right text-xs text-ink-faint">
        {v !== null ? `${v} ${speedUnit(speed)}` : ''}
        {s.rider.power !== null ? ` · ${s.rider.power} W` : ''}
      </span>
    </li>
  )
}
