// StageBreakdownGrid — grid of clickable cards, one per lead_stage.
// Each card links to /dashboard/dispositions/[slug] where the user can browse
// the leads in that stage and view their call summaries.
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { stageSlugFor, stageMeta } from '@/lib/lead-stages';

type Stage = { stage: string; count: number };

type Props = {
  dispositions: Stage[];
  /** Pass true for tighter spacing inside a card body. */
  compact?: boolean;
  /** Grid columns at lg breakpoint. */
  columns?: 1 | 2 | 3 | 4;
  /** Optional URL query string (without the `?`) to forward to drill-in links.
   *  E.g. "dfrom=2026-05-21&dto=2026-05-27" preserves the date filter on click. */
  preserveQuery?: string;
};

const COLS: Record<number, string> = {
  1: 'lg:grid-cols-1',
  2: 'lg:grid-cols-2',
  3: 'lg:grid-cols-3',
  4: 'lg:grid-cols-4'
};

export function StageBreakdownGrid({ dispositions, compact, columns = 3, preserveQuery }: Props) {
  const total = dispositions.reduce((s, d) => s + d.count, 0);
  const qs = preserveQuery ? `?${preserveQuery}` : '';

  return (
    <div className={cn('grid grid-cols-1 gap-2 sm:grid-cols-2', COLS[columns])}>
      {dispositions.map(({ stage, count }) => {
        const meta = stageMeta(stage);
        const slug = stageSlugFor(stage);
        const pct = total > 0 ? Math.round((100 * count) / total) : 0;
        return (
          <Link
            key={stage}
            href={`/dashboard/dispositions/${slug}${qs}`}
            className={cn(
              'group flex items-center gap-3 rounded-md border border-border/60 bg-card transition-colors hover:border-border hover:bg-muted/40',
              compact ? 'px-3 py-2' : 'px-4 py-3'
            )}
          >
            <span
              className="inline-block size-2 shrink-0 rounded-sm"
              style={{ backgroundColor: meta.color }}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{meta.label}</div>
              {!compact && (
                <div className="text-[11px] text-muted-foreground">{meta.description}</div>
              )}
            </div>
            <div className="text-right">
              <div className="font-numeric text-base font-semibold tabular-nums">
                {count.toLocaleString('en-IN')}
              </div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                {pct}%
              </div>
            </div>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </Link>
        );
      })}
    </div>
  );
}
