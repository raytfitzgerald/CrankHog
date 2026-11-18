// Changes the coach proposed, as the rider decides on them: what changes, the
// calendar before and after, and Apply or Dismiss; Undo once applied.
// Nothing here is in the coach's voice: the card says plainly what happens.
import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import type { DayDiff } from '@core/coach-actions/actions'
import { dateKeyToMs, type DateKey } from '@core/workout/schedule'
import { applyProposal, checkProposal, undoSteps, type CheckedProposal } from '../../ai/coach-actions'
import { setChangeState, useChangeState, type ChatCard } from '../../ai/coach-cards'
import { Button } from '../../ui/Button'
import { cn } from '../../ui/cn'
import { formatDate } from '../../ui/format'
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
  const apply = () => act(async () => void (await setChangeState(card.id, { state: 'applied', lines: checked?.lines ?? [], ...(await applyProposal(card.proposal)) })))
  const undo = () =>
    act(async () => {
      if (s.state !== 'applied') return
      await undoSteps(s.undo)
      await setChangeState(card.id, { state: 'undone', lines: s.lines })
    })

  const problems = checked?.problems ?? []
  const lines = s.state === 'pending' ? checked?.lines : s.lines
  return (
    <div className="rounded-2xl border border-line bg-panel-2 px-4 py-3 text-sm" data-testid="coach-changes" data-state={s.state}>
      <div className="eyebrow text-ink-dim">Proposed changes</div>
      {card.proposal.summary && <p className="mt-1 font-semibold text-ink">{card.proposal.summary}</p>}
      {lines ? (
        <ul className="mt-2 space-y-1" aria-label="Changes">
          {lines.map((l, i) => (
            <li key={i} className="flex gap-2">
              <span aria-hidden className="text-ink-faint">
                ·
              </span>
              <span data-testid="coach-change-line">{l}</span>
            </li>
          ))}
        </ul>
      ) : (
        !error && <Loader2 className="mt-2 size-4 animate-spin text-ink-dim" aria-label="Checking" />
      )}
      {s.state === 'pending' && checked && checked.diff.length > 0 && <CalendarDiff diff={checked.diff} />}
      {s.state === 'pending' && checked?.notes.map((n) => <p key={n} className="mt-2 text-xs text-ink-dim">{n}</p>)}
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
            <Button size="sm" variant="ghost" onClick={() => void setChangeState(card.id, { state: 'dismissed', lines: checked?.lines ?? [] })} disabled={busy} data-testid="coach-change-dismiss">
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
