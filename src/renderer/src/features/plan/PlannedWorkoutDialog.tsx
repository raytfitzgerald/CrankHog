import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Play, Trash2 } from 'lucide-react'
import { dateKeyToMs, isDateKey, type ScheduleStatus, type ScheduledWorkout } from '@core/workout/schedule'
import { moveScheduled, removeScheduled } from '../../plan/schedule-repo'
import { useRide } from '../../stores/ride'
import { Button } from '../../ui/Button'
import { Dialog } from '../../ui/Dialog'
import { Field, Input } from '../../ui/form'
import { getWorkout } from '../../workouts/library'
import { startWorkout } from '../workouts/start'

const DAY = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
const STATUS: Record<Exclude<ScheduleStatus, 'done'>, string> = { planned: 'Planned', today: 'Planned for today', missed: 'Missed' }

/** A planned workout from the calendar: ride it, move it to another day, or take it off. */
export function PlannedWorkoutDialog({ entry, status, planName, onClose }: { entry: ScheduledWorkout; status: Exclude<ScheduleStatus, 'done'>; planName?: string; onClose: () => void }) {
  const navigate = useNavigate()
  const riding = useRide((s) => s.active)
  const [date, setDate] = useState(entry.date)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const act = async (fn: () => Promise<void>) => {
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

  const ride = () =>
    act(async () => {
      const workout = entry.workout ?? (entry.workoutId ? await getWorkout(entry.workoutId) : null)
      if (!workout) throw new Error('That workout is no longer in your library.')
      await startWorkout(workout)
      onClose()
      await navigate({ to: '/ride' })
    })

  const move = () =>
    act(async () => {
      if (!isDateKey(date)) throw new Error('Pick a day.')
      await moveScheduled(entry.id, date)
      onClose()
    })

  const remove = () =>
    act(async () => {
      await removeScheduled(entry.id)
      onClose()
    })

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={entry.name}
      description={`${STATUS[status]}: ${DAY.format(dateKeyToMs(entry.date))}${planName ? `, from ${planName}` : ''}`}
      footer={
        <>
          <Button variant="ghost" onClick={() => void remove()} disabled={busy} data-testid="planned-remove">
            <Trash2 className="size-3.5" /> Remove
          </Button>
          <Button variant="primary" onClick={() => void ride()} disabled={busy || riding} data-testid="planned-ride">
            <Play className="size-3.5" /> Ride it now
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Move to">
          <div className="flex gap-2">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Move to day" className="max-w-48" data-testid="planned-date" />
            <Button onClick={() => void move()} disabled={busy || date === entry.date} data-testid="planned-move">
              Move
            </Button>
          </div>
        </Field>
        {entry.source === 'intervals' && <p className="text-xs text-ink-faint">From your intervals.icu calendar. The next import brings back what is planned there, so move or delete it there to keep the change.</p>}
        {entry.planId && <p className="text-xs text-ink-faint">Moved or removed, it stays that way when the plan changes. The plan keeps it, and can put it back on its own day.</p>}
        {riding && <p className="text-xs text-ink-dim">Finish the ride in progress to start this one.</p>}
        {error && <p className="text-sm text-bad">{error}</p>}
      </div>
    </Dialog>
  )
}
