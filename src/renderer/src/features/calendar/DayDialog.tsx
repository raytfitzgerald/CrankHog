import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import type { DayMark } from '@core/workout/plan'
import { addMark, removeMark } from '../../plan/day-marks-repo'
import { Button } from '../../ui/Button'
import { Dialog } from '../../ui/Dialog'
import { Field, Input } from '../../ui/form'
import { Segmented, type SegmentedOption } from '../../ui/Segmented'
import { MARK_NAME, type CalendarDay } from './calendar'

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

/** One day: its events and days off, and adding another. Plans on the calendar move off days off. */
export function DayDialog({ day, onClose }: { day: CalendarDay; onClose: () => void }) {
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

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={DAY.format(day.date)}
      description="Mark an event, or a day you can't ride. Plans on the calendar leave days off free and stop before their event."
      footer={
        <Button variant="primary" onClick={() => void add()} disabled={busy} data-testid="day-mark-add">
          Add {kind === 'event' ? 'event' : MARK_NAME[kind].toLowerCase()}
        </Button>
      }
    >
      <div className="space-y-4">
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
        <Segmented ariaLabel="What kind of day" value={kind} options={KINDS} onChange={setKind} className="flex-wrap" />
        {kind === 'event' && (
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
