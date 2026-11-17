import { useMemo } from 'react'
import { Star } from 'lucide-react'
import { WorkoutThumb } from '../../charts/WorkoutThumb'
import { formatDurationShort } from '../../ui/format'
import { tagLabel, type LibraryEntry } from '../../workouts/library'
import { profileBlocks } from '../../workouts/profile'

/** A workout's card: its shape at the rider's FTP, name, numbers and tags. */
export function WorkoutCard({
  entry,
  ftpW,
  onOpen,
  plan,
}: {
  entry: LibraryEntry
  ftpW: number
  onOpen: () => void
  /** On the Training plan folder: its place in the plan, when one plan is shown. */
  plan?: { n?: number }
}) {
  const { workout: w, stats } = entry
  const blocks = useMemo(() => profileBlocks(entry.timeline, ftpW), [entry.timeline, ftpW])
  const card = (
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
        {entry.folder === 'plan' && !plan && <span className="rounded bg-panel-3 px-1.5 py-0.5 text-[10px] text-ink-dim">In a plan</span>}
        {w.tags.slice(0, 3).map((t) => (
          <span key={t} className="rounded bg-panel-3 px-1.5 py-0.5 text-[10px] text-ink-dim">
            {tagLabel(t)}
          </span>
        ))}
      </div>
    </button>
  )
  if (plan?.n === undefined) return card
  return (
    <div className="relative">
      <span className="absolute -left-2 -top-2 z-10 grid size-7 place-items-center rounded-full bg-accent font-display text-sm font-bold text-on-accent" aria-label={`Number ${plan.n} in your plan`}>
        {plan.n}
      </span>
      {card}
    </div>
  )
}
