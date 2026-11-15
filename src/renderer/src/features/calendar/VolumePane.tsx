import type { ProjectedPmcRow } from '@core/metrics/pmc'
import type { VolumeSide, VolumeTotals } from '@core/workout/volume'
import { cn } from '../../ui/cn'
import { formatDurationShort } from '../../ui/format'

/** Completed against planned, as a bar: green when the planned volume is met. */
function Bar({ done, planned, label }: { done: number; planned: number; label: string }) {
  const pct = planned > 0 ? Math.min(100, (done / planned) * 100) : done > 0 ? 100 : 0
  return (
    <div className="h-1.5 rounded-full bg-panel-3" role="img" aria-label={label}>
      <div className={cn('h-1.5 rounded-full', planned > 0 && done >= planned ? 'bg-good' : 'bg-accent')} style={{ width: `${pct}%` }} />
    </div>
  )
}

const time = (s: number) => (s > 0 ? formatDurationShort(s) : '0m')
const load = (v: number) => String(Math.round(v))

function Row({ label, side }: { label: string; side: VolumeSide }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="eyebrow text-ink-faint">{label}</span>
      <span className="font-display tabular text-sm">
        {time(side.durationS)} <span className="text-ink-dim">· {load(side.load)} TSS</span>
      </span>
    </div>
  )
}

/** Fitness (CTL), fatigue (ATL) and form (TSB) at the end of the week; dashed when projected from planned workouts. */
function Fitness({ row }: { row: ProjectedPmcRow }) {
  const sign = (n: number) => (Math.round(n) > 0 ? `+${Math.round(n)}` : String(Math.round(n)))
  return (
    <div
      className={cn('mt-1 flex flex-wrap justify-between gap-x-2 rounded-md px-1.5 py-1 tabular', row.projected ? 'border border-dashed border-line-strong text-ink-dim' : 'bg-panel-2')}
      title={`${row.projected ? 'Projected from your planned workouts. ' : ''}Fitness (CTL) is your 6-week load, fatigue (ATL) your last week's, and form (TSB) the difference: below -20 is a lot of fatigue, above +5 fresh.`}
      data-testid="week-fitness"
      data-projected={row.projected || undefined}
    >
      <span>
        <span className="eyebrow text-ink-faint">Fitness</span> {Math.round(row.ctl)}
      </span>
      <span>
        <span className="eyebrow text-ink-faint">Fatigue</span> {Math.round(row.atl)}
      </span>
      <span>
        <span className="eyebrow text-ink-faint">Form</span> {sign(row.tsb)}
      </span>
    </div>
  )
}

/** One week of the volume pane: planned against completed time, load and sessions, then fitness and form. */
export function WeekVolume({ v, fitness, testId }: { v: VolumeTotals; fitness?: ProjectedPmcRow; testId?: string }) {
  const nothing = v.planned.sessions === 0 && v.completed.sessions === 0
  return (
    <div className="space-y-1.5 text-xs" data-testid={testId}>
      {nothing ? (
        <div className="text-ink-faint">Nothing planned or done</div>
      ) : (
        <>
          <Row label="Planned" side={v.planned} />
          <Row label="Done" side={v.completed} />
          <Bar done={v.completed.load} planned={v.planned.load} label={`${load(v.completed.load)} of ${load(v.planned.load)} TSS planned`} />
          <div className="flex justify-between text-ink-dim">
            <span>
              {v.completed.sessions} done · {v.planned.sessions} planned
            </span>
            {v.compliance !== null && <span className="tabular">{Math.round(v.compliance * 100)} % on plan</span>}
          </div>
        </>
      )}
      {fitness && <Fitness row={fitness} />}
    </div>
  )
}

/** The month at the top of the pane. */
export function MonthVolume({ v }: { v: VolumeTotals }) {
  return (
    <div className="space-y-2" data-testid="month-volume">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="eyebrow text-ink-faint">Planned</div>
          <div className="font-display text-lg font-semibold tabular">{time(v.planned.durationS)}</div>
          <div className="text-xs text-ink-dim tabular">
            {load(v.planned.load)} TSS · {v.planned.sessions} workout{v.planned.sessions === 1 ? '' : 's'}
          </div>
        </div>
        <div>
          <div className="eyebrow text-ink-faint">Done</div>
          <div className="font-display text-lg font-semibold tabular">{time(v.completed.durationS)}</div>
          <div className="text-xs text-ink-dim tabular">
            {load(v.completed.load)} TSS · {v.completed.sessions} session{v.completed.sessions === 1 ? '' : 's'}
          </div>
        </div>
      </div>
      <Bar done={v.completed.durationS} planned={v.planned.durationS} label={`${time(v.completed.durationS)} of ${time(v.planned.durationS)} planned`} />
      {v.compliance !== null && <div className="text-xs text-ink-dim">{Math.round(v.compliance * 100)} % of planned workouts done so far</div>}
    </div>
  )
}
