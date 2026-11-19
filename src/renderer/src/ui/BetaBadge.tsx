import { cn } from './cn'

/** Marks a feature that is still being tried out: it may change, and may not always work. */
export function BetaBadge({ className, title = 'Beta: new, still being tried out, and may change' }: { className?: string; title?: string }) {
  return (
    <span
      className={cn('inline-flex items-center rounded-full border border-accent/50 bg-accent/10 px-1.5 py-px align-middle text-[10px] font-semibold uppercase leading-4 tracking-wide text-accent', className)}
      title={title}
      data-testid="beta-badge"
    >
      Beta
    </span>
  )
}
