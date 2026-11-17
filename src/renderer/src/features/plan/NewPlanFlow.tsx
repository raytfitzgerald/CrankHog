import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Bot, FileSpreadsheet, FileUp, Hammer, Loader2, Sparkles, Wand2 } from 'lucide-react'
import { nextMonday, type DayMark, type EventFocus, type PlanGoal, type PlanSurvey } from '@core/workout/plan'
import { planWeeks, type Phase } from '@core/workout/plan-builder'
import { addDays, dateKey, isDateKey } from '@core/workout/schedule'
import { aiReady } from '../../coach/quips'
import { useFtp } from '../../db/use-athlete'
import { addMark, removeMark } from '../../plan/day-marks-repo'
import { draftAiPlan, draftBuiltinPlan, savePlanDraft, type PlanDraft } from '../../plan/build-plan'
import { createPlan, deletePlan, importIntoPlan } from '../../plan/plans-repo'
import { Button } from '../../ui/Button'
import { cn } from '../../ui/cn'
import { Dialog } from '../../ui/Dialog'
import { Field, Input, Select, Slider } from '../../ui/form'
import { formatDurationShort } from '../../ui/format'
import { Segmented, type SegmentedOption } from '../../ui/Segmented'
import { describeWorkout, IMPORT_EXTENSIONS, loadLibrary, plannedStatsOf } from '../../workouts/library'
import { DocumentImport } from './DocumentImport'
import { planImportNotice } from './import-notice'

type Step = 'event' | 'fill' | 'survey' | 'builder' | 'review' | 'document'
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const PHASE: Record<Phase, string> = { base: 'Base', build: 'Build', specialty: 'Specialty', taper: 'Taper', recovery: 'Recovery' }
const GOALS: SegmentedOption<PlanGoal>[] = [
  { value: 'ftp', label: 'Raise FTP', hint: 'Sweet spot, threshold and VO2 work' },
  { value: 'endurance', label: 'Build endurance', hint: 'Mostly steady riding, longer rides' },
  { value: 'event', label: 'Get ready for the event', hint: 'Shaped by the event in the last weeks' },
]
const FOCUS: SegmentedOption<EventFocus>[] = [
  { value: 'general', label: 'All-round' },
  { value: 'climbing', label: 'Climbing' },
  { value: 'time-trial', label: 'Time trial' },
  { value: 'criterium', label: 'Criterium' },
]
const PRIORITY: SegmentedOption<NonNullable<DayMark['priority']>>[] = [
  { value: 'A', label: 'A', hint: 'The one you build to' },
  { value: 'B', label: 'B' },
  { value: 'C', label: 'C' },
]

/**
 * Add a training plan, step by step: the target event and its date, then
 * your own workout files, a plan document read into sessions (by AI, or the
 * template without), a plan built for you from a short survey (by AI, or by
 * CrankHog's own rules), or an empty plan to fill by hand.
 */
export function NewPlanFlow({ onClose, onCreated }: { onClose: () => void; onCreated: (planId: string, notice?: { tone: 'good' | 'bad'; text: string }) => void }) {
  const [step, setStep] = useState<Step>('event')
  const [hasEvent, setHasEvent] = useState(true)
  const [eventName, setEventName] = useState('')
  const [eventDate, setEventDate] = useState(() => addDays(nextMonday(), 7 * 10 - 1))
  const [priority, setPriority] = useState<NonNullable<DayMark['priority']>>('A')
  const [weeks, setWeeks] = useState(8)
  const [survey, setSurvey] = useState<PlanSurvey>(() => ({ hoursPerWeek: 6, rideDays: [1, 3, 5, 6], longDay: 6, goal: 'event', focus: 'general', startDate: nextMonday() }))
  const [ai, setAi] = useState(false)
  const [draft, setDraft] = useState<PlanDraft | null>(null)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const { ftpW, known } = useFtp()

  useEffect(() => {
    let live = true
    void aiReady().then((ok) => live && setAi(ok))
    return () => {
      live = false
    }
  }, [])

  const event = hasEvent && eventName.trim() && isDateKey(eventDate) ? { name: eventName.trim(), date: eventDate, priority } : undefined
  const planLength = event ? planWeeks(survey.startDate, event.date) : weeks
  const set = (patch: Partial<PlanSurvey>) => setSurvey((s) => ({ ...s, ...patch }))

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

  const eventNext = () => {
    if (hasEvent && !eventName.trim()) return setError('Name the event, or choose No event.')
    if (hasEvent && (!isDateKey(eventDate) || eventDate <= dateKey(Date.now()))) return setError('Pick an event date after today.')
    setError(null)
    setName(hasEvent ? `${eventName.trim()} plan` : '')
    set({ goal: hasEvent ? 'event' : 'ftp' })
    setStep('fill')
  }

  /**
   * The plan without a survey: from files, or empty. Once the plan is made the
   * dialog closes, whatever some files did, so trying again can't make a second
   * one; when no file could be read, nothing is made.
   */
  const createSimple = (files?: File[]) =>
    act(async () => {
      const read = files ? await Promise.all(files.map(async (f) => ({ name: f.name, text: await f.text() }))) : null
      const mark = event ? await addMark({ date: event.date, kind: 'event', name: event.name, priority: event.priority }) : undefined
      // a plan to an event counts back from it, so its last workout lands before race day
      const plan = await createPlan({ name: name.trim() || 'Training plan', source: read ? 'files' : 'manual', eventId: mark?.id, ...(mark ? { anchor: 'race' as const } : {}) })
      if (!read) return onCreated(plan.id)
      const r = await importIntoPlan(plan.id, read)
      if (r.added === 0) {
        await deletePlan(plan.id)
        if (mark) await removeMark(mark.id)
        throw new Error(`Couldn't import ${r.failed.map((f) => `${f.name}: ${f.reason}`).join('; ')}`)
      }
      onCreated(plan.id, r.failed.length > 0 ? planImportNotice(plan.name, r) : undefined)
    })

  const build = (withAi: boolean) =>
    act(async () => {
      setDraft(null)
      setStep('review')
      const input = { survey, weeks: planLength, toEvent: !!event }
      setDraft(withAi ? await draftAiPlan(input) : await draftBuiltinPlan(input))
    })

  const save = () =>
    act(async () => {
      if (!draft) return
      const plan = await savePlanDraft(draft, { name: name.trim() || (event ? `${event.name} plan` : 'Training plan'), survey, event })
      onCreated(plan.id)
    })

  const surveyOk = survey.rideDays.length > 0 && isDateKey(survey.startDate) && (!event || survey.startDate < event.date)

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title="Add a training plan" description={DESCRIPTION[step]} className="w-[min(720px,calc(100vw-32px))]">
      <div className="space-y-4" data-testid={`new-plan-${step}`}>
        {step === 'event' && (
          <>
            <Segmented
              ariaLabel="Target event"
              value={hasEvent ? 'event' : 'none'}
              onChange={(v) => setHasEvent(v === 'event')}
              options={[
                { value: 'event', label: 'Building to an event' },
                { value: 'none', label: 'No event' },
              ]}
            />
            {hasEvent ? (
              <>
                <Field label="Event">
                  <Input autoFocus value={eventName} onChange={(e) => setEventName(e.target.value)} placeholder="Gran fondo" aria-label="Event name" data-testid="new-plan-event-name" />
                </Field>
                <Field label="Date">
                  <Input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className="max-w-48" aria-label="Event date" data-testid="new-plan-event-date" />
                </Field>
                <Field label="Priority">
                  <Segmented ariaLabel="Event priority" value={priority} options={PRIORITY} onChange={setPriority} />
                </Field>
              </>
            ) : (
              <Field label="Length" hint="How many weeks the plan runs.">
                <Slider ariaLabel="Plan length" value={weeks} min={4} max={16} step={1} format={(v) => `${v} weeks`} onChange={setWeeks} />
              </Field>
            )}
          </>
        )}

        {step === 'fill' && (
          <>
            <Field label="Plan name">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Base 1" aria-label="Plan name" data-testid="new-plan-name" />
            </Field>
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                ref={fileInput}
                type="file"
                multiple
                accept={IMPORT_EXTENSIONS.join(',')}
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? [])
                  e.target.value = ''
                  if (files.length > 0) void createSimple(files)
                }}
                data-testid="new-plan-files"
              />
              <Choice icon={FileUp} title="Import your workout files" text=".zwo, .mrc, .erg or .txt. Files named YYYY-MM-DD_name go on that day." onClick={() => fileInput.current?.click()} disabled={busy} testId="new-plan-import" />
              <Choice icon={FileSpreadsheet} title="Import a plan document" text="A coach’s plan as a spreadsheet, Word, PDF or text file, read by your AI provider. Or CrankHog’s template, without AI." onClick={() => setStep('document')} disabled={busy} testId="new-plan-document" />
              <Choice icon={Wand2} title="Build a plan for me" text="Answer a few questions and get a week-by-week plan." onClick={() => setStep('survey')} disabled={busy} testId="new-plan-build" />
              <Choice icon={Hammer} title="Start empty" text="Pick workouts from your library." onClick={() => void createSimple()} disabled={busy} testId="new-plan-empty" />
            </div>
          </>
        )}

        {step === 'survey' && (
          <>
            <Field label="Hours a week" hint="Your most, on a normal week. Recovery weeks ride less.">
              <Slider ariaLabel="Hours a week" value={survey.hoursPerWeek} min={2} max={15} step={0.5} format={(v) => `${v} h`} onChange={(v) => set({ hoursPerWeek: v })} />
            </Field>
            <Field label="Days you can ride">
              <div className="flex flex-wrap gap-1" role="group" aria-label="Days you can ride">
                {WEEKDAYS.map((d, i) => (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={survey.rideDays.includes(i)}
                    onClick={() => {
                      const rideDays = survey.rideDays.includes(i) ? survey.rideDays.filter((x) => x !== i) : [...survey.rideDays, i].sort()
                      set({ rideDays, longDay: survey.longDay !== null && rideDays.includes(survey.longDay) ? survey.longDay : null })
                    }}
                    className={cn('rounded-lg border px-2.5 py-1.5 text-xs font-semibold', survey.rideDays.includes(i) ? 'border-accent bg-accent text-on-accent' : 'border-line bg-panel-2 text-ink-dim hover:text-ink')}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Long ride">
              <Select value={survey.longDay === null ? '' : String(survey.longDay)} onChange={(e) => set({ longDay: e.target.value === '' ? null : Number(e.target.value) })} className="max-w-48" aria-label="Long-ride day">
                <option value="">No long ride</option>
                {survey.rideDays.map((d) => (
                  <option key={d} value={d}>
                    {WEEKDAYS[d]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Goal" hint={GOALS.find((g) => g.value === survey.goal)?.hint}>
              <Segmented ariaLabel="Goal" value={survey.goal} options={event ? GOALS : GOALS.filter((g) => g.value !== 'event')} onChange={(goal) => set({ goal })} className="flex-wrap" />
            </Field>
            {survey.goal === 'event' && (
              <Field label="The event is">
                <Segmented ariaLabel="Event type" value={survey.focus} options={FOCUS} onChange={(focus) => set({ focus })} className="flex-wrap" />
              </Field>
            )}
            <Field label="Start" hint={`${planLength} week${planLength === 1 ? '' : 's'}${event ? ` to ${event.name}` : ''}.`}>
              <Input type="date" value={survey.startDate} onChange={(e) => set({ startDate: e.target.value })} className="max-w-48" aria-label="Plan start" />
            </Field>
            <p className="text-xs text-ink-faint">Workouts are sized to your FTP of {ftpW} W{known ? '' : ', which you haven’t tested yet. The plan opens with a ramp test'}.</p>
          </>
        )}

        {step === 'builder' && (
          <div className="grid gap-2 sm:grid-cols-2">
            <Choice
              icon={Bot}
              title="With AI"
              text={ai ? 'Your AI provider plans the weeks from your answers and recent rides. CrankHog fills them with workouts, and the AI writes any that are missing.' : 'Set up an AI provider in Settings → AI first. AI needs the Mac app.'}
              onClick={() => void build(true)}
              disabled={!ai || busy}
              testId="new-plan-ai"
            />
            <Choice icon={Sparkles} title="From CrankHog workouts" text="Base, build, specialty and a taper into your event, with a recovery week every fourth week. No AI needed." onClick={() => void build(false)} disabled={busy} testId="new-plan-builtin" />
          </div>
        )}

        {step === 'document' && <DocumentImport event={event} planName={name} onBack={() => setStep('fill')} onCreated={onCreated} />}

        {step === 'review' && (draft ? <Review draft={draft} name={name} onName={setName} /> : !error && <div className="flex items-center gap-2 py-10 text-sm text-ink-dim"><Loader2 className="size-4 animate-spin" /> Building your plan…</div>)}

        {error && (
          <div className="space-y-2 rounded-xl border border-bad/40 bg-bad/10 px-4 py-3 text-sm" role="alert">
            <p>{error}</p>
            {step === 'review' && (
              <Button size="sm" onClick={() => void build(false)} disabled={busy} data-testid="new-plan-fallback">
                Build it from CrankHog workouts instead
              </Button>
            )}
          </div>
        )}

        {/* the document import has its own buttons */}
        <div className={cn('flex justify-between gap-2 border-t border-line pt-4', step === 'document' && 'hidden')}>
          <Button variant="ghost" onClick={() => (step === 'event' ? onClose() : setStep(BACK[step]))} disabled={busy}>
            {step === 'event' ? 'Cancel' : 'Back'}
          </Button>
          {step === 'event' && (
            <Button variant="primary" onClick={eventNext} data-testid="new-plan-next">
              Next
            </Button>
          )}
          {step === 'survey' && (
            <Button variant="primary" onClick={() => setStep('builder')} disabled={!surveyOk} data-testid="new-plan-next">
              Next
            </Button>
          )}
          {step === 'review' && draft && (
            <Button variant="primary" onClick={() => void save()} disabled={busy} data-testid="new-plan-save">
              Put on calendar
            </Button>
          )}
        </div>
      </div>
    </Dialog>
  )
}

const DESCRIPTION: Record<Step, string> = {
  event: 'What are you training for?',
  fill: 'How should the plan be filled?',
  survey: 'A few questions, so the plan fits your week.',
  builder: 'Who builds it?',
  review: 'Your plan, week by week.',
  document: 'Your plan, from a document or spreadsheet.',
}
const BACK: Record<Exclude<Step, 'event'>, Step> = { fill: 'event', survey: 'fill', builder: 'survey', review: 'builder', document: 'fill' }

function Choice({ icon: Icon, title, text, onClick, disabled, testId }: { icon: typeof Bot; title: string; text: string; onClick: () => void; disabled?: boolean; testId: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex flex-col items-start gap-1 rounded-xl border border-line bg-panel-2 p-3 text-left hover:border-accent disabled:cursor-not-allowed disabled:opacity-50"
      data-testid={testId}
    >
      <span className="flex items-center gap-2 font-semibold">
        <Icon className="size-4 text-accent" /> {title}
      </span>
      <span className="text-xs text-ink-dim">{text}</span>
    </button>
  )
}

/** The draft: each week's phase, time and TSS, before it goes on the calendar. */
function Review({ draft, name, onName }: { draft: PlanDraft; name: string; onName: (n: string) => void }) {
  const library = useLiveQuery(() => loadLibrary(draft.ftpW), [draft.ftpW])
  const stats = useMemo(() => {
    const m = new Map((library ?? []).map((e) => [e.workout.id, plannedStatsOf(e.workout, e.stats)]))
    for (const w of draft.written) m.set(w.id, plannedStatsOf(w, describeWorkout(w, draft.ftpW).stats))
    return m
  }, [library, draft])
  return (
    <>
      <Field label="Plan name">
        <Input value={name} onChange={(e) => onName(e.target.value)} aria-label="Plan name" data-testid="new-plan-name" />
      </Field>
      {draft.written.length > 0 && <p className="text-xs text-ink-dim">The AI wrote {draft.written.length} workout{draft.written.length === 1 ? '' : 's'} for sessions nothing in your library fitted. They go in your library with the plan.</p>}
      <ol className="max-h-80 space-y-1 overflow-y-auto" data-testid="new-plan-weeks">
        {draft.skeleton.weeks.map((w, wi) => {
          const ids = draft.picks[wi] ?? []
          const seconds = ids.reduce((s, id) => s + (id ? (stats.get(id)?.durationS ?? 0) : 0), 0)
          const tss = ids.reduce((s, id) => s + (id ? (stats.get(id)?.tss ?? 0) : 0), 0)
          return (
            <li key={wi} className="flex items-center justify-between gap-3 rounded-lg bg-panel-2 px-3 py-1.5 text-sm" data-testid="new-plan-week">
              <span>
                <span className="font-display font-semibold tabular">Week {wi + 1}</span> <span className="text-ink-dim">· {PHASE[w.phase]}</span>
              </span>
              <span className="tabular text-ink-dim">
                {w.sessions.length} rides · {formatDurationShort(seconds)} · {Math.round(tss)} TSS
              </span>
            </li>
          )
        })}
      </ol>
    </>
  )
}
