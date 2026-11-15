import type { PlanImportResult } from '../../plan/plans-repo'

/** What to tell the rider after workout files went into a plan. */
export function planImportNotice(planName: string, r: PlanImportResult): { tone: 'good' | 'bad'; text: string } {
  return r.failed.length > 0
    ? { tone: 'bad', text: `Added ${r.added} to ${planName}. Couldn't import ${r.failed.map((f) => `${f.name}: ${f.reason}`).join('; ')}` }
    : { tone: 'good', text: `Added ${r.added} workout${r.added === 1 ? '' : 's'} into ${planName}, in file-name order. Files named YYYY-MM-DD_… keep their day.` }
}
