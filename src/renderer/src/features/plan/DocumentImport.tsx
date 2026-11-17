// "Import a plan document", the fourth way to fill a new plan: pick a plan
// in a document or spreadsheet, send its text to the rider's AI provider (or
// read CrankHog's template without AI), check what came back, and only then
// put it on the calendar. Before anything is sent, the rider is told where
// it goes and that nothing else goes with it.
import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import { Download, FileText, Loader2, Upload } from 'lucide-react'
import { defaultStart, isRealDate, mondayOf } from '@core/plan-import/model'
import { chunkDocument } from '@core/plan-import/chunk'
import { isPlanTemplate, TEMPLATE_CSV, TEMPLATE_FILE_NAME } from '@core/plan-import/template'
import type { SessionThresholds } from '@core/multisport/estimate'
import type { DayMark } from '@core/workout/plan'
import { dateKey, dateKeyToMs, type DateKey } from '@core/workout/schedule'
import type { InvokeRes } from '@shared/ipc/contract'
import { useFtp } from '../../db/use-athlete'
import { bridge } from '../../platform/bridge'
import { DocumentReadError, extractDocument, PLAN_DOCUMENT_EXTENSIONS, type ExtractedDocument } from '../../plan/doc-extract'
import { prepareImport, readTemplateDocument, readWithAi, saveImport, type ImportProblem, type ReadDocument, type ReadyItem } from '../../plan/doc-import'
import { Button } from '../../ui/Button'
import { cn } from '../../ui/cn'
import { Field, Input, Switch } from '../../ui/form'
import { formatDate, formatDurationShort } from '../../ui/format'
import { sessionThresholds } from '../../workouts/sessions-repo'
import { SportIcon } from '../calendar/SportIcon'

type Event = { name: string; date: DateKey; priority: NonNullable<DayMark['priority']> }

type Phase =
  | { at: 'pick' }
  | { at: 'loaded'; file: ExtractedDocument }
  | { at: 'reading'; file: ExtractedDocument; part: number; parts: number }
  | { at: 'review'; file: ExtractedDocument; read: ReadDocument }

type AiStatus = InvokeRes<'ai.status'>

const PROVIDER: Record<NonNullable<AiStatus['provider']>, string> = { anthropic: 'Anthropic', openai: 'OpenAI', grok: 'xAI', ollama: 'Ollama' }

/** Where the document goes, in words: "Anthropic (claude-opus-5-5)", "Ollama on http://…". */
function destination(s: AiStatus): string {
  if (!s.provider) return 'your AI provider'
  if (s.provider === 'ollama') return `Ollama at ${s.ollamaHost ?? 'http://127.0.0.1:11434'}${s.model ? ` (${s.model})` : ''}`
  return `${PROVIDER[s.provider]}${s.model ? ` (${s.model})` : ''}`
}

async function saveTemplate() {
  await bridge().invoke('files.saveAs', { defaultName: TEMPLATE_FILE_NAME, bytes: new TextEncoder().encode(TEMPLATE_CSV), filters: [{ name: 'CSV', extensions: ['csv'] }] })
}

const dayLabel = (d: DateKey) => formatDate(dateKeyToMs(d))
const SPORT_GROUP = { bike: 'ride', run: 'run', swim: 'swim', other: 'other' } as const

export function DocumentImport({
  event,
  planName,
  onBack,
  onCreated,
}: {
  /** The event chosen in the flow's first step, if any: it wins over the document's race. */
  event?: Event
  planName: string
  onBack: () => void
  onCreated: (planId: string, notice?: { tone: 'good' | 'bad'; text: string }) => void
}) {
  const [phase, setPhase] = useState<Phase>({ at: 'pick' })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [ai, setAi] = useState<AiStatus | null>(null)
  const [thresholds, setThresholds] = useState<SessionThresholds>({})
  const fileInput = useRef<HTMLInputElement>(null)
  // a read that was abandoned (Back, another file) must not land on top of what replaced it
  const run = useRef(0)

  useEffect(() => {
    let live = true
    void bridge()
      .invoke('ai.status', {})
      .then((s) => live && setAi(s))
      .catch(() => undefined)
    void sessionThresholds()
      .then((t) => live && setThresholds(t))
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [])

  const aiReady = !!ai && ai.configured && ai.provider !== null && !ai.breakerOpen

  const pick = async (file: File | undefined) => {
    if (!file) return
    const token = ++run.current
    setError(null)
    setBusy(true)
    try {
      const doc = await extractDocument(file)
      if (token === run.current) setPhase({ at: 'loaded', file: doc })
    } catch (e) {
      if (token === run.current) setError(e instanceof DocumentReadError ? e.message : `Couldn't read ${file.name}: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      if (token === run.current) setBusy(false)
    }
  }

  const readIt = async (file: ExtractedDocument, via: 'ai' | 'template') => {
    const token = ++run.current
    setError(null)
    if (via === 'template') return setPhase({ at: 'review', file, read: readTemplateDocument(file) })
    setPhase({ at: 'reading', file, part: 1, parts: chunkDocument(file.text).chunks.length })
    try {
      const read = await readWithAi(file, { onProgress: (part, parts) => token === run.current && setPhase({ at: 'reading', file, part, parts }) })
      if (token === run.current) setPhase({ at: 'review', file, read })
    } catch (e) {
      if (token !== run.current) return
      setPhase({ at: 'loaded', file })
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const back = () => {
    run.current++
    setError(null)
    setBusy(false)
    if (phase.at === 'pick') onBack()
    else setPhase({ at: 'pick' })
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    // the Workouts page takes dropped workout files too: this one is the plan's
    e.stopPropagation()
    setDragging(false)
    void pick(e.dataTransfer.files[0])
  }

  return (
    <div className="space-y-4" data-testid={`doc-import-${phase.at}`}>
      {phase.at === 'pick' && (
        <>
          <input
            ref={fileInput}
            type="file"
            accept={PLAN_DOCUMENT_EXTENSIONS.join(',')}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              void pick(file)
            }}
            data-testid="doc-import-file"
          />
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            onDragOver={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            disabled={busy}
            className={cn('flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-line-strong bg-panel-2 px-4 py-8 text-center hover:border-accent disabled:opacity-50', dragging && 'border-accent bg-accent/10')}
            data-testid="doc-import-choose"
          >
            {busy ? <Loader2 className="size-6 animate-spin text-accent" /> : <Upload className="size-6 text-accent" />}
            <span className="font-semibold">{busy ? 'Reading the file…' : 'Choose your plan, or drop it here'}</span>
            <span className="text-xs text-ink-dim">A .csv, .xlsx, .docx, .pdf, .md or .txt file. It’s read on this computer; nothing is sent until you say so.</span>
          </button>
          <TemplateHelp />
        </>
      )}

      {phase.at === 'loaded' && <Loaded file={phase.file} ai={ai} aiReady={aiReady} onRead={(via) => void readIt(phase.file, via)} />}

      {phase.at === 'reading' && (
        <div className="flex items-start gap-3 py-8 text-sm text-ink-dim" role="status" data-testid="doc-import-progress">
          <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin" />
          <span>
            {phase.parts > 1 ? `Reading part ${phase.part} of ${phase.parts}…` : 'Reading your plan…'} {ai ? destination(ai) : 'Your AI provider'} is turning it into sessions; a long plan takes a few minutes.
          </span>
        </div>
      )}

      {phase.at === 'review' && <Review file={phase.file} read={phase.read} event={event} planName={planName} thresholds={thresholds} onBack={back} onCreated={onCreated} />}

      {error && (
        <div className="rounded-xl border border-bad/40 bg-bad/10 px-4 py-3 text-sm" role="alert">
          {error}
        </div>
      )}

      {phase.at !== 'review' && (
        <div className="flex justify-between gap-2 border-t border-line pt-4">
          <Button variant="ghost" onClick={back} data-testid="doc-import-back">
            Back
          </Button>
        </div>
      )}
    </div>
  )
}

function TemplateHelp() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line px-3 py-2 text-xs text-ink-dim">
      <span>No AI? Write the plan in CrankHog’s template, a session a row (date, sport, name, steps), and it’s read without AI.</span>
      <Button size="sm" onClick={() => void saveTemplate()} data-testid="doc-import-template-download">
        <Download className="size-3.5" /> Download the template
      </Button>
    </div>
  )
}

/** The file is read: what's in it, and how it will be read, with where it would go. */
function Loaded({ file, ai, aiReady, onRead }: { file: ExtractedDocument; ai: AiStatus | null; aiReady: boolean; onRead: (via: 'ai' | 'template') => void }) {
  const template = isPlanTemplate(file.rows ?? [])
  const parts = chunkDocument(file.text).chunks.length
  return (
    <>
      <div className="flex items-center gap-3 rounded-xl bg-panel-2 px-3 py-2 text-sm">
        <FileText className="size-4 shrink-0 text-accent" />
        <span className="min-w-0 flex-1 truncate font-semibold">{file.fileName}</span>
        <span className="tabular text-xs text-ink-dim">
          {file.text.length.toLocaleString()} characters{!template && parts > 1 ? ` · ${parts} parts` : ''}
        </span>
      </div>
      {template ? (
        <>
          <p className="text-sm text-ink-dim">This is CrankHog’s plan template, so it’s read here, without AI.</p>
          <Button variant="primary" onClick={() => onRead('template')} data-testid="doc-import-template">
            Read the template
          </Button>
        </>
      ) : aiReady && ai ? (
        <>
          <div className="rounded-xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm" data-testid="doc-import-notice">
            Reading it sends the document’s text to <strong>{destination(ai)}</strong>, the AI provider you chose in Settings → AI, to turn it into sessions. Nothing else goes with it: not your rides, your profile or any other file.
          </div>
          <Button variant="primary" onClick={() => onRead('ai')} data-testid="doc-import-ai">
            Send it and read it
          </Button>
        </>
      ) : (
        <>
          <p className="text-sm text-ink-dim" data-testid="doc-import-no-ai">
            Reading a document needs an AI provider: set one up in Settings → AI (AI needs the Mac app). Or write the plan in CrankHog’s template, which is read without AI.
          </p>
          <TemplateHelp />
        </>
      )}
    </>
  )
}

/** What will be made, and what won't and why, before anything is saved. */
function Review({
  file,
  read,
  event,
  planName,
  thresholds,
  onBack,
  onCreated,
}: {
  file: ExtractedDocument
  read: ReadDocument
  event?: Event
  planName: string
  thresholds: SessionThresholds
  onBack: () => void
  onCreated: (planId: string, notice?: { tone: 'good' | 'bad'; text: string }) => void
}) {
  const { ftpW } = useFtp()
  const { doc, problems } = read
  const [now] = useState(() => Date.now())
  const today = dateKey(now)
  const docRace = doc.race && doc.race.date > today ? doc.race : undefined
  const [name, setName] = useState(() => planName.trim() || doc.name || file.fileName.replace(/\.[^.]+$/, ''))
  const [addRace, setAddRace] = useState(true)
  const race: Event | undefined = event ?? (docRace && addRace ? { ...docRace, priority: 'A' } : undefined)
  const [start, setStart] = useState(() => defaultStart(doc, event?.date ?? docRace?.date))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const prepared = useMemo(() => prepareImport(doc, { start, raceDate: race?.date, ftpW, thresholds, now }), [doc, start, race?.date, ftpW, thresholds, now])
  const byWeek = doc.items.some((i) => !i.date && i.week !== undefined)
  const past = prepared.ready.filter((r) => r.date && r.date < today).length
  const failed: ImportProblem[] = [...problems, ...prepared.failed]
  const counts = (['bike', 'run', 'swim', 'other'] as const)
    .map((s) => [s, prepared.ready.filter((r) => r.item.sport === s).length] as const)
    .filter(([, n]) => n > 0)
    .map(([s, n]) => `${n} ${s === 'bike' ? (n === 1 ? 'ride' : 'rides') : s === 'other' ? 'other' : n === 1 ? s : `${s}s`}`)

  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      const plan = await saveImport(prepared.ready, { name: name.trim() || 'Training plan', start, event: race, ftpW })
      const n = prepared.ready.length
      const missed = failed.length + prepared.leftOut.length
      onCreated(plan.id, { tone: missed > 0 ? 'bad' : 'good', text: `${plan.name}: ${n} session${n === 1 ? '' : 's'} on your calendar.${missed > 0 ? ` ${missed} from the document ${missed === 1 ? 'wasn’t' : 'weren’t'} made; the review listed why.` : ''}` })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  return (
    <>
      <Field label="Plan name">
        <Input value={name} onChange={(e) => setName(e.target.value)} aria-label="Plan name" data-testid="doc-import-name" />
      </Field>
      {byWeek && (
        <Field label="Week 1 starts" hint={doc.startDate ? 'The Monday the document starts on.' : race ? `Counted back so the last week is the week of ${race.name}. Move it if the plan starts earlier.` : 'Weeks are counted from this Monday.'}>
          <Input
            type="date"
            value={start}
            onChange={(e) => isRealDate(e.target.value) && setStart(mondayOf(e.target.value))}
            className="max-w-48"
            aria-label="Week 1 starts"
            data-testid="doc-import-start"
          />
        </Field>
      )}
      {event ? (
        <p className="text-sm text-ink-dim">
          Builds to {event.name}, {dayLabel(event.date)}.
        </p>
      ) : (
        docRace && <Switch checked={addRace} onChange={setAddRace} label={`Put ${docRace.name} on the calendar as an A race, ${dayLabel(docRace.date)}`} />
      )}

      <p className="text-sm" data-testid="doc-import-summary">
        <span className="font-semibold">
          {prepared.ready.length} session{prepared.ready.length === 1 ? '' : 's'} will be made
        </span>
        {counts.length > 0 && <span className="text-ink-dim"> · {counts.join(', ')}</span>}
        {past > 0 && <span className="text-warn"> · {past} dated before today</span>}
      </p>
      <ol className="max-h-64 space-y-1 overflow-y-auto" aria-label="Sessions to make">
        {prepared.ready.map((r, i) => (
          <ReadyRow key={i} r={r} race={!!race} />
        ))}
      </ol>

      <ProblemList title={`Not made (${failed.length})`} items={failed} testId="doc-import-failed-item" tone="bad" />
      <ProblemList title={`Left out (${prepared.leftOut.length})`} items={prepared.leftOut} testId="doc-import-left-out-item" />
      <ProblemList title={`Not read as sessions (${doc.skipped.length})`} items={doc.skipped.map((s) => ({ where: s.text, reason: s.reason }))} testId="doc-import-skipped-item" />

      {error && (
        <div className="rounded-xl border border-bad/40 bg-bad/10 px-4 py-3 text-sm" role="alert">
          {error}
        </div>
      )}
      <div className="flex justify-between gap-2 border-t border-line pt-4">
        <Button variant="ghost" onClick={onBack} disabled={busy} data-testid="doc-import-back">
          Back
        </Button>
        <Button variant="primary" onClick={() => void save()} disabled={busy || prepared.ready.length === 0} data-testid="doc-import-save">
          {busy && <Loader2 className="size-4 animate-spin" />} Put on calendar
        </Button>
      </div>
    </>
  )
}

function ReadyRow({ r, race }: { r: ReadyItem; race: boolean }) {
  return (
    <li className="flex items-center gap-3 rounded-lg bg-panel-2 px-3 py-1.5 text-sm" data-testid="doc-import-ready-item">
      <span className="w-28 shrink-0 tabular text-xs text-ink-dim">{r.date ? dayLabel(r.date) : race ? 'Before race day' : 'Next ride day'}</span>
      <SportIcon sport={SPORT_GROUP[r.item.sport]} workout={r.kind === 'bike'} className="size-4 shrink-0 text-ink-dim" aria-label={r.item.sport} />
      <span className="min-w-0 flex-1">
        <span className="block truncate">{r.item.name}</span>
        {r.warnings[0] && <span className="block truncate text-xs text-ink-faint">{r.warnings[0]}</span>}
      </span>
      <span className="shrink-0 tabular text-xs text-ink-dim">{r.durationS ? formatDurationShort(r.durationS) : '—'}</span>
    </li>
  )
}

function ProblemList({ title, items, testId, tone }: { title: string; items: readonly ImportProblem[]; testId: string; tone?: 'bad' }) {
  if (items.length === 0) return null
  return (
    <details className={cn('rounded-xl border px-3 py-2 text-sm', tone === 'bad' ? 'border-bad/40 bg-bad/5' : 'border-line')} open={tone === 'bad'}>
      <summary className="cursor-pointer font-semibold">{title}</summary>
      <ul className="mt-2 max-h-40 space-y-1.5 overflow-y-auto">
        {items.map((p, i) => (
          <li key={i} data-testid={testId}>
            <span className="text-ink-dim">{p.where}</span>
            {p.name && <span className="font-semibold"> · {p.name}</span>}
            <span className="block text-xs text-ink-dim">{p.reason}</span>
          </li>
        ))}
      </ul>
    </details>
  )
}
