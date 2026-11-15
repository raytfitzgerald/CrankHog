import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { formatLongDistance } from '@core/units'
import { db, type OtherActivity } from '../../db/db'
import { useSettings } from '../../stores/settings'
import { Button } from '../../ui/Button'
import { Dialog } from '../../ui/Dialog'
import { formatDurationShort } from '../../ui/format'
import { distanceUnit } from '@core/units'
import { sportLabel } from './sport'

const WHEN = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' })
/** A run, swim or strength session from a FIT file: what it was, and its load. */
export function ActivityDialog({ activity: a, onClose }: { activity: OtherActivity; onClose: () => void }) {
  const units = useSettings((s) => s.units)
  const [confirming, setConfirming] = useState(false)
  const rows: [string, string][] = [
    ['Moving time', formatDurationShort(a.movingS)],
    ...(a.distanceM !== null ? [['Distance', `${formatLongDistance(a.distanceM, units, 2)} ${distanceUnit(units)}`] as [string, string]] : []),
    ...(a.avgHr !== null ? [['Heart rate', `${a.avgHr} avg${a.maxHr !== null ? ` · ${a.maxHr} max` : ''} bpm`] as [string, string]] : []),
    ['Load', a.hrLoad !== null ? `${Math.round(a.hrLoad)} hrTSS` : 'No heart rate, or no threshold heart rate in Settings → Athlete & FTP'],
    ...(a.trainingEffect ? [['Training Effect', `${a.trainingEffect.aerobic.toFixed(1)} aerobic${a.trainingEffect.anaerobic !== null ? ` · ${a.trainingEffect.anaerobic.toFixed(1)} anaerobic` : ''}`] as [string, string]] : []),
    ...(a.garminLoad !== null ? [['Garmin training load', String(Math.round(a.garminLoad))] as [string, string]] : []),
    ...(a.device ? [['Recorded with', a.device] as [string, string]] : []),
  ]
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={a.name}
      description={`${sportLabel(a.sport)}: ${WHEN.format(a.startedAt)}`}
      footer={
        confirming ? (
          <div className="flex w-full flex-wrap items-center justify-between gap-2 text-sm">
            <span>Remove it from the calendar? Importing its file again brings it back.</span>
            <span className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                variant="danger"
                onClick={() =>
                  void db()
                    .activities.delete(a.id)
                    .then(onClose)
                }
                data-testid="activity-remove-confirm"
              >
                Remove
              </Button>
            </span>
          </div>
        ) : (
          <Button variant="ghost" onClick={() => setConfirming(true)} data-testid="activity-remove">
            <Trash2 className="size-3.5" /> Remove
          </Button>
        )
      }
    >
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm" data-testid="activity-details">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-ink-dim">{k}</dt>
            <dd className="tabular">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs text-ink-faint">hrTSS is CrankHog's load from heart rate, on the same scale as ride TSS: an hour at threshold heart rate is 100.</p>
    </Dialog>
  )
}
