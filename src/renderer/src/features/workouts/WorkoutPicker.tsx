import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import type { SessionWorkout } from '@core/multisport/model'
import { useFtp } from '../../db/use-athlete'
import { listPlans } from '../../plan/plans-repo'
import { cn } from '../../ui/cn'
import { Input } from '../../ui/form'
import { Segmented } from '../../ui/Segmented'
import { sessionThresholds } from '../../workouts/sessions-repo'
import { SESSIONS_NOUN, useSessions } from '../sessions/sessions'
import { SessionCard } from '../sessions/SessionsPanel'
import { loadLibrary, type LibraryEntry } from '../../workouts/library'
import { filterChips, filterRows, folderRows, shownPlanOf, type Filter, type Folder, type Length } from './folders'
import { WorkoutCard } from './WorkoutCard'
import { FolderTabs, PlanSelect, WorkoutFilterBar } from './WorkoutFolders'

const FOLDERS: { id: Folder; label: string }[] = [
  { id: 'crankhog', label: 'CrankHog workouts' },
  { id: 'custom', label: 'Custom workouts' },
  { id: 'plan', label: 'Training plan' },
]

type Sport = 'bike' | 'run' | 'swim'
const SPORTS = [
  { value: 'bike' as const, label: 'Bike' },
  { value: 'run' as const, label: 'Run' },
  { value: 'swim' as const, label: 'Swim' },
]

/**
 * The Workouts tab in a dialog, for picking one: bike, run or swim, the same
 * folders, search and filters, and a click on a card picks it. Bike opens on
 * the latest plan with workouts in it, else on CrankHog's workouts.
 */
export function WorkoutPicker({ onPick, onPickSession, disabled }: { onPick: (entry: LibraryEntry) => void; onPickSession: (w: SessionWorkout) => void; disabled?: boolean }) {
  const [sport, setSport] = useState<Sport>('bike')
  return (
    <div data-testid="workout-picker">
      <Segmented ariaLabel="Sport" value={sport} onChange={setSport} options={SPORTS} className="mb-3" />
      {sport === 'bike' ? <BikePicker onPick={onPick} disabled={disabled} /> : <SessionPicker key={sport} sport={sport} onPick={onPickSession} disabled={disabled} />}
    </div>
  )
}

/** Runs or swims, searched by name and steps. */
function SessionPicker({ sport, onPick, disabled }: { sport: 'run' | 'swim'; onPick: (w: SessionWorkout) => void; disabled?: boolean }) {
  const [query, setQuery] = useState('')
  const sessions = useSessions(sport, query)
  const loaded = useLiveQuery(() => sessionThresholds(), [])
  const thresholds = useMemo(() => loaded ?? {}, [loaded])
  if (!sessions) return <p className="py-10 text-center text-sm text-ink-faint">…</p>
  return (
    <>
      <div className="relative mb-3 w-64">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${SESSIONS_NOUN[sport]}`} className="pl-9" aria-label={`Search ${SESSIONS_NOUN[sport]}`} />
      </div>
      <div className="-mx-2 max-h-[min(52vh,560px)] overflow-y-auto px-2 pb-2">
        {sessions.length === 0 ? (
          <p className="mx-auto max-w-md py-10 text-center text-sm text-ink-faint">{query.trim() ? `No ${SESSIONS_NOUN[sport]} match.` : `No ${SESSIONS_NOUN[sport]} yet. Build one in the builder, or import one on the Workouts page.`}</p>
        ) : (
          <div className={cn('grid gap-3 sm:grid-cols-2 md:grid-cols-3', disabled && 'pointer-events-none opacity-60')} data-testid="picker-session-grid">
            {sessions.map((w) => (
              <SessionCard key={w.id} workout={w} thresholds={thresholds} onOpen={() => onPick(w)} />
            ))}
          </div>
        )}
      </div>
    </>
  )
}

function BikePicker({ onPick, disabled }: { onPick: (entry: LibraryEntry) => void; disabled?: boolean }) {
  const { ftpW } = useFtp()
  const library = useLiveQuery(() => loadLibrary(ftpW), [ftpW])
  const plans = useLiveQuery(() => listPlans(), [])
  const [picked, setPicked] = useState<Folder | null>(null)
  const [planId, setPlanId] = useState<string | null>(null)
  const [allPlans, setAllPlans] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')
  const [length, setLength] = useState<Length>('any')
  const [query, setQuery] = useState('')

  // the latest plan with a workout in it, so an empty new plan doesn't hide the one you ride
  const planWithWorkouts = plans?.find((p) => p.items.some((i) => !i.sport))
  const folder = picked ?? (planWithWorkouts ? 'plan' : 'crankhog')
  const shownPlan = shownPlanOf(plans ?? [], planId ?? planWithWorkouts?.id ?? null, allPlans)
  const rows = useMemo(() => folderRows(folder, library ?? [], plans ?? [], shownPlan), [folder, library, plans, shownPlan])
  const visible = useMemo(() => filterRows(rows, { filter, length, query }), [rows, filter, length, query])
  const counts: Record<Folder, number | undefined> = {
    crankhog: library?.filter((e) => e.folder === 'crankhog').length,
    custom: library?.filter((e) => e.folder !== 'crankhog').length,
    plan: plans?.length,
  }

  if (!library || !plans) return <p className="py-10 text-center text-sm text-ink-faint">…</p>
  return (
    <div>
      <FolderTabs
        tabs={FOLDERS.map((f) => ({ ...f, count: counts[f.id] }))}
        value={folder}
        onChange={(f) => {
          setPicked(f)
          if (f !== 'crankhog' && filter === 'tests') setFilter('all')
        }}
        label="Workout folders"
        testIdPrefix="picker-tab"
      />
      <WorkoutFilterBar query={query} onQuery={setQuery} length={length} onLength={setLength} filter={filter} onFilter={setFilter} chips={filterChips(folder, rows)} className="mb-3">
        {folder === 'plan' && plans.length > 1 && (
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
      {/* its own scroll, so the folders and filters stay put; the padding keeps the plan numbers in view */}
      <div className="-mx-2 max-h-[min(52vh,560px)] overflow-y-auto px-2 pb-2 pt-2">
        {visible.length === 0 ? (
          <p className="mx-auto max-w-md py-10 text-center text-sm text-ink-faint">
            {rows.length > 0
              ? 'No workouts match. Try another filter.'
              : folder === 'custom'
                ? 'No workouts of your own yet. Build one or import files on the Workouts page.'
                : plans.length === 0
                  ? 'No training plans yet. Add one on the Workouts page, under Training plan.'
                  : 'No workouts in this plan yet.'}
          </p>
        ) : (
          <div className={cn('grid gap-3 sm:grid-cols-2 md:grid-cols-3', disabled && 'pointer-events-none opacity-60')} data-testid="picker-grid">
            {visible.map((r) => (
              <WorkoutCard key={r.key} entry={r.entry} ftpW={ftpW} onOpen={() => onPick(r.entry)} plan={folder === 'plan' ? { n: r.n } : undefined} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
