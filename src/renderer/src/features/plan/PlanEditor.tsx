import { useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowDown, ArrowUp, CalendarCheck, CalendarX, FileUp, Plus, Search, Trash2, Undo2, X } from 'lucide-react'
import { isBlocking, layOutPlan, type PlanWarning, type TrainingPlan } from '@core/workout/plan'
import { dateKey, dateKeyToMs, isDateKey } from '@core/workout/schedule'
import { db } from '../../db/db'
import { useFtp } from '../../db/use-athlete'
import { addToPlan, deletePlan, importIntoPlan, moveItem, putOnCalendar, resetPlanWorkout, takeOffCalendar, takeOutOfPlan, updatePlan } from '../../plan/plans-repo'
import { Button } from '../../ui/Button'
import { cn } from '../../ui/cn'
import { Field, Input } from '../../ui/form'
import { formatDurationShort } from '../../ui/format'
import { useNow } from '../../ui/useNow'
import { IMPORT_EXTENSIONS, loadLibrary, plannedStatsOf, type LibraryEntry } from '../../workouts/library'
import { planImportNotice } from './import-notice'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const DAY = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' })

function warningText(w: PlanWarning): string {
  switch (w.kind) {
    case 'no-ride-days':
      return 'Pick the days you ride, so the workouts without a date can go somewhere.'
    case 'past-event':
      return `${w.count} workout${w.count === 1 ? " doesn't" : "s don't"} fit before the event. Add ride days, start earlier, or take some out.`
    case 'days-off':
      return `${w.count} workout${w.count === 1 ? ' falls on a day off' : 's fall on days off'} with no free ride day in the week after, so ${w.count === 1 ? 'it stays' : 'they stay'} off the calendar.`
    case 'before-today':
      return `${w.count} workout${w.count === 1 ? ' lands' : 's land'} before today and will show as missed.`
  }
}

/**
 * One plan: its name, the days you ride, when it starts, and its workouts in
 * order, each with the day it lands on. Put on calendar lays it out; while it
 * is on the calendar every change re-lays it.
 */
export function PlanEditor({ plan, onDeleted, onNotice }: { plan: TrainingPlan; onDeleted: () => void; onNotice: (n: { tone: 'good' | 'bad'; text: string }) => void }) {
  const { ftpW } = useFtp()
  const library = useLiveQuery(() => loadLibrary(ftpW), [ftpW])
  const marks = useLiveQuery(() => db().dayMarks.toArray(), [])
  const byId = useMemo(() => new Map((library ?? []).map((e) => [e.workout.id, e])), [library])
  const [name, setName] = useState(plan.name)
  const [adding, setAdding] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const now = useNow()

  const event = plan.eventId ? marks?.find((m) => m.id === plan.eventId) : undefined
  const layout = useMemo(
    () =>
      layOutPlan({
        items: plan.items,
        rideDays: plan.rideDays,
        startDate: plan.startDate,
        today: dateKey(now),
        blocked: new Set((marks ?? []).filter(isBlocking).map((m) => m.date)),
        endDate: event?.date,
      }),
    [plan, marks, event, now],
  )
  const dateOf = new Map(layout.placements.map((p) => [p.index, p.date]))
  const total = plan.items.reduce((s, i) => {
    const e = byId.get(i.workoutId)
    return s + (e ? plannedStatsOf(e.workout, e.stats).durationS : 0)
  }, 0)

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    try {
      await fn()
    } catch (e) {
      onNotice({ tone: 'bad', text: e instanceof Error ? e.message : String(e) })
    } finally {
      setBusy(false)
    }
  }

  const toggleDay = (d: number) => act(() => updatePlan(plan.id, { rideDays: plan.rideDays.includes(d) ? plan.rideDays.filter((x) => x !== d) : [...plan.rideDays, d].sort() }))

  const importFiles = (list: FileList) =>
    act(async () => {
      const files = await Promise.all(Array.from(list).map(async (f) => ({ name: f.name, text: await f.text() })))
      onNotice(planImportNotice(plan.name, await importIntoPlan(plan.id, files)))
    })

  return (
    <section className="space-y-5 rounded-2xl border border-line bg-panel p-5" aria-label={`Plan: ${plan.name}`} data-testid="plan-editor">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => name.trim() && name !== plan.name && void act(() => updatePlan(plan.id, { name: name.trim() }))}
            aria-label="Plan name"
            className="font-display text-xl font-semibold"
            data-testid="plan-name"
          />
          <div className="mt-1 text-sm text-ink-dim tabular">
            {plan.items.length} workout{plan.items.length === 1 ? '' : 's'} · {formatDurationShort(total)}
            {event && ` · building to ${event.name ?? 'your event'} on ${DAY.format(dateKeyToMs(event.date))}`}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {plan.onCalendar ? (
            <Button disabled={busy} onClick={() => void act(() => takeOffCalendar(plan.id))} data-testid="plan-off-calendar">
              <CalendarX className="size-4" /> Take off calendar
            </Button>
          ) : (
            <Button variant="primary" disabled={busy || plan.items.length === 0} onClick={() => void act(async () => (await putOnCalendar(plan.id), onNotice({ tone: 'good', text: `${plan.name} is on your Calendar.` })))} data-testid="plan-on-calendar">
              <CalendarCheck className="size-4" /> Put on calendar
            </Button>
          )}
          <Button size="icon" variant="ghost" aria-label="Delete plan" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      {confirmDelete && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-bad/40 bg-bad/10 px-4 py-2 text-sm">
          Delete “{plan.name}”? Its workouts not yet ridden come off the calendar. The workouts stay in your library.
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button size="sm" variant="danger" onClick={() => void act(async () => (await deletePlan(plan.id), onDeleted()))} data-testid="plan-delete">
              Delete
            </Button>
          </div>
        </div>
      )}

      <div>
        <Field label="Ride days" hint="Workouts without a date of their own go on these days, in order.">
          <div className="flex flex-wrap gap-1" role="group" aria-label="Ride days">
            {WEEKDAYS.map((d, i) => (
              <button
                key={d}
                type="button"
                aria-pressed={plan.rideDays.includes(i)}
                onClick={() => void toggleDay(i)}
                disabled={busy}
                className={cn('rounded-lg border px-2.5 py-1.5 text-xs font-semibold', plan.rideDays.includes(i) ? 'border-accent bg-accent text-on-accent' : 'border-line bg-panel-2 text-ink-dim hover:text-ink')}
              >
                {d}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Starts">
          <Input type="date" value={plan.startDate} onChange={(e) => isDateKey(e.target.value) && void act(() => updatePlan(plan.id, { startDate: e.target.value }))} className="max-w-48" aria-label="Plan start date" data-testid="plan-start" />
        </Field>
      </div>

      {layout.warnings.length > 0 && (
        <ul className="space-y-1 rounded-xl border border-warn/40 bg-warn/10 px-4 py-2 text-xs" role="status">
          {layout.warnings.map((w) => (
            <li key={w.kind}>{warningText(w)}</li>
          ))}
        </ul>
      )}

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="eyebrow text-ink-faint">Workouts, in order</h3>
          <div className="flex gap-2">
            <input
              ref={fileInput}
              type="file"
              multiple
              accept={IMPORT_EXTENSIONS.join(',')}
              className="hidden"
              onChange={(e) => {
                if (e.target.files) void importFiles(e.target.files)
                e.target.value = ''
              }}
              data-testid="plan-import-input"
            />
            <Button size="sm" onClick={() => fileInput.current?.click()} disabled={busy} title="Files named YYYY-MM-DD_name go on that day; the rest fill your ride days in file-name order" data-testid="plan-import">
              <FileUp className="size-3.5" /> Import workout files
            </Button>
            <Button size="sm" onClick={() => setAdding((v) => !v)} aria-expanded={adding} data-testid="plan-add">
              <Plus className="size-3.5" /> Add workout
            </Button>
          </div>
        </div>
        {adding && <Picker library={library ?? []} onPick={(w) => void act(() => addToPlan(plan.id, w.workout.id))} onClose={() => setAdding(false)} />}
        {plan.items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-ink-faint">No workouts yet. Add some from your library, or import .zwo, .mrc, .erg or .txt files.</div>
        ) : (
          <ol className="space-y-1.5">
            {plan.items.map((item, i) => {
              const entry = byId.get(item.workoutId)
              const name = entry?.workout.name ?? (library ? 'Workout no longer in your library' : '…')
              const date = dateOf.get(i)
              return (
                <li key={item.id} className="flex items-center gap-3 rounded-xl border border-line bg-panel-2 px-3 py-2" data-testid="plan-item">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent font-display text-sm font-bold text-on-accent" aria-label={`Number ${i + 1} in your plan`}>
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{name}</div>
                    <div className="text-xs text-ink-dim tabular">
                      {entry && (entry.workout.ftpTest?.protocol === 'ramp' ? 'Ramp test, about 20 to 30 min · ' : `${formatDurationShort(entry.stats.durationS)}${entry.stats.tss !== null ? ` · TSS ${Math.round(entry.stats.tss)}` : ''} · `)}
                      <span data-testid="plan-item-date">
                        {item.removed
                          ? 'Removed from the calendar'
                          : date
                            ? `${DAY.format(dateKeyToMs(date))}${item.movedTo ? ' (moved on the calendar)' : item.date && plan.source !== 'ai' && plan.source !== 'builtin' ? ' (from the file name)' : ''}`
                            : 'No day yet'}
                      </span>
                    </div>
                  </div>
                  {(item.removed || item.movedTo) && (
                    <Button size="iconSm" variant="ghost" disabled={busy} onClick={() => void act(() => resetPlanWorkout(plan.id, item.id))} aria-label={`Put ${name} back on its day in the plan`} title="Put it back on its day in the plan">
                      <Undo2 className="size-3.5" />
                    </Button>
                  )}
                  <Button size="iconSm" variant="ghost" disabled={i === 0 || busy} onClick={() => void act(() => moveItem(plan.id, item.id, -1))} aria-label={`Move ${name} earlier`}>
                    <ArrowUp className="size-3.5" />
                  </Button>
                  <Button size="iconSm" variant="ghost" disabled={i === plan.items.length - 1 || busy} onClick={() => void act(() => moveItem(plan.id, item.id, 1))} aria-label={`Move ${name} later`}>
                    <ArrowDown className="size-3.5" />
                  </Button>
                  <Button size="iconSm" variant="ghost" disabled={busy} onClick={() => void act(() => takeOutOfPlan(plan.id, item.id))} aria-label={`Take ${name} out of the plan`}>
                    <X className="size-3.5" />
                  </Button>
                </li>
              )
            })}
          </ol>
        )}
      </div>
    </section>
  )
}

/** Search the library and add a workout to the plan. */
function Picker({ library, onPick, onClose }: { library: readonly LibraryEntry[]; onPick: (e: LibraryEntry) => void; onClose: () => void }) {
  const [q, setQ] = useState('')
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase()
    return library.filter((e) => !t || e.workout.name.toLowerCase().includes(t) || e.workout.tags.some((x) => x.includes(t))).slice(0, 8)
  }, [library, q])
  return (
    <div className="mb-3 rounded-xl border border-line bg-panel-2 p-3" data-testid="plan-picker">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
        <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your library" className="pl-9" aria-label="Search your library" onKeyDown={(e) => e.key === 'Escape' && onClose()} />
      </div>
      <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto">
        {shown.map((e) => (
          <li key={e.workout.id}>
            <button type="button" onClick={() => onPick(e)} className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-panel-3">
              <span className="truncate">{e.workout.name}</span>
              <span className="shrink-0 text-xs text-ink-dim tabular">
                {formatDurationShort(e.stats.durationS)}
                {e.stats.tss !== null && ` · ${Math.round(e.stats.tss)} TSS`}
              </span>
            </button>
          </li>
        ))}
        {shown.length === 0 && <li className="px-2 py-1.5 text-sm text-ink-faint">Nothing matches.</li>}
      </ul>
    </div>
  )
}
