import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useBlocker, useNavigate } from '@tanstack/react-router'
import { ArrowDown, ArrowUp, CalendarPlus, Loader2, Plus, Save, X } from 'lucide-react'
import { describeSession, sessionFromFile } from '@core/multisport/build'
import { draftFromText, draftText, newDraft, newStep, runPer, swimPer, type BuildSport, type DraftSection, type DraftStep, type LengthUnit, type SessionDraft, type TargetKind } from '@core/multisport/draft'
import type { PoolLength, SessionWorkout } from '@core/multisport/model'
import { formatSportDistance } from '@core/sport/format'
import { dateKey, dateKeyToMs, isDateKey } from '@core/workout/schedule'
import { useSettings } from '../../stores/settings'
import { Button } from '../../ui/Button'
import { Dialog } from '../../ui/Dialog'
import { Field, Input, Select } from '../../ui/form'
import { formatDurationShort } from '../../ui/format'
import { PageHeader } from '../../ui/PageHeader'
import { Segmented } from '../../ui/Segmented'
import { cn } from '../../ui/cn'
import { getSessionWorkout, planSessionWorkout, saveSessionWorkout, sessionThresholds } from '../../workouts/sessions-repo'
import { FormatGuideLink } from '../sessions/FormatGuide'
import { SessionSteps } from '../sessions/SessionSteps'
import { AiPanel } from './AiPanel'
import { draftSession } from './ai-draft'
import { SaveState } from './BuilderEditor'
import { Notice, type NoticeMessage } from './Notice'

type Mode = 'steps' | 'text'
const MODES = [
  { value: 'steps' as const, label: 'Steps', hint: 'Build it section by section, step by step' },
  { value: 'text' as const, label: 'Text', hint: 'Type it in intervals.icu syntax, as in a session file' },
]
const DAY = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' })

const UNITS: Record<BuildSport, { value: LengthUnit; label: string }[]> = {
  run: [
    { value: 'min', label: 'min' },
    { value: 'sec', label: 'sec' },
    { value: 'km', label: 'km' },
    { value: 'mtr', label: 'm' },
    { value: 'mi', label: 'mi' },
  ],
  swim: [
    { value: 'mtr', label: 'm' },
    { value: 'y', label: 'yd' },
    { value: 'min', label: 'min' },
    { value: 'sec', label: 'sec' },
  ],
}
const TARGETS: Record<BuildSport, { value: TargetKind; label: string }[]> = {
  run: [
    { value: 'none', label: 'No target' },
    { value: 'hrZone', label: 'HR zone' },
    { value: 'paceZone', label: 'Pace zone' },
    { value: 'pace', label: 'Pace' },
    { value: 'pacePct', label: '% threshold pace' },
    { value: 'lthrPct', label: '% threshold HR' },
    { value: 'bpm', label: 'Heart rate' },
  ],
  swim: [
    { value: 'none', label: 'No target' },
    { value: 'paceZone', label: 'Pace zone' },
    { value: 'pace', label: 'Pace' },
    { value: 'pacePct', label: '% of CSS' },
    { value: 'hrZone', label: 'HR zone' },
  ],
}
const PLACEHOLDER: Partial<Record<TargetKind, string>> = { pace: '4:10-4:20', pacePct: '90-95', lthrPct: '80-85', bpm: '140-150' }
const SUFFIX: Partial<Record<TargetKind, string>> = { pacePct: '%', lthrPct: '%', bpm: 'bpm' }
const ZONES = [1, 2, 3, 4, 5, 6, 7]
type StepMessage = { text: string; bad: boolean }
const ASK_PLACEHOLDER: Record<BuildSport, string> = {
  run: 'e.g. 50 min with 6 x 3 min hard, jog recoveries',
  swim: 'e.g. 10 x 100 at CSS, drills in the warm-up',
}
const POOLS: { value: PoolLength; label: string }[] = [
  { value: '25m', label: '25 m pool' },
  { value: '50m', label: '50 m pool' },
  { value: '25y', label: '25 yd pool' },
]

/** /builder?sport=run|swim (and &session=… to edit one): opens the session, or a new one, in a fresh editor. */
export function SessionBuilderPage({ sport, session, sportSwitch }: { sport: BuildSport; session: string | undefined; sportSwitch: ReactNode }) {
  const [open, setOpen] = useState<{ key: string; stored: SessionWorkout | null; sport: BuildSport } | null>(null)
  // the session the editor has open: a save puts its id in the URL, and that mustn't reopen it
  const openId = useRef<string | null>(null)
  useEffect(() => {
    if (session !== undefined && session === openId.current) return
    let live = true
    void (session ? getSessionWorkout(session) : Promise.resolve(undefined)).then((w) => {
      if (!live) return
      const stored = w && (w.sport === 'run' || w.sport === 'swim') ? w : null
      openId.current = stored?.id ?? null
      setOpen({ key: `${sport}:${stored?.id ?? 'new'}:${Date.now()}`, stored, sport: (stored?.sport as BuildSport | undefined) ?? sport })
    })
    return () => {
      live = false
    }
  }, [session, sport])
  if (!open) {
    return (
      <div className="mx-auto max-w-7xl px-4 md:px-8 pb-12">
        <PageHeader title="Workout builder" subtitle="Opening…" />
      </div>
    )
  }
  return <SessionEditor key={open.key} sport={open.sport} stored={open.stored} sportSwitch={sportSwitch} onSaved={(id) => (openId.current = id)} />
}

function SessionEditor({ sport, stored: initialStored, sportSwitch, onSaved }: { sport: BuildSport; stored: SessionWorkout | null; sportSwitch: ReactNode; onSaved: (id: string) => void }) {
  const units = useSettings((s) => s.units)
  const per = runPer(units)
  const loaded = useLiveQuery(() => sessionThresholds(), [])
  const thresholds = useMemo(() => loaded ?? {}, [loaded])
  const navigate = useNavigate()
  const [stored, setStored] = useState(initialStored)
  // a stored session that can't be steps (no steps, or an error) opens as text
  const opened = useMemo(() => (initialStored ? draftFromText(initialStored.text, per) : { draft: newDraft(sport) }), [initialStored, sport, per])
  const [draft, setDraft] = useState<SessionDraft>('draft' in opened ? opened.draft : newDraft(sport))
  const [mode, setMode] = useState<Mode>('draft' in opened ? 'steps' : 'text')
  const [text, setText] = useState(initialStored?.text ?? '')
  const [savedText, setSavedText] = useState(() => initialStored?.text ?? draftText(draft, per).text)
  const [notice, setNotice] = useState<NoticeMessage | null>('error' in opened ? { tone: 'info', text: `Opened as text: ${opened.error}` } : null)
  const [busy, setBusy] = useState(false)
  const [planDate, setPlanDate] = useState(() => dateKey(Date.now()))

  const written = useMemo(() => draftText(draft, per), [draft, per])
  const current = mode === 'steps' ? written.text : text
  const name = mode === 'steps' ? draft.name : undefined
  const read = useMemo(() => sessionFromFile(`${name ?? 'Session'}.txt`, current, thresholds, 0), [name, current, thresholds])
  const estimate = useMemo(() => (read.workout ? describeSession(read.workout, thresholds).estimate : null), [read, thresholds])
  const dirty = current !== savedText
  // each message about a step line goes on that step, in Steps mode
  const onStep = useMemo(() => {
    const at = new Map<string, StepMessage[]>()
    if (mode !== 'steps') return at
    for (const m of [...read.errors.map((e) => ({ ...e, bad: true })), ...read.warnings.map((w) => ({ ...w, bad: false }))]) {
      const where = m.line !== undefined ? written.steps.get(m.line) : undefined
      if (!where) continue
      const key = `${where.section}:${where.step}`
      at.set(key, [...(at.get(key) ?? []), { text: m.text, bad: m.bad }])
    }
    return at
  }, [mode, read, written])
  const general = [...read.errors, ...read.warnings].filter((m) => mode === 'text' || m.line === undefined || !written.steps.has(m.line))

  const blocker = useBlocker({ shouldBlockFn: () => true, disabled: !dirty, withResolver: true, enableBeforeUnload: false })

  const setSections = (fn: (s: DraftSection[]) => DraftSection[]) => setDraft((d) => ({ ...d, sections: fn(d.sections) }))
  const setSection = (si: number, patch: Partial<DraftSection>) => setSections((ss) => ss.map((s, i) => (i === si ? { ...s, ...patch } : s)))
  const setStep = (si: number, sti: number, patch: Partial<DraftStep>) => setSection(si, { steps: draft.sections[si]!.steps.map((st, i) => (i === sti ? { ...st, ...patch } : st)) })
  const move = <T,>(list: T[], i: number, by: number) => {
    const j = i + by
    if (j < 0 || j >= list.length) return list
    const next = [...list]
    ;[next[i], next[j]] = [next[j]!, next[i]!]
    return next
  }
  const setPool = (pool: PoolLength) =>
    // a length's number stays and its unit follows the pool: 100 in a 25 yd pool is 100 yd
    setDraft((d) => ({ ...d, pool, sections: d.sections.map((s) => ({ ...s, steps: s.steps.map((st) => (st.unit === 'mtr' || st.unit === 'y' ? { ...st, unit: pool === '25y' ? 'y' : 'mtr' } : st)) })) }))

  const pickMode = (m: Mode) => {
    if (m === mode) return
    if (m === 'text') {
      setText(written.text)
      setMode('text')
      return
    }
    const r = draftFromText(text, per)
    if ('error' in r) {
      setNotice({ tone: 'bad', text: `Can't show this as steps yet: ${r.error}` })
      return
    }
    setNotice(null)
    setDraft(r.draft)
    setMode('steps')
  }

  /** Saves (and plans, given a day). `syncUrl` puts its id in the URL; not when leaving, where the guard goes on. */
  const save = async ({ planOn, syncUrl = true }: { planOn?: string; syncUrl?: boolean } = {}): Promise<boolean> => {
    if (!read.workout) {
      setNotice({ tone: 'bad', text: 'Fix the problems marked in red first.' })
      return false
    }
    setBusy(true)
    try {
      const now = Date.now()
      // an edited session keeps its id, so plans and the calendar still find it
      const w = await saveSessionWorkout({ ...read.workout, ...(stored ? { id: stored.id } : {}), source: 'user', createdAt: stored?.createdAt ?? now, updatedAt: now })
      setStored(w)
      setSavedText(current)
      onSaved(w.id)
      if (planOn && isDateKey(planOn)) {
        await planSessionWorkout(planOn, w)
        setNotice({ tone: 'good', text: `Saved, and planned for ${DAY.format(dateKeyToMs(planOn))}. It's on your Calendar.` })
      } else setNotice({ tone: 'good', text: `Saved. It's under ${sport === 'run' ? 'Run' : 'Swim'} on the Workouts page.` })
      // its own URL, not a leave: the guard still thinks it's unsaved until this render is done
      if (syncUrl) void navigate({ to: '/builder', search: { sport: w.sport === 'swim' ? 'swim' : 'run', session: w.id }, replace: true, ignoreBlocker: true })
      return true
    } catch (e) {
      setNotice({ tone: 'bad', text: e instanceof Error ? e.message : String(e) })
      return false
    } finally {
      setBusy(false)
    }
  }

  /** An AI draft replaces what's open, as a new session; the notice can put back what was there. */
  const drafted = (d: SessionDraft, model: string | null) => {
    const before = { draft, mode, text, stored }
    setDraft(d)
    setMode('steps')
    setStored(null)
    setNotice({
      tone: 'info',
      text: `Drafted “${d.name}”${model ? ` with ${model}` : ''}. It isn't saved: check it, adjust it, then save.`,
      action: {
        label: 'Put back what you had',
        onClick: () => {
          setDraft(before.draft)
          setText(before.text)
          setMode(before.mode)
          setStored(before.stored)
          setNotice(null)
        },
      },
    })
  }
  // the pool the AI writes for: the builder's, or in text mode the one the text names
  const pool = mode === 'steps' ? draft.pool : (read.parsed.header.pool ?? draft.pool)

  const numbers = estimate ? [estimate.durationS !== null ? formatDurationShort(estimate.durationS) : null, estimate.distanceM !== null ? formatSportDistance(estimate.distanceM, sport, units) : null, estimate.load !== null ? `${Math.round(estimate.load)} TSS` : null].filter(Boolean).join(' · ') : ''

  return (
    <div className="mx-auto max-w-7xl px-4 md:px-8 pb-12" data-testid="session-builder">
      <PageHeader
        title="Workout builder"
        subtitle={sport === 'run' ? 'Build a run: lengths in time or distance, targets in heart rate or pace from your thresholds in Settings.' : 'Build a swim: lengths in your pool’s unit, paces per 100 or as a percent of your CSS.'}
        actions={
          <>
            <SaveState dirty={dirty} stored={!!stored} />
            <Button variant="primary" disabled={busy || !read.workout} onClick={() => void save()} title={read.workout ? `Save to ${sport === 'run' ? 'Run' : 'Swim'}` : 'Fix the problems first'} data-testid="session-builder-save">
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save
            </Button>
          </>
        }
      />
      {sportSwitch}
      {notice && <Notice notice={notice} onDismiss={() => setNotice(null)} />}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-4">
          {mode === 'steps' && (
            <section className="grid gap-3 rounded-2xl border border-line bg-panel p-4 sm:grid-cols-2" aria-label="About it">
              <Field label="Name">
                <Input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} aria-label="Name" data-testid="session-builder-name" />
              </Field>
              {sport === 'swim' && (
                <Field label="Pool">
                  <Select value={draft.pool} onChange={(e) => setPool(e.target.value as PoolLength)} aria-label="Pool">
                    {POOLS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
              <Field label="Notes" className="sm:col-span-2">
                <Input value={draft.notes} onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))} placeholder="What it's for, how it should feel" aria-label="Notes" />
              </Field>
            </section>
          )}

          <section className="rounded-2xl border border-line bg-panel p-4" aria-label="Steps">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
              <Segmented ariaLabel="Edit as" value={mode} onChange={pickMode} options={MODES} />
              <FormatGuideLink />
            </div>
            {mode === 'text' ? (
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                spellCheck={false}
                className="no-drag h-96 w-full rounded-lg border border-line bg-panel-2 p-3 font-mono text-[13px] leading-snug text-ink focus:border-accent focus:outline-none"
                aria-label="Session text"
                data-testid="session-builder-text"
              />
            ) : (
              <div className="space-y-3">
                {draft.sections.map((s, si) => (
                  <div key={si} className={cn('rounded-xl border bg-panel-2 p-3', s.repeat > 1 ? 'border-accent/40' : 'border-line')} data-testid="session-section">
                    <div className="flex flex-wrap items-center gap-2">
                      <Input value={s.title} onChange={(e) => setSection(si, { title: e.target.value.replace(/^-+\s*/, '') })} placeholder="Main set" aria-label={`Section ${si + 1} title`} className="h-9 w-44 font-semibold" />
                      <label className="flex items-center gap-1.5 text-xs text-ink-dim">
                        Repeat
                        <Input
                          type="number"
                          min={1}
                          max={100}
                          value={s.repeat}
                          onChange={(e) => setSection(si, { repeat: Math.min(100, Math.max(1, Math.round(Number(e.target.value) || 1))) })}
                          aria-label={`Section ${si + 1} repeats`}
                          className="h-9 w-16 tabular"
                        />
                        ×
                      </label>
                      <span className="ml-auto flex gap-1">
                        <Button size="iconSm" variant="ghost" disabled={si === 0} onClick={() => setSections((ss) => move(ss, si, -1))} aria-label={`Move section ${si + 1} up`}>
                          <ArrowUp className="size-3.5" />
                        </Button>
                        <Button size="iconSm" variant="ghost" disabled={si === draft.sections.length - 1} onClick={() => setSections((ss) => move(ss, si, 1))} aria-label={`Move section ${si + 1} down`}>
                          <ArrowDown className="size-3.5" />
                        </Button>
                        <Button size="iconSm" variant="ghost" onClick={() => setSections((ss) => ss.filter((_, i) => i !== si))} aria-label={`Remove section ${si + 1}`}>
                          <X className="size-3.5" />
                        </Button>
                      </span>
                    </div>
                    <ol className="mt-2 space-y-1.5">
                      {s.steps.map((st, sti) => (
                        <StepRow
                          key={sti}
                          step={st}
                          sport={sport}
                          paceUnit={sport === 'swim' ? swimPer(draft.pool) : per}
                          label={`Section ${si + 1} step ${sti + 1}`}
                          messages={onStep.get(`${si}:${sti}`) ?? []}
                          first={sti === 0}
                          last={sti === s.steps.length - 1}
                          onChange={(patch) => setStep(si, sti, patch)}
                          onMove={(by) => setSection(si, { steps: move(s.steps, sti, by) })}
                          onRemove={() => setSection(si, { steps: s.steps.filter((_, i) => i !== sti) })}
                        />
                      ))}
                    </ol>
                    <Button size="sm" variant="ghost" className="mt-2" onClick={() => setSection(si, { steps: [...s.steps, { ...(s.steps.at(-1) ?? newStep(sport, draft.pool)), rest: false, note: '' }] })} data-testid="session-add-step">
                      <Plus className="size-3.5" /> Add step
                    </Button>
                  </div>
                ))}
                <Button size="sm" onClick={() => setSections((ss) => [...ss, { title: '', repeat: 1, steps: [newStep(sport, draft.pool)] }])} data-testid="session-add-section">
                  <Plus className="size-3.5" /> Add section
                </Button>
              </div>
            )}
          </section>
          <AiPanel placeholder={ASK_PLACEHOLDER[sport]} ask={(request) => draftSession({ sport, pool, units, thresholds, request })} onDrafted={drafted} />
        </div>

        <aside className="space-y-4">
          <section className="space-y-3 rounded-2xl border border-line bg-panel p-4" aria-label="Preview" aria-live="polite">
            <div>
              <div className="font-semibold">{read.parsed.name}</div>
              <div className="text-xs text-ink-dim tabular" data-testid="session-builder-numbers">
                {sport === 'run' ? 'Run' : 'Swim'}
                {numbers && ` · ${numbers}`}
              </div>
            </div>
            {general.length > 0 && (
              <ul className="space-y-0.5 text-xs" data-testid="session-builder-messages">
                {general.map((m, i) => (
                  <li key={i} className={read.errors.includes(m) ? 'text-bad' : 'text-ink-dim'}>
                    {m.line && mode === 'text' ? `line ${m.line}: ` : ''}
                    {m.text}
                  </li>
                ))}
              </ul>
            )}
            <SessionSteps sections={read.parsed.sections} />
          </section>
          <section className="space-y-2 rounded-2xl border border-line bg-panel p-4" aria-label="Plan it">
            <h2 className="eyebrow text-ink-faint">Plan it</h2>
            <div className="flex flex-wrap items-center gap-2">
              <Input type="date" value={planDate} onChange={(e) => setPlanDate(e.target.value)} aria-label="Day to do it" className="h-9 w-44" data-testid="session-builder-date" />
              <Button size="sm" disabled={busy || !read.workout || !isDateKey(planDate)} onClick={() => void save({ planOn: planDate })} data-testid="session-builder-plan">
                <CalendarPlus className="size-3.5" /> Save and plan
              </Button>
            </div>
            <p className="text-[11px] text-ink-faint">Or open it from the Workouts page later to plan it, or add it to a training plan.</p>
          </section>
        </aside>
      </div>

      {blocker.status === 'blocked' && (
        <Dialog
          open
          onOpenChange={(o) => !o && blocker.reset()}
          title="Leave without saving?"
          description={`“${read.parsed.name}” has changes that aren't saved.`}
          footer={
            <>
              <Button variant="ghost" onClick={() => blocker.reset()} data-testid="guard-stay">
                Keep editing
              </Button>
              <Button variant="danger" onClick={() => blocker.proceed()} data-testid="guard-discard">
                Discard changes
              </Button>
              <Button variant="primary" disabled={!read.workout || busy} onClick={() => void save({ syncUrl: false }).then((ok) => (ok ? blocker.proceed() : blocker.reset()))} data-testid="guard-save">
                Save and leave
              </Button>
            </>
          }
        >
          <p className="text-sm text-ink-dim">Discarding throws away everything since the last save.</p>
        </Dialog>
      )}
    </div>
  )
}

function StepRow({
  step,
  sport,
  paceUnit,
  label,
  messages,
  first,
  last,
  onChange,
  onMove,
  onRemove,
}: {
  step: DraftStep
  sport: BuildSport
  paceUnit: string
  label: string
  messages: StepMessage[]
  first: boolean
  last: boolean
  onChange: (patch: Partial<DraftStep>) => void
  onMove: (by: -1 | 1) => void
  onRemove: () => void
}) {
  const zone = step.target === 'hrZone' || step.target === 'paceZone'
  return (
    <li className={cn('rounded-lg border bg-panel px-2 py-1.5', messages.some((m) => m.bad) ? 'border-bad/60' : messages.length > 0 ? 'border-warn/60' : 'border-line')} data-testid="session-step">
      <div className="flex flex-wrap items-center gap-1.5">
        <Input value={step.amount} onChange={(e) => onChange({ amount: e.target.value })} inputMode="decimal" aria-label={`${label} length`} className="h-8 w-16 tabular" />
        <Select value={step.unit} onChange={(e) => onChange({ unit: e.target.value as LengthUnit })} aria-label={`${label} unit`} className="h-8 w-20">
          {UNITS[sport].map((u) => (
            <option key={u.value} value={u.value}>
              {u.label}
            </option>
          ))}
        </Select>
        <Select value={step.target} onChange={(e) => onChange({ target: e.target.value as TargetKind, value: e.target.value === 'hrZone' || e.target.value === 'paceZone' ? '2' : '' })} aria-label={`${label} target`} className="h-8 w-40">
          {TARGETS[sport].map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </Select>
        {zone && (
          <Select value={step.value} onChange={(e) => onChange({ value: e.target.value })} aria-label={`${label} zone`} className="h-8 w-20">
            {ZONES.map((z) => (
              <option key={z} value={String(z)}>
                Z{z}
              </option>
            ))}
          </Select>
        )}
        {!zone && step.target !== 'none' && (
          <span className="flex items-center gap-1">
            <Input value={step.value} onChange={(e) => onChange({ value: e.target.value })} placeholder={step.target === 'pace' && sport === 'swim' ? '1:40' : PLACEHOLDER[step.target]} aria-label={`${label} target value`} className="h-8 w-28 tabular" />
            <span className="text-xs text-ink-faint">{step.target === 'pace' ? `/${paceUnit}` : SUFFIX[step.target]}</span>
          </span>
        )}
        <label className="flex items-center gap-1 text-xs text-ink-dim">
          <input type="checkbox" checked={step.rest} onChange={(e) => onChange({ rest: e.target.checked })} aria-label={`${label} is rest`} className="accent-accent" />
          Rest
        </label>
        <Input value={step.note} onChange={(e) => onChange({ note: e.target.value })} placeholder="Note: drill, kick, strides" aria-label={`${label} note`} className="h-8 min-w-28 flex-1" />
        <span className="flex gap-0.5">
          <Button size="iconSm" variant="ghost" disabled={first} onClick={() => onMove(-1)} aria-label={`Move ${label} up`}>
            <ArrowUp className="size-3.5" />
          </Button>
          <Button size="iconSm" variant="ghost" disabled={last} onClick={() => onMove(1)} aria-label={`Move ${label} down`}>
            <ArrowDown className="size-3.5" />
          </Button>
          <Button size="iconSm" variant="ghost" onClick={onRemove} aria-label={`Remove ${label}`}>
            <X className="size-3.5" />
          </Button>
        </span>
      </div>
      {messages.map((m) => (
        <p key={m.text} className={cn('mt-1 text-xs', m.bad ? 'text-bad' : 'text-ink-dim')}>
          {m.text}
        </p>
      ))}
    </li>
  )
}
