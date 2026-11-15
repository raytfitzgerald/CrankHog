import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { CalendarCheck, Plus } from 'lucide-react'
import { dateKey, dateKeyToMs } from '@core/workout/schedule'
import { db } from '../../db/db'
import { listPlans } from '../../plan/plans-repo'
import { Button } from '../../ui/Button'
import { cn } from '../../ui/cn'
import { useNow } from '../../ui/useNow'
import { NewPlanFlow } from './NewPlanFlow'
import { PlanEditor } from './PlanEditor'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const DAY_MS = 86_400_000

type Notice = { tone: 'good' | 'bad'; text: string }

/** The Training plan tab: your plans, Add a training plan, and the one you're editing (`selected`, else the latest). */
export function PlansPanel({ selected, onSelect, onNotice }: { selected: string | null; onSelect: (planId: string | null) => void; onNotice: (n: Notice) => void }) {
  const plans = useLiveQuery(() => listPlans(), [])
  const marks = useLiveQuery(() => db().dayMarks.toArray(), [])
  const [creating, setCreating] = useState(false)
  const now = useNow()
  const today = dateKeyToMs(dateKey(now))
  const current = plans?.find((p) => p.id === selected) ?? plans?.[0] ?? null

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="space-y-2" aria-label="Your plans">
        <Button variant="primary" className="w-full" onClick={() => setCreating(true)} data-testid="plan-new">
          <Plus className="size-4" /> Add a training plan
        </Button>
        {plans?.map((p) => {
          const event = p.eventId ? marks?.find((m) => m.id === p.eventId) : undefined
          const days = event ? Math.round((dateKeyToMs(event.date) - today) / DAY_MS) : null
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelect(p.id)}
              aria-current={current?.id === p.id}
              className={cn('block w-full rounded-xl border px-3 py-2.5 text-left', current?.id === p.id ? 'border-accent bg-accent/10' : 'border-line bg-panel hover:bg-panel-2')}
              data-testid="plan-card"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-semibold">{p.name}</span>
                {p.onCalendar && <CalendarCheck className="size-4 shrink-0 text-good" aria-label="On the calendar" />}
              </div>
              <div className="mt-0.5 text-xs text-ink-dim tabular">
                {p.items.length} workout{p.items.length === 1 ? '' : 's'}
                {p.rideDays.length > 0 && ` · ${p.rideDays.map((d) => WEEKDAYS[d]).join(' ')}`}
              </div>
              {event && days !== null && days >= 0 && (
                <div className="mt-0.5 text-xs text-ink-faint">
                  {event.name ?? 'Event'} {days === 0 ? 'is today' : `in ${days} day${days === 1 ? '' : 's'}`}
                </div>
              )}
            </button>
          )
        })}
        {plans && plans.length === 0 && <p className="px-1 text-sm text-ink-faint">No plans yet. Add one built around an event, from your own workout files, or from scratch.</p>}
      </aside>
      <div className="min-w-0">{current && <PlanEditor key={current.id} plan={current} onDeleted={() => onSelect(null)} onNotice={onNotice} />}</div>
      {creating && (
        <NewPlanFlow
          onClose={() => setCreating(false)}
          onCreated={(id, notice) => {
            setCreating(false)
            onSelect(id)
            if (notice) onNotice(notice)
          }}
        />
      )}
    </div>
  )
}
