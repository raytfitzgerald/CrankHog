// The Run and Swim tabs of Workouts: sessions of that sport, built, imported
// or pasted, each with its steps and what it adds up to, ready to plan on a day.
import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { CalendarPlus, ClipboardPaste, Copy, ListPlus, PencilLine, Plus, Search, Trash2 } from 'lucide-react'
import { describeSession, sessionFromFile } from '@core/multisport/build'
import type { SessionThresholds } from '@core/multisport/estimate'
import type { SessionSport, SessionWorkout } from '@core/multisport/model'
import { formatSportDistance } from '@core/sport/format'
import { SPORT_GROUP_LABEL } from '@core/sport/group'
import { dateKey, isDateKey } from '@core/workout/schedule'
import { useSettings } from '../../stores/settings'
import { Button } from '../../ui/Button'
import { Dialog } from '../../ui/Dialog'
import { Field, Input, Select } from '../../ui/form'
import { formatDurationShort } from '../../ui/format'
import { deleteSessionWorkout, planSessionWorkout, saveSessionWorkout, sessionThresholds } from '../../workouts/sessions-repo'
import { SportIcon } from '../calendar/SportIcon'
import { addSessionToPlan, listPlans } from '../../plan/plans-repo'
import { FormatGuideLink } from './FormatGuide'
import { buildable, SESSIONS_NOUN, useSessions } from './sessions'
import { SessionSteps } from './SessionSteps'

const PASTE_PLACEHOLDER: Record<SessionSport, string> = {
  run: `sport: run
name: Hill repeats

Warmup
- 15m Z2 HR

Hills 6x
- 90s Z5 HR
- 2m30s Z1 HR

Cooldown
- 10m Z1 HR`,
  swim: `sport: swim
name: CSS 10x100
pool: 25m

Warmup
- 400mtr Z2 Pace

Main set 10x
- 100mtr 95% Pace
- 15s rest

Cooldown
- 200mtr Z1 Pace`,
  other: `sport: other
name: Squash
duration: 1h
effort: hard`,
}

/** "1h 05m · 12.4 km · 92 TSS", with what's missing left out. */
function numbers(e: { durationS: number | null; distanceM: number | null; load: number | null } | null, sport: SessionWorkout['sport'], units: 'metric' | 'imperial'): string {
  if (!e) return ''
  const parts = [e.durationS !== null ? formatDurationShort(e.durationS) : null, e.distanceM !== null ? formatSportDistance(e.distanceM, sport, units) : null, e.load !== null ? `${Math.round(e.load)} TSS` : null]
  return parts.filter(Boolean).join(' · ')
}

/** Run, swim and other sessions: one sport's when `sport` is given. Build one, paste one, or open one to plan it. */
export function SessionsPanel({ sport, onNotice }: { sport?: SessionSport; onNotice: (n: { tone: 'good' | 'bad'; text: string }) => void }) {
  const [query, setQuery] = useState('')
  const sessions = useSessions(sport, query)
  const thresholds = useLiveQuery(() => sessionThresholds(), []) ?? {}
  const [pasting, setPasting] = useState(false)
  const [open, setOpen] = useState<SessionWorkout | null>(null)
  const noun = sport ? SESSIONS_NOUN[sport] : 'runs, swims or other sessions'
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative mr-2 w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${noun}`} className="pl-9" aria-label={`Search ${noun}`} />
        </div>
        {sport && buildable(sport) && (
          <Button size="sm" variant="primary" asChild>
            <Link to="/builder" search={{ sport }} data-testid="build-session">
              <Plus className="size-3.5" /> Build a {sport}
            </Link>
          </Button>
        )}
        <Button size="sm" onClick={() => setPasting((p) => !p)} aria-expanded={pasting} data-testid="paste-session">
          <ClipboardPaste className="size-3.5" /> Paste a session
        </Button>
        <FormatGuideLink />
        <span className="text-xs text-ink-faint">Or drop .txt session files on this page. A file named YYYY-MM-DD_Name.txt can go straight on the Calendar.</span>
      </div>
      {pasting && <PasteBox placeholder={PASTE_PLACEHOLDER[sport ?? 'run']} thresholds={thresholds} onSaved={(text) => (setPasting(false), onNotice({ tone: 'good', text }))} />}
      {sessions && sessions.length === 0 && !pasting && (
        <div className="mx-auto max-w-md py-12 text-center text-ink-faint">
          {query.trim() ? `No ${noun} match.` : `No ${noun} yet. ${sport && buildable(sport) ? `Build one, paste one,` : 'Paste one,'} or drop session files on this page. The Format guide shows how to write them.`}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="session-grid">
        {(sessions ?? []).map((w) => (
          <SessionCard key={w.id} workout={w} thresholds={thresholds} onOpen={() => setOpen(w)} />
        ))}
      </div>
      {open && <SessionDialog workout={open} thresholds={thresholds} onClose={() => setOpen(null)} onNotice={onNotice} />}
    </div>
  )
}

export function SessionCard({ workout: w, thresholds, onOpen }: { workout: SessionWorkout; thresholds: SessionThresholds; onOpen: () => void }) {
  const units = useSettings((s) => s.units)
  const { parsed, estimate } = useMemo(() => describeSession(w, thresholds), [w, thresholds])
  return (
    <button type="button" onClick={onOpen} className="flex w-full flex-col rounded-2xl border border-line bg-panel p-4 text-left transition-colors hover:border-line-strong hover:bg-panel-2" data-testid="session-card" data-sport={w.sport}>
      <div className="flex items-center gap-2">
        <SportIcon sport={w.sport} className="size-4 shrink-0 text-accent" aria-hidden />
        <span className="font-semibold leading-snug">{w.name}</span>
      </div>
      <div className="mt-1 text-xs text-ink-dim tabular">
        {SPORT_GROUP_LABEL[w.sport]}
        {numbers(estimate, w.sport, units) && ` · ${numbers(estimate, w.sport, units)}`}
      </div>
      <div className="mt-3 max-h-28 overflow-hidden rounded-lg bg-panel-2 px-2 py-1.5">{parsed.sections.length > 0 ? <SessionSteps sections={parsed.sections} compact /> : <span className="text-[11px] text-ink-faint">No steps: {w.effort ?? 'moderate'} effort</span>}</div>
    </button>
  )
}

/** Paste a session and see it read, live, before saving it. */
function PasteBox({ placeholder, thresholds, onSaved }: { placeholder: string; thresholds: SessionThresholds; onSaved: (message: string) => void }) {
  const units = useSettings((s) => s.units)
  const [text, setText] = useState('')
  const [date, setDate] = useState('')
  const r = useMemo(() => (text.trim() ? sessionFromFile('Pasted session.txt', text, thresholds, 0) : null), [text, thresholds])
  const save = async (plan: boolean) => {
    if (!r?.workout) return
    const now = Date.now()
    const w = await saveSessionWorkout({ ...r.workout, source: 'user', createdAt: now, updatedAt: now })
    const day = plan ? (isDateKey(date) ? date : r.date) : null
    if (day) {
      await planSessionWorkout(day, w)
      onSaved(`${w.name} saved and planned.`)
    } else onSaved(`${w.name} saved to ${SPORT_GROUP_LABEL[w.sport]}.`)
  }
  return (
    <div className="mb-5 grid gap-4 rounded-2xl border border-line bg-panel p-4 md:grid-cols-2" data-testid="paste-box">
      <div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          spellCheck={false}
          className="no-drag h-72 w-full rounded-lg border border-line bg-panel-2 p-3 font-mono text-[13px] leading-snug text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
          aria-label="Session text"
          data-testid="paste-text"
        />
      </div>
      <div className="min-w-0 space-y-3 text-sm" aria-live="polite" data-testid="paste-preview">
        {!r && <p className="text-ink-faint">Paste or type a session. It's read as you type: the steps, the time, distance and load, and anything to fix.</p>}
        {r && (
          <>
            <div>
              <div className="font-semibold">{r.parsed.name === 'Pasted session' && !r.parsed.header.name ? 'Untitled session' : r.parsed.name}</div>
              <div className="text-xs text-ink-dim tabular" data-testid="paste-numbers">
                {r.parsed.header.sport ? SPORT_GROUP_LABEL[r.parsed.header.sport] : 'No sport yet'}
                {r.parsed.header.sport && numbers(r.estimate, r.parsed.header.sport, units) && ` · ${numbers(r.estimate, r.parsed.header.sport, units)}`}
              </div>
            </div>
            {r.errors.length > 0 && (
              <ul className="space-y-0.5 text-xs text-bad" data-testid="paste-errors">
                {r.errors.map((m, i) => (
                  <li key={i}>
                    {m.line ? `line ${m.line}: ` : ''}
                    {m.text}
                  </li>
                ))}
              </ul>
            )}
            {r.warnings.length > 0 && (
              <ul className="space-y-0.5 text-xs text-ink-dim" data-testid="paste-warnings">
                {r.warnings.map((m, i) => (
                  <li key={i}>
                    {m.line ? `line ${m.line}: ` : ''}
                    {m.text}
                  </li>
                ))}
              </ul>
            )}
            <SessionSteps sections={r.parsed.sections} />
            <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
              <Button size="sm" variant="primary" disabled={!r.workout} onClick={() => void save(false)} data-testid="paste-save">
                Save
              </Button>
              <Input type="date" value={date || r.date || ''} onChange={(e) => setDate(e.target.value)} aria-label="Plan on" className="h-8 max-w-40" />
              <Button size="sm" disabled={!r.workout || !(isDateKey(date) || r.date)} onClick={() => void save(true)} data-testid="paste-plan">
                <CalendarPlus className="size-3.5" /> Save and plan
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function SessionDialog({ workout: w, thresholds, onClose, onNotice }: { workout: SessionWorkout; thresholds: SessionThresholds; onClose: () => void; onNotice: (n: { tone: 'good' | 'bad'; text: string }) => void }) {
  const units = useSettings((s) => s.units)
  const [date, setDate] = useState(() => dateKey(Date.now()))
  const [confirming, setConfirming] = useState(false)
  const plans = useLiveQuery(() => listPlans(), [])
  const [planId, setPlanId] = useState('')
  const { parsed, estimate } = useMemo(() => describeSession(w, thresholds), [w, thresholds])
  const addToPlan = async () => {
    const plan = plans?.find((p) => p.id === (planId || plans[0]?.id))
    if (!plan) return
    await addSessionToPlan(plan.id, w)
    onNotice({ tone: 'good', text: `${w.name} is in ${plan.name}.` })
    onClose()
  }
  const plan = async () => {
    if (!isDateKey(date)) return
    await planSessionWorkout(date, w)
    onNotice({ tone: 'good', text: `${w.name} is on the calendar.` })
    onClose()
  }
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={w.name}
      description={`${SPORT_GROUP_LABEL[w.sport]}${numbers(estimate, w.sport, units) ? ` · ${numbers(estimate, w.sport, units)}` : ''}`}
      footer={
        confirming ? (
          <div className="flex w-full flex-wrap items-center justify-between gap-2 text-sm">
            <span>Delete it from your {SESSIONS_NOUN[w.sport]}? Sessions already on the calendar stay.</span>
            <span className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
                Cancel
              </Button>
              <Button size="sm" variant="danger" onClick={() => void deleteSessionWorkout(w.id).then(onClose)} data-testid="session-delete-confirm">
                Delete
              </Button>
            </span>
          </div>
        ) : (
          <>
            <Button variant="ghost" onClick={() => setConfirming(true)} data-testid="session-delete">
              <Trash2 className="size-3.5" /> Delete
            </Button>
            <Button variant="ghost" onClick={() => void navigator.clipboard?.writeText(w.text).catch(() => undefined)}>
              <Copy className="size-3.5" /> Copy text
            </Button>
            {buildable(w.sport) && (
              <Button variant="ghost" asChild>
                <Link to="/builder" search={{ sport: w.sport, session: w.id }} data-testid="session-edit">
                  <PencilLine className="size-3.5" /> Edit in builder
                </Link>
              </Button>
            )}
          </>
        )
      }
    >
      <div className="space-y-4">
        {parsed.sections.length > 0 ? <SessionSteps sections={parsed.sections} /> : <p className="text-sm text-ink-dim">No steps: {w.durationS ? formatDurationShort(w.durationS) : ''}{w.distanceM ? ` ${formatSportDistance(w.distanceM, w.sport, units)}` : ''}, {w.effort ?? 'moderate'} effort.</p>}
        {w.notes && <p className="text-sm text-ink-dim">{w.notes}</p>}
        {estimate?.warnings.map((m) => (
          <p key={m} className="text-xs text-ink-faint">
            {m}
          </p>
        ))}
        <Field label="Plan on">
          <div className="flex gap-2">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Plan on day" className="max-w-48" data-testid="session-plan-date" />
            <Button variant="primary" onClick={() => void plan()} disabled={!isDateKey(date)} data-testid="session-plan">
              <CalendarPlus className="size-3.5" /> Plan
            </Button>
          </div>
        </Field>
        {plans && plans.length > 0 && (
          <Field label="Add to a plan" hint="It takes the plan's next day, like a workout.">
            <div className="flex gap-2">
              <Select value={planId || plans[0]!.id} onChange={(e) => setPlanId(e.target.value)} aria-label="Plan" className="max-w-56">
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
              <Button onClick={() => void addToPlan()} data-testid="session-add-to-plan">
                <ListPlus className="size-3.5" /> Add
              </Button>
            </div>
          </Field>
        )}
      </div>
    </Dialog>
  )
}
