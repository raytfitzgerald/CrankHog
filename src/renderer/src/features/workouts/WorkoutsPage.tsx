import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useRef, useState, type DragEvent } from 'react'
import { Link, useSearch } from '@tanstack/react-router'
import { FileUp, Gauge, Plus } from 'lucide-react'
import { useFtp } from '../../db/use-athlete'
import { Button } from '../../ui/Button'
import { PageHeader } from '../../ui/PageHeader'
import { Segmented, type SegmentedOption } from '../../ui/Segmented'
import { cn } from '../../ui/cn'
import { IMPORT_EXTENSIONS, loadLibrary, parseWorkoutFile, saveWorkout } from '../../workouts/library'
import { planImportNotice } from '../plan/import-notice'
import { PlansPanel } from '../plan/PlansPanel'
import { createPlan, deletePlan, importIntoPlan, listPlans } from '../../plan/plans-repo'
import { WorkoutDetailDialog } from './WorkoutDetailDialog'
import type { SessionSport } from '@core/multisport/model'
import { isSessionFile } from '@core/multisport/parse'
import { importWorkoutFiles, type ImportLine } from '../../workouts/session-import'
import { ImportReport } from '../sessions/ImportReport'
import { SESSIONS_NOUN } from '../sessions/sessions'
import { SessionsPanel } from '../sessions/SessionsPanel'
import { listSessionWorkouts } from '../../workouts/sessions-repo'
import { filterChips, filterRows, folderRows, shownPlanOf, type Filter, type Folder, type Length } from './folders'
import { WorkoutCard } from './WorkoutCard'
import { FolderTabs, PlanSelect, WorkoutFilterBar } from './WorkoutFolders'

/** Bike workouts, which CrankHog rides on the trainer, or run, swim and other sessions, which it plans. */
type Sport = 'bike' | SessionSport
type Tab = Folder

const TABS: { id: Tab; label: string; empty: string }[] = [
  { id: 'crankhog', label: 'CrankHog workouts', empty: 'No workouts match. Try another filter.' },
  { id: 'custom', label: 'Custom workouts', empty: 'Nothing here yet. Build one with New workout, copy a CrankHog workout to the builder, or drop .zwo, .mrc or .erg files on this page.' },
  { id: 'plan', label: 'Training plan', empty: '' },
]
/** The Training plan tab: your plans, to edit and put on the calendar, or their workouts, to search, filter and ride like any folder. */
type PlanView = 'plans' | 'workouts'
const PLAN_VIEWS: SegmentedOption<PlanView>[] = [
  { value: 'plans', label: 'Plans and calendar', hint: 'Build plans and lay them out on your calendar' },
  { value: 'workouts', label: 'Browse workouts', hint: 'Search and filter the workouts in your plans, and ride any of them' },
]

export function WorkoutsPage() {
  const { ftpW, known } = useFtp()
  const library = useLiveQuery(() => loadLibrary(ftpW), [ftpW])
  const search = useSearch({ from: '/workouts' })
  const initial = search.filter
  // CrankHog's own workouts first; ?filter=mine (older links) opens your custom ones
  const [sport, setSport] = useState<Sport>('bike')
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
  const [planView, setPlanView] = useState<PlanView>('plans')
  /** Browse workouts: every plan's workouts, instead of the open plan's. */
  const [allPlans, setAllPlans] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const plans = useLiveQuery(() => listPlans(), [])
  const browsingPlan = sport === 'bike' && tab === 'plan' && planView === 'workouts'
  /** The tab lists workout cards, with search and filters. */
  const grid = (sport === 'bike' && (tab === 'crankhog' || tab === 'custom')) || browsingPlan
  const shownPlan = shownPlanOf(plans ?? [], planId, allPlans)
  const inTab = useMemo(() => folderRows(tab, library ?? [], plans ?? [], shownPlan), [library, tab, plans, shownPlan])
  const sessionSports = useLiveQuery(async () => new Set((await listSessionWorkouts()).map((w) => w.sport)), [])
  // Other sessions (a squash game) get a tab once there are some
  const sports: SegmentedOption<Sport>[] = [
    { value: 'bike', label: 'Bike' },
    { value: 'run', label: 'Run' },
    { value: 'swim', label: 'Swim' },
    ...(sessionSports?.has('other') || sport === 'other' ? [{ value: 'other' as const, label: 'Other' }] : []),
  ]
  const [report, setReport] = useState<ImportLine[] | null>(null)
  const counts = useMemo(() => {
    const c: Record<Tab, number> = { crankhog: 0, custom: 0, plan: plans?.length ?? 0 }
    // Custom workouts: every workout of the rider's own, filed in a plan or not
    for (const e of library ?? []) c[e.folder === 'crankhog' ? 'crankhog' : 'custom']++
    return c
  }, [library, plans])

  const visible = useMemo(() => filterRows(inTab, { filter, length, query }), [inTab, filter, length, query])

  const importFiles = async (files: FileList | File[]) => {
    if (sport === 'bike' && tab === 'plan') return importIntoOpenPlan(Array.from(files))
    // run, swim and other sessions (a .txt with a sport line) get the import report
    const read = await Promise.all(Array.from(files).map(async (f) => ({ name: f.name, text: await f.text() })))
    if (sport !== 'bike' || read.some((f) => isSessionFile(f.text))) {
      const lines = await importWorkoutFiles(read, 'library')
      setNotice(null)
      setReport(lines)
      // to the tab of what came in, unless it's this one
      const landed = lines.filter((l) => l.kind === 'session' && l.outcome === 'library' && l.sport).map((l) => l.sport!)
      if (landed.length > 0 && !landed.includes(sport as SessionSport)) setSport(landed[0]!)
      return
    }
    const done: string[] = []
    const failed: string[] = []
    const ordered = Array.from(files).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
    for (const f of ordered) {
      try {
        const { workout } = parseWorkoutFile(f.name, read.find((r) => r.name === f.name)?.text ?? (await f.text()))
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
    if (done.length > 0) {
      setSport('bike')
      pickTab('custom')
    }
  }

  /** Files dropped on the Training plan tab go into the plan open there (a new "Training plan" when there is none), in file-name order. */
  const importIntoOpenPlan = async (files: File[]) => {
    try {
      const latest = await listPlans()
      const existing = latest.find((p) => p.id === planId) ?? latest[0]
      const plan = existing ?? (await createPlan({ name: 'Training plan', source: 'files' }))
      const r = await importIntoPlan(plan.id, await Promise.all(files.map(async (f) => ({ name: f.name, text: await f.text() }))))
      if (!existing && r.added === 0) await deletePlan(plan.id)
      else setPlanId(plan.id)
      // sessions and skipped files get the full report, with reasons by line
      if (r.lines.some((l) => l.kind === 'session' || l.outcome === 'skipped')) {
        setNotice(null)
        setReport(r.lines)
      } else setNotice(planImportNotice(plan.name, r))
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
        subtitle={sport === 'bike' ? `${library?.length ?? '…'} bike workouts. Targets shown at your FTP of ${ftpW} W${known ? '' : ' (not tested yet)'}.` : `Your ${SESSIONS_NOUN[sport]}, to plan on the calendar or in a training plan. Paces and heart rates come from your thresholds in Settings.`}
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
            {!(sport === 'bike' && tab === 'plan') && (
              <Button size="sm" onClick={() => fileInput.current?.click()} title="Or drop .zwo / .mrc / .erg / .txt files on this page. Run and swim sessions are .txt files with a sport line." data-testid="import-workouts">
                <FileUp className="size-3.5" /> Import
              </Button>
            )}
            {sport === 'bike' && (
              <Button size="sm" variant="primary" asChild>
                <Link to="/builder">
                  <Plus className="size-3.5" /> New workout
                </Link>
              </Button>
            )}
          </>
        }
      />

      {sport === 'bike' && !known && (
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
      {report && <ImportReport lines={report} onDismiss={() => setReport(null)} />}

      <Segmented ariaLabel="Sport" value={sport} onChange={setSport} options={sports} className="mb-4" />

      {sport === 'bike' && <FolderTabs tabs={TABS.map((t) => ({ ...t, count: counts[t.id] }))} value={tab} onChange={pickTab} label="Workout folders" testIdPrefix="workout-tab" />}

      {sport === 'bike' && tab === 'plan' && <Segmented ariaLabel="Training plan view" value={planView} onChange={setPlanView} options={PLAN_VIEWS} className="mb-4" />}
      {sport === 'bike' && tab === 'plan' && planView === 'plans' && (
        <PlansPanel
          selected={planId}
          onSelect={(id) => {
            setPlanId(id)
            setAllPlans(false)
          }}
          onNotice={setNotice}
        />
      )}
      {sport !== 'bike' && <SessionsPanel key={sport} sport={sport} onNotice={setNotice} />}

      <WorkoutFilterBar
        query={query}
        onQuery={setQuery}
        length={length}
        onLength={setLength}
        filter={filter}
        onFilter={setFilter}
        chips={filterChips(tab, inTab)}
        className={cn(!grid && 'hidden')}
      >
        {browsingPlan && plans && plans.length > 1 && (
          <PlanSelect
            plans={plans}
            shown={shownPlan}
            onChange={(id) => {
              setAllPlans(!id)
              if (id) setPlanId(id)
            }}
          />
        )}
      </WorkoutFilterBar>

      {grid && library && plans && visible.length === 0 && (
        <div className="mx-auto max-w-md py-16 text-center text-ink-faint">
          {inTab.length > 0
            ? 'No workouts match. Try another filter.'
            : tab !== 'plan'
              ? TABS.find((t) => t.id === tab)!.empty
              : plans.length === 0
                ? 'No training plans yet. Add one under Plans and calendar.'
                : 'No workouts in this plan yet. Add some under Plans and calendar.'}
        </div>
      )}
      {grid && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="workout-grid">
          {visible.map((r) => (
            <WorkoutCard key={r.key} entry={r.entry} ftpW={ftpW} onOpen={() => setOpenId(r.entry.workout.id)} plan={tab === 'plan' ? { n: r.n } : undefined} />
          ))}
        </div>
      )}

      {open && <WorkoutDetailDialog entry={open} ftpW={ftpW} onClose={() => setOpenId(null)} onNotice={setNotice} />}
    </div>
  )
}
