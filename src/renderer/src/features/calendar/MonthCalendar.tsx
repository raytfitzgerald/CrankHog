import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { DndContext, KeyboardSensor, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { Bike, ChevronLeft, ChevronRight, CircleCheck, FlaskConical, Gauge, Mountain, Plus } from 'lucide-react'
import type { RideSummary } from '@core/ride/types'
import { formatSportDistance } from '@core/sport/format'
import { activityGroup } from '@core/sport/group'
import { activityLoad } from '@core/sport/load'
import { dateKey, entrySport, isBikeWorkout, isDateKey } from '@core/workout/schedule'
import { volumeBetween } from '@core/workout/volume'
import type { OtherActivity } from '../../db/db'
import { moveScheduled } from '../../plan/schedule-repo'
import { useSettings } from '../../stores/settings'
import { WorkoutThumb } from '../../charts/WorkoutThumb'
import { Button } from '../../ui/Button'
import { cn } from '../../ui/cn'
import { formatDurationShort } from '../../ui/format'
import { useNow } from '../../ui/useNow'
import { PlannedWorkoutDialog } from '../plan/PlannedWorkoutDialog'
import { ActivityDialog } from './ActivityDialog'
import { sportIcon } from './sport'
import { SportIcon } from './SportIcon'
import { calendarMonth, MARK_NAME, shiftMonth, type CalendarDay, type PlannedOnDay } from './calendar'
import type { DayMode } from './DayDialog'
import { hoursMinutes, type WorkoutPreview } from './preview'
import { useCalendarData } from './use-calendar-data'
import { MonthVolume, WeekVolume } from './VolumePane'

const KIND_ICON = { free: Bike, workout: Gauge, route: Mountain, 'ftp-test': FlaskConical } as const
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTH = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' })
const DAY = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
const WEEK_OF = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' })
const MAX_CHIPS = 3
const PLANNED_CHIP: Record<PlannedOnDay['status'], string> = {
  planned: 'border-dashed border-line-strong text-ink-dim',
  today: 'border-accent bg-accent/10 text-ink',
  missed: 'border-bad/60 bg-bad/10 text-bad',
}

/**
 * A month at a time: rides, other sports and planned workouts on each day,
 * with today highlighted and past days greyed. Done workouts go green and
 * missed ones red. Each planned workout shows its length, its average
 * planned power and its shape. Beside each week, planned against completed volume. Drag
 * a planned workout to another day to move it, or click it to ride it, move
 * it or remove it. Click a day itself to put a workout on it (`onDay`), or its
 * event or day off to change those.
 */
export function MonthCalendar({ onDay }: { onDay?: (day: CalendarDay, mode?: DayMode) => void }) {
  const [[year, month], setMonth] = useState<[number, number]>(() => {
    const d = new Date()
    return [d.getFullYear(), d.getMonth()]
  })
  const navigate = useNavigate()
  const [openPlanned, setOpenPlanned] = useState<PlannedOnDay | null>(null)
  const [openActivity, setOpenActivity] = useState<OtherActivity | null>(null)
  // the grid reaches a few days into the months either side
  const from = new Date(year, month, -7).getTime()
  const to = new Date(year, month + 1, 8).getTime()
  const nowMs = useNow()
  const data = useCalendarData(from, to, dateKey(nowMs))
  const m = calendarMonth(year, month, { rides: data.rides ?? [], schedule: data.schedule ?? [], activities: data.activities ?? [], marks: data.marks ?? [], now: nowMs })
  const today = dateKey(nowMs)
  const input = { ...data.volumeInput, today }
  const monthVolume = volumeBetween(dateKey(new Date(year, month, 1).getTime()), dateKey(new Date(year, month + 1, 0).getTime()), input)
  const now = new Date(nowMs)
  const isThisMonth = year === now.getFullYear() && month === now.getMonth()

  // a small move first, so a click on a chip still opens it
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor))
  const onDragEnd = (e: DragEndEvent) => {
    const target = e.over?.id
    const p = e.active.data.current as PlannedOnDay | undefined
    if (typeof target === 'string' && isDateKey(target) && p && p.entry.date !== target) void moveScheduled(p.entry.id, target)
  }

  return (
    <div className="rounded-2xl border border-line bg-panel" data-testid="ride-calendar">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line px-4 py-3">
        <div>
          <div className="flex items-center gap-1">
            <Button size="iconSm" variant="ghost" onClick={() => setMonth(shiftMonth(year, month, -1))} aria-label="Previous month" data-testid="calendar-prev">
              <ChevronLeft className="size-4" />
            </Button>
            <h2 className="min-w-44 text-center font-display text-lg font-semibold" data-testid="calendar-month">
              {MONTH.format(new Date(year, month, 1))}
            </h2>
            <Button size="iconSm" variant="ghost" onClick={() => setMonth(shiftMonth(year, month, 1))} aria-label="Next month" data-testid="calendar-next">
              <ChevronRight className="size-4" />
            </Button>
            {!isThisMonth && (
              <Button size="sm" variant="ghost" onClick={() => setMonth([now.getFullYear(), now.getMonth()])}>
                Today
              </Button>
            )}
          </div>
          <div className="mt-1 pl-2 tabular text-sm text-ink-dim" data-testid="calendar-summary">
            {m.rides} ride{m.rides === 1 ? '' : 's'}
            {monthVolume.completed.sessions > m.rides && ` + ${monthVolume.completed.sessions - m.rides} other`} · {formatDurationShort(monthVolume.completed.durationS)} · {Math.round(monthVolume.completed.load)} TSS
            {m.planned > 0 && ` · ${m.planned} planned`}
          </div>
        </div>
        <div className="w-full max-w-sm rounded-xl border border-line bg-panel-2 px-4 py-3">
          <MonthVolume v={monthVolume} />
        </div>
      </div>

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="grid grid-cols-7 md:grid-cols-[repeat(7,minmax(0,1fr))_220px]" role="grid" aria-label={`Calendar for ${MONTH.format(new Date(year, month, 1))}`}>
          {WEEKDAYS.map((d) => (
            <div key={d} className="eyebrow border-b border-line px-2 py-1.5 text-ink-faint" role="columnheader">
              {d}
            </div>
          ))}
          <div className="eyebrow hidden border-b border-line px-3 py-1.5 text-ink-faint md:block" role="columnheader">
            Planned and done
          </div>
          {m.weeks.map((w) => (
            <div key={w.startKey} className="contents" role="row">
              {w.days.map((d) => (
                <DayCell
                  key={d.key}
                  day={d}
                  planNames={data.planNames}
                  previews={data.previews}
                  onRide={(r) => void navigate({ to: '/history/$rideId', params: { rideId: r.id } })}
                  onPlanned={setOpenPlanned}
                  onActivity={setOpenActivity}
                  onDay={onDay}
                />
              ))}
              <div className="hidden border-b border-line bg-panel p-3 md:block" role="gridcell" aria-label={`Week of ${WEEK_OF.format(w.days[0]!.date)}`}>
                <WeekVolume v={volumeBetween(w.startKey, w.endKey, input)} fitness={data.fitness.get(w.endKey)} testId="week-volume" />
              </div>
            </div>
          ))}
        </div>
      </DndContext>

      {/* phones: the weeks' volume under the grid */}
      <div className="divide-y divide-line md:hidden">
        {m.weeks.map((w) => (
          <div key={w.startKey} className="px-4 py-3">
            <div className="eyebrow mb-1 text-ink-faint">Week of {WEEK_OF.format(w.days[0]!.date)}</div>
            <WeekVolume v={volumeBetween(w.startKey, w.endKey, input)} fitness={data.fitness.get(w.endKey)} />
          </div>
        ))}
      </div>

      {openPlanned && <PlannedWorkoutDialog entry={openPlanned.entry} status={openPlanned.status} planName={openPlanned.entry.planId ? data.planNames.get(openPlanned.entry.planId) : undefined} onClose={() => setOpenPlanned(null)} />}
      {openActivity && <ActivityDialog activity={openActivity} onClose={() => setOpenActivity(null)} />}
    </div>
  )
}

function DayCell({
  day: d,
  planNames,
  previews,
  onRide,
  onPlanned,
  onActivity,
  onDay,
}: {
  day: CalendarDay
  planNames: ReadonlyMap<string, string>
  previews: ReadonlyMap<string, WorkoutPreview>
  onRide: (r: RideSummary) => void
  onPlanned: (p: PlannedOnDay) => void
  onActivity: (a: OtherActivity) => void
  onDay?: (day: CalendarDay, mode?: DayMode) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: d.key })
  const plannedRides = new Set(d.plannedRideIds)
  const plannedActivities = new Set(d.plannedActivityIds)
  const items = d.rides.length + d.activities.length + d.planned.length
  // rides first, then other sports, then what is still planned
  const rides = d.rides.slice(0, MAX_CHIPS)
  const activities = d.activities.slice(0, Math.max(0, MAX_CHIPS - rides.length))
  const planned = d.planned.slice(0, Math.max(0, MAX_CHIPS - rides.length - activities.length))
  const parts = [d.rides.length === 0 ? 'no rides' : `${d.rides.length} ride${d.rides.length === 1 ? '' : 's'}, ${Math.round(d.tss)} TSS`]
  if (d.activities.length > 0) parts.push(`${d.activities.length} other activit${d.activities.length === 1 ? 'y' : 'ies'}`)
  if (d.planned.length > 0) parts.push(`${d.planned.length} planned`)
  for (const mk of d.marks) parts.push(mk.kind === 'event' ? `event: ${mk.name ?? ''}` : MARK_NAME[mk.kind])
  return (
    <div
      ref={setNodeRef}
      role="gridcell"
      aria-label={`${DAY.format(d.date)}${d.isToday ? ' (today)' : ''}: ${parts.join(', ')}`}
      className={cn(
        'group min-h-28 border-b border-r border-line p-1.5',
        d.isPast && d.inMonth && 'bg-panel-2/70',
        !d.inMonth && 'opacity-45',
        d.isToday && 'bg-accent/5 ring-2 ring-inset ring-accent',
        isOver && 'outline-2 -outline-offset-2 outline-accent',
        onDay && 'cursor-pointer',
      )}
      // a click on the day's free space picks a workout for it; the chips and buttons on it do their own thing
      onClick={onDay && ((e) => !(e.target as Element).closest('button, a') && onDay(d))}
      data-testid={d.rides.length > 0 ? 'calendar-ride-day' : undefined}
      data-date={d.key}
      data-past={d.isPast || undefined}
      data-today={d.isToday || undefined}
    >
      <div className="mb-1 flex items-center justify-between">
        <span className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => onDay?.(d)}
            disabled={!onDay}
            className={cn('grid size-6 place-items-center rounded-full text-xs tabular', d.isToday ? 'bg-accent font-bold text-on-accent' : d.isPast ? 'text-ink-faint' : 'text-ink-dim', onDay && !d.isToday && 'hover:bg-panel-3')}
            aria-label={`${DAY.format(d.date)}: add a workout, a session, an event or a day off`}
            data-testid="calendar-day-menu"
          >
            {d.day}
          </button>
          {onDay && (
            <button
              type="button"
              onClick={() => onDay(d)}
              className="no-drag hidden size-5 place-items-center rounded text-ink-faint opacity-0 hover:bg-panel-3 hover:text-ink focus-visible:opacity-100 group-hover:opacity-100 md:grid"
              aria-label={`Add a workout on ${DAY.format(d.date)}`}
              title="Add a workout"
              data-testid="calendar-day-add"
            >
              <Plus className="size-3.5" />
            </button>
          )}
        </span>
        {d.tss > 0 && <span className="tabular text-[10px] text-ink-faint">{Math.round(d.tss)} TSS</span>}
      </div>
      {d.marks.length > 0 && (
        <div className="mb-1 space-y-0.5">
          {d.marks.map((mk) => (
            <button
              key={mk.id}
              type="button"
              onClick={() => onDay?.(d, 'mark')}
              className={cn('no-drag block w-full truncate rounded px-1.5 py-0.5 text-left text-[10px] font-semibold', mk.kind === 'event' ? 'bg-accent text-on-accent' : 'bg-panel-3 text-ink-dim')}
              data-testid="calendar-mark"
              data-kind={mk.kind}
            >
              {mk.kind === 'event' ? `${mk.priority ?? 'A'} · ${mk.name ?? 'Event'}` : MARK_NAME[mk.kind]}
            </button>
          ))}
        </div>
      )}
      <div className="space-y-1">
        {rides.map((r) => {
          const asPlanned = plannedRides.has(r.id)
          const Icon = asPlanned ? CircleCheck : KIND_ICON[r.kind]
          // a ride done as planned keeps the planned workout's card
          const preview = asPlanned && r.workoutId ? previews.get(r.workoutId) : undefined
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => onRide(r)}
              title={`${r.name}${preview ? ` · planned ${statsText(preview)}` : ''} · ${formatDurationShort(r.movingS)}${r.tss !== null ? ` · ${Math.round(r.tss)} TSS` : ''}${asPlanned ? ' · done, as planned' : ''}`}
              className={cn(
                'no-drag block w-full overflow-hidden rounded-md border px-1.5 py-1 text-left text-[11px] leading-tight hover:border-accent',
                asPlanned ? 'border-good/60 bg-good/10' : 'border-line bg-panel-2',
              )}
              data-testid="calendar-ride"
              data-done={asPlanned || undefined}
            >
              <span className="flex items-center gap-1">
                <Icon className={cn('size-3 shrink-0', asPlanned ? 'text-good' : 'text-accent')} aria-label={asPlanned ? 'Done, as planned' : undefined} aria-hidden={!asPlanned} />
                <span className="min-w-0 flex-1 truncate font-medium">{r.name}</span>
              </span>
              {preview && <CardPreview preview={preview} />}
            </button>
          )
        })}
        {activities.map((a) => {
          const asPlanned = plannedActivities.has(a.id)
          const Icon = asPlanned ? CircleCheck : sportIcon(a)
          const load = activityLoad(a)
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => onActivity(a)}
              title={`${a.name} · ${formatDurationShort(a.movingS)}${load !== null ? ` · ${Math.round(load)} TSS` : ''}${a.trainingEffect ? ` · Training Effect ${a.trainingEffect.aerobic.toFixed(1)}` : ''}${asPlanned ? ' · done, as planned' : ''}`}
              className={cn(
                'no-drag flex w-full items-center gap-1 rounded-md border px-1.5 py-1 text-left text-[11px] leading-tight hover:border-accent',
                asPlanned ? 'border-good/60 bg-good/10' : 'border-line bg-panel-2',
              )}
              data-testid="calendar-activity"
              data-sport={activityGroup(a)}
              data-done={asPlanned || undefined}
            >
              <Icon className={cn('size-3 shrink-0', asPlanned ? 'text-good' : 'text-ink-dim')} aria-label={asPlanned ? 'Done, as planned' : undefined} aria-hidden={!asPlanned} />
              <span className="min-w-0 flex-1 truncate font-medium">{a.name}</span>
              {load !== null && <span className="shrink-0 tabular text-[10px] text-ink-faint">{Math.round(load)}</span>}
            </button>
          )
        })}
        {planned.map((p) => (
          <PlannedChip key={p.entry.id} planned={p} preview={previewOf(p.entry, previews)} planName={p.entry.planId ? planNames.get(p.entry.planId) : undefined} onOpen={() => onPlanned(p)} />
        ))}
        {items > MAX_CHIPS && <div className="px-1 text-[11px] text-ink-faint">+{items - MAX_CHIPS} more</div>}
      </div>
    </div>
  )
}

const previewOf = (e: PlannedOnDay['entry'], previews: ReadonlyMap<string, WorkoutPreview>) => {
  const id = e.workoutId ?? e.workout?.id
  return id ? previews.get(id) : undefined
}

/** "1:00 · 178 W", or "0:25 ramp" for a ramp test. */
const statsText = (p: WorkoutPreview) => (p.ramp ? `${hoursMinutes(p.plannedS)} ramp` : `${hoursMinutes(p.plannedS)}${p.avgW !== null ? ` · ${p.avgW} W` : ''}`)

/**
 * Under a card's name: length and average planned power, then the workout's
 * shape. Phones are too narrow for the shape, so they show the numbers only.
 */
function CardPreview({ preview, faded = false }: { preview: WorkoutPreview; faded?: boolean }) {
  return (
    <>
      {/* phones: length and watts on two lines */}
      <span className="mt-0.5 flex flex-wrap gap-x-1 font-display text-[11px] leading-tight tabular text-ink-dim md:text-[13px]" data-testid="calendar-card-stats">
        <span className="whitespace-nowrap">{hoursMinutes(preview.plannedS)}</span>
        {preview.ramp ? (
          <span className="text-ink-faint">ramp</span>
        ) : (
          preview.avgW !== null && (
            <>
              <span className="hidden text-ink-faint md:inline" aria-hidden>
                ·
              </span>
              <span className="whitespace-nowrap">{preview.avgW} W</span>
            </>
          )
        )}
      </span>
      <span className={cn('mt-1 hidden overflow-hidden rounded-sm md:block', faded && 'opacity-45 saturate-50')} data-testid="calendar-card-shape">
        <WorkoutThumb blocks={preview.blocks} durationS={preview.durationS} height={28} />
      </span>
    </>
  )
}

/** "45m · 8 km", "1h 00m": a planned session's time and distance. */
function sessionStats(e: PlannedOnDay['entry'], units: 'metric' | 'imperial'): string | null {
  const s = e.session
  if (!s) return null
  const parts = [s.durationS ? formatDurationShort(s.durationS) : null, s.distanceM ? formatSportDistance(s.distanceM, entrySport(e), units) : null].filter((x): x is string => !!x)
  return parts.length > 0 ? parts.join(' · ') : null
}

function PlannedChip({ planned: p, preview, planName, onOpen }: { planned: PlannedOnDay; preview?: WorkoutPreview; planName?: string; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: p.entry.id, data: p })
  const units = useSettings((s) => s.units)
  const bike = isBikeWorkout(p.entry)
  const sessionText = bike ? null : sessionStats(p.entry, units)
  const state = p.status === 'missed' ? 'missed' : p.status === 'today' ? 'planned for today' : 'planned'
  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={onOpen}
      {...attributes}
      {...listeners}
      title={`${p.entry.name}${preview ? ` · ${statsText(preview)}` : ''}${sessionText ? ` · ${sessionText}` : ''} · ${state}${planName ? ` · ${planName}` : ''}. Drag to another day to move it.`}
      aria-label={`${p.entry.name}, ${state}`}
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined}
      className={cn(
        'no-drag relative block w-full touch-none overflow-hidden rounded-md border px-1.5 py-1 text-left text-[11px] leading-tight hover:border-accent',
        PLANNED_CHIP[p.status],
        isDragging && 'z-20 shadow-lg',
      )}
      data-testid="calendar-planned"
      data-status={p.status}
      data-sport={entrySport(p.entry)}
    >
      <span className="flex items-center gap-1">
        <SportIcon sport={entrySport(p.entry)} workout={bike} className={cn('size-3 shrink-0', p.status === 'missed' ? 'text-bad' : 'text-accent')} aria-hidden />
        <span className="min-w-0 flex-1 truncate font-medium">{p.entry.name}</span>
      </span>
      {preview && <CardPreview preview={preview} faded={p.status === 'missed'} />}
      {!bike && sessionText && (
        <span className="mt-0.5 block font-display text-[11px] leading-tight tabular text-ink-dim md:text-[13px]" data-testid="calendar-card-stats">
          {sessionText}
        </span>
      )}
    </button>
  )
}
