import { X } from 'lucide-react'
import { SPORT_GROUP_LABEL } from '@core/sport/group'
import { dateKeyToMs } from '@core/workout/schedule'
import { Button } from '../../ui/Button'
import { cn } from '../../ui/cn'
import { summarizeImport, type ImportLine } from '../../workouts/session-import'
import { FormatGuideLink } from './FormatGuide'

const DAY = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' })

function where(l: ImportLine): string {
  switch (l.outcome) {
    case 'day':
      return `on ${DAY.format(dateKeyToMs(l.date!))}`
    case 'library':
      return l.kind === 'session' ? `in ${l.sport ? SPORT_GROUP_LABEL[l.sport] : 'Workouts'}` : 'in Custom workouts'
    case 'plan':
      return `in plan ${l.planName ?? ''}`.trim()
    case 'skipped':
      return 'skipped'
  }
}

/**
 * After an import: every file, where it went, and why. Errors (the file was
 * skipped) and warnings (it was imported) name their line, so the file can
 * be fixed and imported again.
 */
export function ImportReport({ lines, onDismiss }: { lines: readonly ImportLine[]; onDismiss: () => void }) {
  const skipped = lines.some((l) => l.outcome === 'skipped')
  return (
    <section className={cn('mb-4 rounded-xl border px-4 py-3 text-sm', skipped ? 'border-bad/40 bg-bad/5' : 'border-good/40 bg-good/5')} aria-label="Import report" data-testid="import-report">
      <div className="flex items-start justify-between gap-3">
        <div className="font-semibold" role="status">
          {summarizeImport(lines)}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {skipped && <FormatGuideLink />}
          <Button size="iconSm" variant="ghost" onClick={onDismiss} aria-label="Close the import report">
            <X className="size-3.5" />
          </Button>
        </div>
      </div>
      <ul className="mt-2 space-y-2">
        {lines.map((l) => (
          <li key={l.file} data-testid="import-line" data-outcome={l.outcome}>
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-medium">{l.file}</span>
              <span className={l.outcome === 'skipped' ? 'text-bad' : 'text-ink-dim'}>
                {l.name && l.outcome !== 'skipped' && l.name !== l.file.replace(/\.[^.]+$/, '') ? `${l.name}, ` : ''}
                {where(l)}
              </span>
            </div>
            {(l.errors.length > 0 || l.warnings.length > 0) && (
              <ul className="mt-0.5 space-y-0.5 pl-3 text-xs">
                {l.errors.map((m, i) => (
                  <li key={`e${i}`} className="text-bad">
                    {m.line ? `line ${m.line}: ` : ''}
                    {m.text}
                  </li>
                ))}
                {l.warnings.map((m, i) => (
                  <li key={`w${i}`} className="text-ink-dim">
                    {m.line ? `line ${m.line}: ` : ''}
                    {m.text}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
