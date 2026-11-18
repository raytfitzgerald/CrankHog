// Changes the coach proposed, as the rider decides on them: what changes, the
// calendar before and after, and Apply or Dismiss; Undo once applied.
// Nothing here is in the coach's voice: the card says plainly what happens.
import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import type { DayDiff } from '@core/coach-actions/actions'
import { formatSportDistance } from '@core/sport/format'
import { dateKeyToMs, type DateKey } from '@core/workout/schedule'
import { applyProposal, checkProposal, undoSteps, type CardItem, type CheckedProposal, type Side } from '../../ai/coach-actions'
import { setChangeState, useChangeState, type ChatCard } from '../../ai/coach-cards'
import { useSettings } from '../../stores/settings'
import { Button } from '../../ui/Button'
import { cn } from '../../ui/cn'
import { formatDate, formatDurationShort } from '../../ui/format'
import { SportIcon } from '../calendar/SportIcon'

const dayLabel = (d: DateKey) => formatDate(dateKeyToMs(d))

export function ChangesCard({ card }: { card: Extract<ChatCard, { kind: 'changes' }> }) {
  const s = useChangeState(card.id)
  const [checked, setChecked] = useState<CheckedProposal | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // what it would do, read against the calendar as it is now
  useEffect(() => {
    let live = true
    if (s.state === 'pending')
      void checkProposal(card.proposal, dayLabel)
        .then((c) => live && setChecked(c))
        .catch((e: unknown) => live && setError(e instanceof Error ? e.message : String(e)))
    return () => {
      live = false
    }
  }, [card.proposal, s.state])

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
  const apply = () => act(async () => void (await setChangeState(card.id, { state: 'applied', items: checked?.items ?? [], ...(await applyProposal(card.proposal)) })))
  const undo = () =>
    act(async () => {
      if (s.state !== 'applied') return
      await undoSteps(s.undo)
      await setChangeState(card.id, { state: 'undone', items: s.items })
    })

  const problems = checked?.problems ?? []
  const items = s.state === 'pending' ? checked?.items : s.items
  return (
    <div className="rounded-2xl border border-line bg-panel-2 px-4 py-3 text-sm" data-testid="coach-changes" data-state={s.state}>
      <div className="eyebrow text-ink-dim">Proposed changes</div>
      {card.proposal.summary && <p className="mt-1 font-semibold text-ink">{card.proposal.summary}</p>}
      {items ? (
        <ul className="mt-2 space-y-2" aria-label="Changes">
          {items.map((it, i) => (
            <Change key={i} item={it} />
          ))}
        </ul>
      ) : (
        !error && <Loader2 className="mt-2 size-4 animate-spin text-ink-dim" aria-label="Checking" />
      )}
      {s.state === 'pending' && checked && checked.diff.length > 0 && <CalendarDiff diff={checked.diff} />}
      {s.state === 'pending' && checked?.notes.map((n) => <p key={n} className="mt-2 text-xs text-ink-dim">{n}</p>)}
      {s.state === 'pending' && problems.length === 0 && checked?.warnings.map((w) => <p key={w} className="mt-2 text-xs text-warn" data-testid="coach-change-warning">{w}</p>)}
      {s.state === 'pending' && problems.length > 0 && (
        <div className="mt-2 rounded-lg border border-bad/40 bg-bad/5 px-3 py-2" data-testid="coach-change-problems">
          <div className="font-semibold">This can't be applied</div>
          <ul className="mt-1 space-y-0.5 text-xs text-ink-dim">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      )}
      {error && (
        <p className="mt-2 text-bad" role="alert">
          {error}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {s.state === 'pending' && (
          <>
            <Button size="sm" variant="primary" onClick={() => void apply()} disabled={busy || !checked || problems.length > 0} data-testid="coach-change-apply">
              {busy && <Loader2 className="size-3.5 animate-spin" />} Apply
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void setChangeState(card.id, { state: 'dismissed', items: checked?.items ?? [] })} disabled={busy} data-testid="coach-change-dismiss">
              Dismiss
            </Button>
          </>
        )}
        {s.state === 'applied' && (
          <>
            <span className="font-semibold text-good" data-testid="coach-change-status">
              Applied
            </span>
            <Button size="sm" variant="secondary" onClick={() => void undo()} disabled={busy} data-testid="coach-change-undo">
              {busy && <Loader2 className="size-3.5 animate-spin" />} Undo
            </Button>
            {s.workouts
              .filter((w) => w.sport === 'ride' || w.sport === 'run' || w.sport === 'swim')
              .map((w) => (
                <Button key={w.id} size="sm" variant="ghost" asChild>
                  <Link to="/builder" search={w.sport === 'ride' ? { id: w.id } : { sport: w.sport as 'run' | 'swim', session: w.id }} data-testid="coach-change-builder">
                    Open {w.name} in the builder
                  </Link>
                </Button>
              ))}
          </>
        )}
        {s.state === 'dismissed' && (
          <span className="text-ink-dim" data-testid="coach-change-status">
            Dismissed: nothing changed
          </span>
        )}
        {s.state === 'undone' && (
          <span className="text-ink-dim" data-testid="coach-change-status">
            Undone: everything is as it was
          </span>
        )}
      </div>
    </div>
  )
}

/** One change: what it does, the coach's reason, and the session before and after. */
function Change({ item }: { item: CardItem }) {
  return (
    <li className="flex gap-2">
      <span aria-hidden className="text-ink-faint">
        ·
      </span>
      <span className="min-w-0 flex-1">
        <span className="block" data-testid="coach-change-line">
          {item.line}
        </span>
        {item.why && <span className="block text-xs text-ink-dim">{item.why}</span>}
        {(item.before || item.after) && (
          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs" data-testid="coach-change-sides">
            {item.before && <SideTag side={item.before} gone={!!item.after || !!item.removed} />}
            {item.before && item.after && (
              <span aria-label="becomes" className="text-ink-faint">
                →
              </span>
            )}
            {item.after && <SideTag side={item.after} />}
          </span>
        )}
      </span>
    </li>
  )
}

/** A session in a few words: its sport, length, distance and load. */
function SideTag({ side, gone = false }: { side: Side; gone?: boolean }) {
  const units = useSettings((s) => s.units)
  const facts = [
    side.durationS ? formatDurationShort(side.durationS) : null,
    side.distanceM ? formatSportDistance(side.distanceM, side.sport, units) : null,
    side.load !== null ? `${Math.round(side.load)} load` : null,
  ].filter(Boolean)
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1.5 rounded-md bg-panel px-2 py-0.5', gone ? 'text-ink-faint' : 'text-ink')}>
      <SportIcon sport={side.sport} className="size-3.5 shrink-0" aria-hidden />
      <span className={cn('truncate', gone && 'line-through')}>{side.name}</span>
      {facts.length > 0 && <span className="shrink-0 tabular text-ink-dim">{facts.join(' · ')}</span>}
    </span>
  )
}

/** The days the changes touch, before and after: what goes, what comes, days off and events. */
function CalendarDiff({ diff }: { diff: readonly DayDiff[] }) {
  return (
    <div className="mt-3 rounded-lg border border-line bg-panel px-3 py-2" aria-label="Calendar before and after" data-testid="coach-change-diff">
      <div className="eyebrow mb-1 text-ink-dim">Calendar</div>
      <ul className="space-y-1.5">
        {diff.map((d) => (
          <li key={d.date} className="flex gap-3" data-testid="coach-diff-day">
            <span className="w-28 shrink-0 pt-0.5 text-xs tabular text-ink-dim">{dayLabel(d.date)}</span>
            <span className="min-w-0 flex-1 space-y-0.5">
              {d.marks.map((m, i) => (
                <span key={`m${i}`} className={cn('block text-xs font-semibold', m.change === 'removed' ? 'text-ink-faint line-through' : 'text-warn')}>
                  {m.change === 'added' ? '+ ' : ''}
                  {m.label}
                </span>
              ))}
              {d.rows.map((r, i) => (
                <span key={i} className={cn('flex items-center gap-1.5', r.change === 'removed' && 'text-ink-faint line-through', r.change === 'added' && 'font-semibold text-good', r.change === 'same' && 'text-ink-dim')}>
                  <SportIcon sport={r.sport} className="size-3.5 shrink-0" aria-hidden />
                  <span className="truncate">
                    {r.change === 'added' ? '+ ' : ''}
                    {r.name}
                  </span>
                </span>
              ))}
              {d.rows.length === 0 && d.marks.length === 0 && <span className="text-xs text-ink-faint">Nothing planned</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
