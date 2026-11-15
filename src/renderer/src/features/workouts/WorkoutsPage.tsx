import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useRef, useState, type DragEvent } from 'react'
import { Link, useSearch } from '@tanstack/react-router'
import { FileUp, Gauge, Plus, Search, Star } from 'lucide-react'
import { WorkoutThumb } from '../../charts/WorkoutThumb'
import { useFtp } from '../../db/use-athlete'
import { Button } from '../../ui/Button'
import { Input, Select } from '../../ui/form'
import { PageHeader } from '../../ui/PageHeader'
import { cn } from '../../ui/cn'
import { formatDurationShort } from '../../ui/format'
import { IMPORT_EXTENSIONS, loadLibrary, parseWorkoutFile, saveWorkout, tagLabel, type LibraryEntry } from '../../workouts/library'
import { profileBlocks } from '../../workouts/profile'
import { db } from '../../db/db'
import { planImportNotice } from '../plan/import-notice'
import { PlansPanel } from '../plan/PlansPanel'
import { createPlan, deletePlan, importIntoPlan, listPlans } from '../../plan/plans-repo'
import { WorkoutDetailDialog } from './WorkoutDetailDialog'

type Filter = 'all' | 'favorites' | 'tests' | `tag:${string}`
type Tab = LibraryEntry['folder']

const TABS: { id: Tab; label: string; empty: string }[] = [
  { id: 'crankhog', label: 'CrankHog workouts', empty: 'No workouts match. Try another filter.' },
  { id: 'custom', label: 'Custom workouts', empty: 'Nothing here yet. Build one with New workout, copy a CrankHog workout to the builder, or drop .zwo, .mrc or .erg files on this page.' },
  { id: 'plan', label: 'Training plan', empty: '' },
]
type Length = 'any' | 'short' | 'medium' | 'long'

const LENGTHS: { id: Length; label: string; test: (s: number) => boolean }[] = [
  { id: 'any', label: 'Any length', test: () => true },
  { id: 'short', label: 'Under 45 min', test: (s) => s < 45 * 60 },
  { id: 'medium', label: '45–75 min', test: (s) => s >= 45 * 60 && s <= 75 * 60 },
  { id: 'long', label: 'Over 75 min', test: (s) => s > 75 * 60 },
]

export function WorkoutsPage() {
  const { ftpW, known } = useFtp()
  const library = useLiveQuery(() => loadLibrary(ftpW), [ftpW])
  const search = useSearch({ from: '/workouts' })
  const initial = search.filter
  // CrankHog's own workouts first; ?filter=mine (older links) opens your custom ones
  const [tab, setTab] = useState<Tab>(initial === 'mine' ? 'custom' : 'crankhog')
  const [filter, setFilter] = useState<Filter>(initial === 'tests' || initial === 'favorites' ? initial : 'all')
  const pickTab = (t: Tab) => {
    setTab(t)
    if (t !== 'crankhog' && filter === 'tests') setFilter('all')
  }
  const [length, setLength] = useState<Length>('any')
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState<string | null>(search.open ?? null)
  const [notice, setNotice] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null)
  const [dragging, setDragging] = useState(false)
  /** The plan open on the Training plan tab (null: the latest). */
  const [planId, setPlanId] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const tags = useMemo(() => {
    const count = new Map<string, number>()
    for (const e of library ?? []) if ((tab === 'custom' ? e.folder !== 'crankhog' : e.folder === tab)) for (const t of e.workout.tags) if (t !== 'test' && t !== 'ftp') count.set(t, (count.get(t) ?? 0) + 1)
    return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t)
  }, [library, tab])
  const planCount = useLiveQuery(() => db().plans.count(), [])
  const counts = useMemo(() => {
    const c: Record<Tab, number> = { crankhog: 0, custom: 0, plan: planCount ?? 0 }
    // Custom workouts: every workout of the rider's own, filed in a plan or not
    for (const e of library ?? []) c[e.folder === 'crankhog' ? 'crankhog' : 'custom']++
    return c
  }, [library, planCount])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const lengthTest = LENGTHS.find((l) => l.id === length)!.test
    const inTab = (library ?? []).filter((e) => (tab === 'custom' ? e.folder !== 'crankhog' : e.folder === tab))
    return inTab.filter((e) => {
      const w = e.workout
      if (filter === 'favorites' && !e.favorite) return false
      if (filter === 'tests' && !w.ftpTest) return false
      if (filter.startsWith('tag:') && !w.tags.includes(filter.slice(4))) return false
      if (!lengthTest(e.stats.durationS)) return false
      return !q || w.name.toLowerCase().includes(q) || (w.description ?? '').toLowerCase().includes(q) || w.tags.some((t) => t.includes(q))
    })
  }, [library, tab, filter, length, query])

  const importFiles = async (files: FileList | File[]) => {
    if (tab === 'plan') return importIntoOpenPlan(Array.from(files))
    const done: string[] = []
    const failed: string[] = []
    const ordered = Array.from(files).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
    for (const f of ordered) {
      try {
        const { workout } = parseWorkoutFile(f.name, await f.text())
        await saveWorkout(workout, ftpW)
        done.push(workout.name)
      } catch (e) {
        failed.push(`${f.name}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
    setNotice(
      failed.length > 0
        ? { tone: 'bad', text: `${done.length ? `Imported ${done.join(', ')}. ` : ''}Couldn't import ${failed.join('; ')}` }
        : { tone: 'good', text: done.length > 5 ? `Imported ${done.length} workouts.` : `Imported ${done.join(', ')}.` },
    )
    if (done.length > 0) pickTab('custom')
  }

  /** Files dropped on the Training plan tab go into the plan open there (a new "Training plan" when there is none), in file-name order. */
  const importIntoOpenPlan = async (files: File[]) => {
    try {
      const plans = await listPlans()
      const existing = plans.find((p) => p.id === planId) ?? plans[0]
      const plan = existing ?? (await createPlan({ name: 'Training plan', source: 'files' }))
      const r = await importIntoPlan(plan.id, await Promise.all(files.map(async (f) => ({ name: f.name, text: await f.text() }))))
      if (!existing && r.added === 0) await deletePlan(plan.id)
      else setPlanId(plan.id)
      setNotice(planImportNotice(plan.name, r))
    } catch (e) {
      setNotice({ tone: 'bad', text: `Couldn't import: ${e instanceof Error ? e.message : String(e)}` })
    }
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files.length > 0) void importFiles(e.dataTransfer.files)
  }

  const open = library?.find((e) => e.workout.id === openId) ?? null
  const chips: { id: Filter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'favorites', label: 'Favorites' },
    ...(tab === 'crankhog' ? [{ id: 'tests' as const, label: 'FTP tests' }] : []),
    ...tags.map((t) => ({ id: `tag:${t}` as const, label: tagLabel(t) })),
  ]

  return (
    <div
      className={cn('mx-auto max-w-6xl px-4 md:px-8 pb-12', dragging && 'outline-2 outline-dashed outline-accent/60')}
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <PageHeader
        title="Workouts"
        subtitle={`${library?.length ?? '…'} workouts. Targets shown at your FTP of ${ftpW} W${known ? '' : ' (not tested yet)'}.`}
        actions={
          <>
            <input
              ref={fileInput}
              type="file"
              multiple
              accept={IMPORT_EXTENSIONS.join(',')}
              className="hidden"
              onChange={(e) => {
                if (e.target.files) void importFiles(e.target.files)
                e.target.value = ''
              }}
            />
            {tab !== 'plan' && (
              <Button size="sm" onClick={() => fileInput.current?.click()} title="Or drop .zwo / .mrc / .erg / .txt files on this page" data-testid="import-workouts">
                <FileUp className="size-3.5" /> Import
              </Button>
            )}
            <Button size="sm" variant="primary" asChild>
              <Link to="/builder">
                <Plus className="size-3.5" /> New workout
              </Link>
            </Button>
          </>
        }
      />

      {!known && (
        <div className="mb-4 flex items-center justify-between gap-4 rounded-2xl border border-accent/40 bg-accent/5 px-5 py-3 text-sm">
          <span className="flex items-center gap-2">
            <Gauge className="size-4 text-accent" /> Workouts are sized to your FTP. You haven't tested yet: the ramp test takes about 20 minutes.
          </span>
          <Button size="sm" onClick={() => setOpenId('builtin:ramp-test')}>
            See the ramp test
          </Button>
        </div>
      )}

      {notice && (
        <div className={cn('mb-4 rounded-xl border px-4 py-2 text-sm', notice.tone === 'good' ? 'border-good/40 bg-good/5' : 'border-bad/40 bg-bad/10')} role="status">
          {notice.text}
        </div>
      )}

      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-line" role="tablist" aria-label="Workout folders">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => pickTab(t.id)}
            className={cn(
              'no-drag -mb-px flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 md:px-4 text-sm font-semibold transition-colors',
              tab === t.id ? 'border-accent text-ink' : 'border-transparent text-ink-dim hover:text-ink',
            )}
            data-testid={`workout-tab-${t.id}`}
          >
            {t.label}
            <span className="tabular rounded-full bg-panel-3 px-2 py-0.5 text-xs font-normal text-ink-dim">{counts[t.id]}</span>
          </button>
        ))}
      </div>

      {tab === 'plan' && <PlansPanel selected={planId} onSelect={setPlanId} onNotice={setNotice} />}

      <div className={cn('mb-5 flex flex-wrap items-center gap-2', tab === 'plan' && 'hidden')}>
        <div className="relative mr-2 w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search workouts" className="pl-9" aria-label="Search workouts" />
        </div>
        <Select value={length} onChange={(e) => setLength(e.target.value as Length)} aria-label="Workout length" className="w-40">
          {LENGTHS.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </Select>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter">
          {chips.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={filter === c.id}
              onClick={() => setFilter(c.id)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs',
                filter === c.id ? 'border-accent bg-accent/15 text-ink' : 'border-line bg-panel-2 text-ink-dim hover:border-line-strong hover:text-ink',
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {tab !== 'plan' && library && visible.length === 0 && (
        <div className="mx-auto max-w-md py-16 text-center text-ink-faint">{counts[tab] === 0 ? TABS.find((t) => t.id === tab)!.empty : 'No workouts match. Try another filter.'}</div>
      )}
      {tab !== 'plan' && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="workout-grid">
          {visible.map((e) => (
            <WorkoutCard key={e.workout.id} entry={e} ftpW={ftpW} onOpen={() => setOpenId(e.workout.id)} />
          ))}
        </div>
      )}

      {open && <WorkoutDetailDialog entry={open} ftpW={ftpW} onClose={() => setOpenId(null)} onNotice={setNotice} />}
    </div>
  )
}

function WorkoutCard({ entry, ftpW, onOpen }: { entry: LibraryEntry; ftpW: number; onOpen: () => void }) {
  const { workout: w, stats } = entry
  const blocks = useMemo(() => profileBlocks(entry.timeline, ftpW), [entry.timeline, ftpW])
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex w-full flex-col rounded-2xl border border-line bg-panel p-4 text-left transition-colors hover:border-line-strong hover:bg-panel-2"
      data-testid="workout-card"
    >
      <div className="rounded-lg bg-panel-2 px-2 pt-2 group-hover:bg-panel-3">
        <WorkoutThumb blocks={blocks} durationS={entry.timeline.durationS} />
      </div>
      <div className="mt-3 flex items-start justify-between gap-2">
        <div className="font-semibold leading-snug">{w.name}</div>
        {entry.favorite && <Star className="mt-0.5 size-4 shrink-0 fill-current text-warn" aria-label="Favorite" />}
      </div>
      <div className="tabular mt-1 text-xs text-ink-dim">
        {w.ftpTest?.protocol === 'ramp' ? (
          // A ramp test ends when you fail, so full-length stats would be fiction.
          'Until you can’t hold it · about 20–30 min · FTP test'
        ) : (
          <>
            {formatDurationShort(stats.durationS)}
            {stats.tss !== null && ` · TSS ${Math.round(stats.tss)}`}
            {stats.if !== null && ` · IF ${stats.if.toFixed(2)}`}
            {w.ftpTest && ' · FTP test'}
          </>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {!entry.builtin && <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[10px] text-ink">{w.source === 'import' ? 'Imported' : w.source === 'ai' ? 'AI' : 'Mine'}</span>}
        {entry.folder === 'plan' && <span className="rounded bg-panel-3 px-1.5 py-0.5 text-[10px] text-ink-dim">In a plan</span>}
        {w.tags.slice(0, 3).map((t) => (
          <span key={t} className="rounded bg-panel-3 px-1.5 py-0.5 text-[10px] text-ink-dim">
            {tagLabel(t)}
          </span>
        ))}
      </div>
    </button>
  )
}
