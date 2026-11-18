// A plan the coach drafted, for the rider to review before anything is saved:
// its phases, hours a week of each sport, key sessions, and every session
// week by week, steps and all. The rider tells the coach what to change (a
// revision comes back as a new card) or accepts it, which saves it as a
// race-anchored plan with every session on its day. Plain content: the
// coach's persona stays in the chat.
import { useEffect, useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ChevronDown, Loader2 } from 'lucide-react'
import type { OutlinePhase, PlanDraft } from '@core/coach-plan/draft'
import { weekStart } from '@core/coach-plan/brief'
import { WEEKDAY_SHORT } from '@core/plan-import/model'
import { dateKeyToMs, type DateKey } from '@core/workout/schedule'
import { acceptDraft, prepareDraft, undoAccept, useDraft, type DraftRecord } from '../../ai/coach-plan'
import type { ImportProblem, PreparedImport, ReadyItem } from '../../plan/doc-import'
import { Button } from '../../ui/Button'
import { cn } from '../../ui/cn'
import { formatDate, formatDurationShort } from '../../ui/format'
import { SportIcon } from '../calendar/SportIcon'

const dayLabel = (d: DateKey) => formatDate(dateKeyToMs(d))
const SPORT_GROUP = { bike: 'ride', run: 'run', swim: 'swim', other: 'other' } as const
const SPORT_NAME = { bike: 'Bike', run: 'Run', swim: 'Swim', other: 'Strength and other' } as const
const PHASE_NAME: Record<OutlinePhase, string> = { base: 'Base', build: 'Build', peak: 'Peak', taper: 'Taper', recovery: 'Recovery' }
/** How each phase's weeks look in the weekly chart: theme tokens only. */
const PHASE_BAR: Record<OutlinePhase, string> = { base: 'bg-accent/45', build: 'bg-accent/75', peak: 'bg-accent', taper: 'bg-good/70', recovery: 'bg-ink-faint/40' }
const hours = (s: number) => `${Math.round((s / 3600) * 10) / 10} h`

export function PlanDraftCard({ id }: { id: string }) {
  const r = useDraft(id)
  if (!r) return <div className="rounded-2xl border border-line bg-panel-2 px-4 py-3 text-sm text-ink-dim">This draft is no longer kept.</div>
  if (r.status === 'drafting') return <Drafting r={r} />
  if (r.status === 'failed')
    return (
      <div className="rounded-2xl border border-bad/40 bg-bad/5 px-4 py-3 text-sm" data-testid="coach-plan" data-state="failed">
        <div className="eyebrow text-ink-dim">Draft plan</div>
        <p className="mt-1">
          Couldn't draft {r.name}: {r.error}
        </p>
      </div>
    )
  if (r.status === 'superseded' || !r.draft)
    return (
      <div className="rounded-2xl border border-line bg-panel-2 px-4 py-2.5 text-sm text-ink-dim" data-testid="coach-plan" data-state="superseded">
        Draft {r.version} of {r.name}, replaced by a revision.
      </div>
    )
  return <Draft r={r} draft={r.draft} />
}

function Drafting({ r }: { r: DraftRecord }) {
  const p = r.progress ?? { done: 0, total: 1, what: 'Drafting' }
  const pct = Math.round((100 * p.done) / Math.max(1, p.total))
  return (
    <div className="rounded-2xl border border-line bg-panel-2 px-4 py-3 text-sm" data-testid="coach-plan" data-state="drafting">
      <div className="eyebrow text-ink-dim">{r.version > 1 ? `Revising: draft ${r.version}` : 'Draft plan'}</div>
      <div className="mt-1 font-display text-lg">{r.name}</div>
      <div className="mt-2 flex items-center gap-2 text-ink-dim">
        <Loader2 className="size-4 animate-spin" />
        <span>
          {p.what}
          {p.total > 1 ? ` · ${p.done} of ${p.total}` : ''}
        </span>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-panel-3" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Drafting">
        <div className="h-1.5 rounded-full bg-accent transition-[width]" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 text-xs text-ink-faint">A long plan takes a few minutes. You can keep chatting or leave the page.</p>
    </div>
  )
}

interface Week {
  week: number
  monday: DateKey
  phase: OutlinePhase
  focus: string
  sessions: ReadyItem[]
  seconds: number
}

function Draft({ r, draft }: { r: DraftRecord; draft: PlanDraft }) {
  const [prepared, setPrepared] = useState<PreparedImport | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    void prepareDraft(draft)
      .then((p) => live && setPrepared(p))
      .catch((e: unknown) => live && setError(e instanceof Error ? e.message : String(e)))
    return () => {
      live = false
    }
  }, [draft])

  const weeks = useMemo<Week[]>(() => {
    const byWeek = new Map<number, ReadyItem[]>()
    for (const x of prepared?.ready ?? []) if (x.item.week !== undefined) byWeek.set(x.item.week, [...(byWeek.get(x.item.week) ?? []), x])
    return draft.outline.weeks.map((w) => {
      const sessions = byWeek.get(w.week) ?? []
      return { week: w.week, monday: weekStart(draft.span, w.week), phase: w.phase, focus: w.focus, sessions, seconds: sessions.reduce((n, x) => n + (x.durationS ?? 0), 0) }
    })
  }, [draft, prepared])

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

  const accepted = r.status === 'accepted' ? r.accepted : undefined
  const race = draft.brief.race
  const failed: ImportProblem[] = [...(prepared?.failed ?? []), ...draft.problems]
  return (
    <div className="rounded-2xl border border-line bg-panel-2 px-4 py-3 text-sm" data-testid="coach-plan" data-state={r.status}>
      <div className="eyebrow text-ink-dim">{accepted ? 'Training plan, saved' : `Draft plan · version ${r.version}`}</div>
      <div className="mt-1 font-display text-lg">{draft.brief.name}</div>
      <p className="text-ink-dim" data-testid="coach-plan-span">
        {draft.span.weeks} weeks from {dayLabel(draft.span.start)}
        {race ? ` to ${race.name}, ${dayLabel(race.date)}` : ''}
      </p>
      {draft.outline.notes && <p className="mt-2 leading-relaxed">{draft.outline.notes}</p>}
      {draft.notes.map((n) => (
        <p key={n} className="mt-1 text-xs text-ink-dim">
          {n}
        </p>
      ))}

      {!prepared ? (
        !error && <Loader2 className="mt-3 size-4 animate-spin text-ink-dim" aria-label="Checking the sessions" />
      ) : (
        <>
          <WeeklyChart weeks={weeks} />
          <Phases draft={draft} weeks={weeks} />
          <SportHours prepared={prepared} weeks={draft.span.weeks} />
          <WeekList weeks={weeks} />
          {(failed.length > 0 || prepared.leftOut.length > 0) && (
            <details className="mt-3 rounded-lg border border-bad/40 bg-bad/5 px-3 py-2" data-testid="coach-plan-problems">
              <summary className="cursor-pointer font-semibold">
                {failed.length + prepared.leftOut.length} left out: {failed.length > 0 ? "CrankHog couldn't read them" : 'on or after race day'}
              </summary>
              <ul className="mt-1 space-y-1 text-xs">
                {[...failed, ...prepared.leftOut].map((p, i) => (
                  <li key={i}>
                    <span className="text-ink-dim">{p.where}</span>
                    {p.name && <span className="font-semibold"> · {p.name}</span>}
                    <span className="block text-ink-dim">{p.reason}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}

      {error && (
        <p className="mt-2 text-bad" role="alert">
          {error}
        </p>
      )}
      {accepted ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <span className="font-semibold text-good" data-testid="coach-plan-status">
            On your calendar: {accepted.sessions} sessions{accepted.first && accepted.last ? `, ${dayLabel(accepted.first)} to ${dayLabel(accepted.last)}` : ''}
            {race ? `, with ${race.name} as an A race` : ''}.
          </span>
          <Button size="sm" variant="ghost" asChild>
            <Link to="/calendar">Open the calendar</Link>
          </Button>
          <Button size="sm" variant="secondary" onClick={() => void act(() => undoAccept(r.id))} disabled={busy} data-testid="coach-plan-undo">
            {busy && <Loader2 className="size-3.5 animate-spin" />} Undo
          </Button>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-line pt-3">
          <Button size="sm" variant="primary" onClick={() => void act(() => acceptDraft(r.id))} disabled={busy || !prepared || prepared.ready.length === 0} data-testid="coach-plan-accept">
            {busy && <Loader2 className="size-3.5 animate-spin" />} Accept and add to calendar
          </Button>
          <span className="text-xs text-ink-dim">Or tell the coach what to change.</span>
        </div>
      )}
    </div>
  )
}

/** Hours a week, a bar a week, shaded by phase. */
function WeeklyChart({ weeks }: { weeks: readonly Week[] }) {
  const most = Math.max(1, ...weeks.map((w) => w.seconds))
  return (
    <div className="mt-3" aria-label="Hours a week" role="img">
      <div className="flex h-16 items-end gap-px">
        {weeks.map((w) => (
          <div key={w.week} className={cn('min-w-0 flex-1 rounded-t-sm', PHASE_BAR[w.phase])} style={{ height: `${Math.max(4, (100 * w.seconds) / most)}%` }} title={`Week ${w.week}: ${hours(w.seconds)}, ${PHASE_NAME[w.phase].toLowerCase()}`} />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[11px] tabular text-ink-faint">
        <span>Week 1</span>
        <span>Most {hours(most)}</span>
        <span>Week {weeks.length}</span>
      </div>
    </div>
  )
}

/** The phases in order, each with its weeks, hours and key sessions; recovery weeks named within their phase. */
function Phases({ draft, weeks }: { draft: PlanDraft; weeks: readonly Week[] }) {
  const runs: { phase: OutlinePhase; from: number; to: number; recovery: number[]; key: string[] }[] = []
  for (const w of draft.outline.weeks) {
    const last = runs.at(-1)
    if (w.phase === 'recovery' && last) last.recovery.push(w.week)
    else if (last && last.phase === w.phase) last.to = w.week
    else runs.push({ phase: w.phase, from: w.week, to: w.week, recovery: [], key: w.keySessions })
  }
  for (const run of runs) run.to = Math.max(run.to, ...run.recovery)
  const range = (a: number, b: number) => (a === b ? `week ${a}` : `weeks ${a}-${b}`)
  return (
    <ul className="mt-3 space-y-1.5" aria-label="Phases" data-testid="coach-plan-phases">
      {runs.map((run) => {
        const span = weeks.filter((w) => w.week >= run.from && w.week <= run.to && !run.recovery.includes(w.week))
        const lo = Math.min(...span.map((w) => w.seconds))
        const hi = Math.max(...span.map((w) => w.seconds))
        return (
          <li key={run.from} className="flex gap-3">
            <span className={cn('mt-1.5 size-2.5 shrink-0 rounded-sm', PHASE_BAR[run.phase])} aria-hidden />
            <span className="min-w-0">
              <span className="font-semibold">{PHASE_NAME[run.phase]}</span>
              <span className="text-ink-dim">
                {' '}
                · {range(run.from, run.to)}
                {span.length > 0 && ` · ${lo === hi ? hours(hi) : `${hours(lo)} to ${hours(hi)}`} a week`}
                {run.recovery.length > 0 && ` · recovery in week${run.recovery.length > 1 ? 's' : ''} ${run.recovery.join(', ')}`}
              </span>
              {run.key.length > 0 && <span className="block text-xs text-ink-dim">Key: {run.key.join(', ')}</span>}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

/** Each sport's hours a week, on average and at the most. */
function SportHours({ prepared, weeks }: { prepared: PreparedImport; weeks: number }) {
  const sports = (['swim', 'bike', 'run', 'other'] as const)
    .map((s) => {
      const per = new Map<number, number>()
      for (const x of prepared.ready) if (x.item.sport === s && x.item.week !== undefined) per.set(x.item.week, (per.get(x.item.week) ?? 0) + (x.durationS ?? 0))
      const total = [...per.values()].reduce((a, b) => a + b, 0)
      return { s, total, most: Math.max(0, ...per.values()), count: prepared.ready.filter((x) => x.item.sport === s).length }
    })
    .filter((x) => x.count > 0)
  return (
    <table className="mt-3 w-full text-left text-xs" data-testid="coach-plan-sports">
      <thead className="text-ink-faint">
        <tr>
          <th className="font-normal">Sport</th>
          <th className="font-normal">Sessions</th>
          <th className="font-normal">A week on average</th>
          <th className="font-normal">Biggest week</th>
        </tr>
      </thead>
      <tbody className="tabular">
        {sports.map((x) => (
          <tr key={x.s}>
            <td className="flex items-center gap-1.5 py-0.5">
              <SportIcon sport={SPORT_GROUP[x.s]} className="size-3.5 text-ink-dim" aria-hidden />
              {SPORT_NAME[x.s]}
            </td>
            <td>{x.count}</td>
            <td>{hours(x.total / weeks)}</td>
            <td>{hours(x.most)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** Every week, folded: its sessions, each with its steps. */
function WeekList({ weeks }: { weeks: readonly Week[] }) {
  return (
    <div className="mt-3 max-h-96 space-y-1 overflow-y-auto" aria-label="Week by week">
      {weeks.map((w) => (
        <details key={w.week} className="group rounded-lg bg-panel px-3 py-1.5" data-testid="coach-plan-week">
          <summary className="flex cursor-pointer list-none items-center gap-2">
            <span className="w-16 shrink-0 font-semibold">Week {w.week}</span>
            <span className="w-24 shrink-0 text-xs tabular text-ink-dim">{dayLabel(w.monday)}</span>
            <span className="min-w-0 flex-1 truncate text-xs text-ink-dim">
              {PHASE_NAME[w.phase]} · {w.focus}
            </span>
            <span className="shrink-0 text-xs tabular text-ink-dim">
              {w.sessions.length} · {hours(w.seconds)}
            </span>
            <ChevronDown className="size-3.5 shrink-0 text-ink-faint transition-transform group-open:rotate-180" />
          </summary>
          <ol className="mt-1.5 space-y-1 pb-1">
            {w.sessions.map((x, i) => (
              <li key={i} data-testid="coach-plan-session">
                <details className="group/s">
                  <summary className="flex cursor-pointer list-none items-center gap-2 text-sm">
                    <span className="w-24 shrink-0 text-xs tabular text-ink-dim">{x.date ? dayLabel(x.date) : WEEKDAY_SHORT[x.item.weekday ?? 0]}</span>
                    <SportIcon sport={SPORT_GROUP[x.item.sport]} workout={x.kind === 'bike'} className="size-4 shrink-0 text-ink-dim" aria-label={x.item.sport} />
                    <span className="min-w-0 flex-1 truncate">{x.item.name}</span>
                    <span className="shrink-0 text-xs tabular text-ink-dim">{x.durationS ? formatDurationShort(x.durationS) : '—'}</span>
                  </summary>
                  <div className="ml-26 mt-1 space-y-1 pl-2 text-xs text-ink-dim">
                    {x.item.steps ? <pre className="whitespace-pre-wrap font-sans">{x.item.steps}</pre> : <p>{x.item.minutes ? `${x.item.minutes} min, ${x.item.effort ?? 'easy'}` : ''}</p>}
                    {x.item.notes && <p>{x.item.notes}</p>}
                  </div>
                </details>
              </li>
            ))}
            {w.sessions.length === 0 && <li className="text-xs text-ink-faint">No sessions</li>}
          </ol>
        </details>
      ))}
    </div>
  )
}
