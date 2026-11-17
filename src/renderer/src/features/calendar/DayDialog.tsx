import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import type { SessionWorkout } from '@core/multisport/model'
import type { DayMark } from '@core/workout/plan'
import { SPORT_GROUP_LABEL } from '@core/sport/group'
import { effortLoad } from '@core/sport/load'
import { addManualActivity } from '../../plan/activities-repo'
import { addMark, removeMark } from '../../plan/day-marks-repo'
import { scheduleSession, scheduleWorkout } from '../../plan/schedule-repo'
import { useSettings } from '../../stores/settings'
import { Button } from '../../ui/Button'
import { Dialog } from '../../ui/Dialog'
import { Field, Input } from '../../ui/form'
import { Segmented, type SegmentedOption } from '../../ui/Segmented'
import type { LibraryEntry } from '../../workouts/library'
import { planSessionWorkout } from '../../workouts/sessions-repo'
import { WorkoutPicker } from '../workouts/WorkoutPicker'
import { MARK_NAME, type CalendarDay } from './calendar'
import { SessionFields } from './SessionFields'
import { emptyDraft, readDraft, type SessionDraft } from './session-draft'

const DAY = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const KINDS: SegmentedOption<DayMark['kind']>[] = [
  { value: 'event', label: 'Event', hint: 'A race, a sportive, a big ride' },
  { value: 'rest', label: 'Rest day', hint: 'Plans leave it free' },
  { value: 'sick', label: 'Sick', hint: 'Plans leave it free' },
  { value: 'travel', label: 'Travel', hint: 'Plans leave it free' },
]
const PRIORITY: SegmentedOption<NonNullable<DayMark['priority']>>[] = [
  { value: 'A', label: 'A', hint: 'The one you build to' },
  { value: 'B', label: 'B', hint: 'Important, but not the goal' },
  { value: 'C', label: 'C', hint: 'Training race' },
]

export type DayMode = 'workout' | 'mark' | 'plan' | 'log'

const MODE_TITLE: Record<DayMode, string> = {
  workout: 'Pick a workout for this day, and it goes on the calendar.',
  mark: 'Mark an event, or a day you can’t ride. Plans on the calendar leave days off free and stop before their event.',
  plan: 'Plan a session of any sport: a run, a swim, a squash game, or a ride without a workout.',
  log: 'Log something you did that isn’t on the calendar yet: a squash game, a run without your watch.',
}

/**
 * One day: putting a workout on it, picked as on the Workouts page; its
 * events and days off, and adding another; planning a session of any sport;
 * and, on a day that has been, logging an activity. Opens on `mode`, else on
 * picking a workout.
 */
export function DayDialog({ day, mode: initialMode = 'workout', onClose }: { day: CalendarDay; mode?: DayMode; onClose: () => void }) {
  const canLog = day.isPast || day.isToday
  const modes: SegmentedOption<DayMode>[] = [
    { value: 'workout', label: 'Add a workout' },
    { value: 'mark', label: 'Event or day off' },
    { value: 'plan', label: 'Plan a session' },
    ...(canLog ? [{ value: 'log' as const, label: 'Log an activity' }] : []),
  ]
  const units = useSettings((s) => s.units)
  const [mode, setMode] = useState<DayMode>(initialMode)
  const [draft, setDraft] = useState<SessionDraft>(emptyDraft())
  const [kind, setKind] = useState<DayMark['kind']>('event')
  const [name, setName] = useState('')
  const [priority, setPriority] = useState<NonNullable<DayMark['priority']>>('A')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }
  const add = () =>
    act(async () => {
      if (kind === 'event' && !name.trim()) throw new Error('Name the event.')
      await addMark(kind === 'event' ? { date: day.key, kind, name: name.trim(), priority } : { date: day.key, kind })
      onClose()
    })
  const pick = (e: LibraryEntry) =>
    act(async () => {
      await scheduleWorkout(day.key, { id: e.workout.id, name: e.workout.name })
      onClose()
    })
  const pickSession = (w: SessionWorkout) =>
    act(async () => {
      await planSessionWorkout(day.key, w)
      onClose()
    })
  const plan = () =>
    act(async () => {
      const v = readDraft(draft, units, { needTime: false })
      const load = v.load ?? effortLoad(v.durationS, v.effort)
      await scheduleSession(day.key, v.group, v.label ?? SPORT_GROUP_LABEL[v.group], { label: v.label, durationS: v.durationS, distanceM: v.distanceM, effort: v.effort, load, notes: v.notes })
      onClose()
    })
  const log = () =>
    act(async () => {
      const v = readDraft(draft, units, { needTime: true })
      await addManualActivity({ date: day.key, group: v.group, label: v.label, durationS: v.durationS!, distanceM: v.distanceM, effort: v.effort, load: v.load, notes: v.notes })
      onClose()
    })
  const footer =
    mode === 'workout' ? undefined : mode === 'mark' ? (
      <Button variant="primary" onClick={() => void add()} disabled={busy} data-testid="day-mark-add">
        Add {kind === 'event' ? 'event' : MARK_NAME[kind].toLowerCase()}
      </Button>
    ) : mode === 'plan' ? (
      <Button variant="primary" onClick={() => void plan()} disabled={busy} data-testid="day-plan-add">
        Plan {SPORT_GROUP_LABEL[draft.group].toLowerCase()}
      </Button>
    ) : (
      <Button variant="primary" onClick={() => void log()} disabled={busy} data-testid="day-log-add">
        Log {SPORT_GROUP_LABEL[draft.group].toLowerCase()}
      </Button>
    )

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={DAY.format(day.date)}
      description={MODE_TITLE[mode]}
      footer={footer}
      className={mode === 'workout' ? 'w-[min(920px,calc(100vw-32px))]' : undefined}
    >
      <div className="space-y-4">
        <Segmented ariaLabel="What to add" value={mode} options={modes} onChange={(m) => (setMode(m), setError(null))} className="flex-wrap" />
        {day.marks.length > 0 && (
          <ul className="space-y-1.5" aria-label="On this day">
            {day.marks.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-panel-2 px-3 py-2 text-sm" data-testid="day-mark">
                <span>{m.kind === 'event' ? `${m.priority ?? 'A'} event: ${m.name ?? ''}` : MARK_NAME[m.kind]}</span>
                <Button size="iconSm" variant="ghost" onClick={() => void act(() => removeMark(m.id))} aria-label={`Remove ${m.kind === 'event' ? (m.name ?? 'event') : MARK_NAME[m.kind]}`}>
                  <Trash2 className="size-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
        {mode === 'workout' && <WorkoutPicker onPick={(e) => void pick(e)} onPickSession={(w) => void pickSession(w)} disabled={busy} />}
        {(mode === 'plan' || mode === 'log') && <SessionFields draft={draft} onChange={setDraft} idPrefix={mode === 'plan' ? 'plan' : 'log'} />}
        {mode === 'mark' && <Segmented ariaLabel="What kind of day" value={kind} options={KINDS} onChange={setKind} className="flex-wrap" />}
        {mode === 'mark' && kind === 'event' && (
          <>
            <Field label="Name">
              <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Gran fondo" aria-label="Event name" data-testid="day-mark-name" />
            </Field>
            <Field label="Priority" hint={PRIORITY.find((p) => p.value === priority)?.hint}>
              <Segmented ariaLabel="Event priority" value={priority} options={PRIORITY} onChange={setPriority} />
            </Field>
          </>
        )}
        {error && <p className="text-sm text-bad">{error}</p>}
      </div>
    </Dialog>
  )
}
