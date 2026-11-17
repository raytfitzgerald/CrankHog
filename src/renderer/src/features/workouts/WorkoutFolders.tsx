import { Search } from 'lucide-react'
import type { ReactNode } from 'react'
import type { TrainingPlan } from '@core/workout/plan'
import { cn } from '../../ui/cn'
import { Input, Select } from '../../ui/form'
import { LENGTHS, type Filter, type Length } from './folders'

/** The tabs along the top of a set of folders, each with its count. */
export function FolderTabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
  testIdPrefix,
}: {
  tabs: { id: T; label: string; count: number | undefined }[]
  value: T
  onChange: (id: T) => void
  label: string
  testIdPrefix: string
}) {
  return (
    <div className="mb-4 flex gap-1 overflow-x-auto border-b border-line" role="tablist" aria-label={label}>
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            'no-drag -mb-px flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 md:px-4 text-sm font-semibold transition-colors',
            value === t.id ? 'border-accent text-ink' : 'border-transparent text-ink-dim hover:text-ink',
          )}
          data-testid={`${testIdPrefix}-${t.id}`}
        >
          {t.label}
          <span className="tabular rounded-full bg-panel-3 px-2 py-0.5 text-xs font-normal text-ink-dim">{t.count ?? '…'}</span>
        </button>
      ))}
    </div>
  )
}

/** Which plan the Training plan folder shows ("" for all of them). Only worth showing with two or more plans. */
export function PlanSelect({ plans, shown, onChange }: { plans: readonly TrainingPlan[]; shown: TrainingPlan | null; onChange: (planId: string | null) => void }) {
  return (
    <Select value={shown?.id ?? ''} onChange={(e) => onChange(e.target.value || null)} aria-label="Training plan" className="w-48" data-testid="plan-browse-select">
      <option value="">All plans</option>
      {plans.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </Select>
  )
}

/** Search, length and the filter chips over a folder. `children` go first in the row. */
export function WorkoutFilterBar({
  query,
  onQuery,
  length,
  onLength,
  filter,
  onFilter,
  chips,
  className,
  children,
}: {
  query: string
  onQuery: (q: string) => void
  length: Length
  onLength: (l: Length) => void
  filter: Filter
  onFilter: (f: Filter) => void
  chips: { id: Filter; label: string }[]
  className?: string
  children?: ReactNode
}) {
  return (
    <div className={cn('mb-5 flex flex-wrap items-center gap-2', className)}>
      {children}
      <div className="relative mr-2 w-64">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
        <Input value={query} onChange={(e) => onQuery(e.target.value)} placeholder="Search workouts" className="pl-9" aria-label="Search workouts" />
      </div>
      <Select value={length} onChange={(e) => onLength(e.target.value as Length)} aria-label="Workout length" className="w-40">
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
            onClick={() => onFilter(c.id)}
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
  )
}
