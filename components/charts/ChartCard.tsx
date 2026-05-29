// ChartCard — reusable card frame for charts. Provides title, subtitle, loading skeleton,
// empty state, and optional toolbar slot. Body wrapped in ResponsiveContainer-friendly box.
import type { ReactNode } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type Props = {
  title: string;
  subtitle?: ReactNode;
  toolbar?: ReactNode;
  loading?: boolean;
  empty?: boolean;
  emptyText?: string;
  className?: string;
  /** Fixed height in px for the chart body. Pass 'auto' for content-sized (tables). Default 280. */
  height?: number | 'auto';
  children: ReactNode;
};

export function ChartCard({
  title,
  subtitle,
  toolbar,
  loading,
  empty,
  emptyText = 'No data available for the selected range.',
  className,
  height = 280,
  children
}: Props) {
  const fixed = typeof height === 'number';
  return (
    <section className={cn('rounded-lg border border-border/60 bg-card p-4', className)}>
      <header className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {toolbar}
      </header>
      <div style={fixed ? { height } : undefined} className={cn('relative', !fixed && 'h-auto')}>
        {loading ? (
          <Skeleton className={fixed ? 'h-full w-full' : 'h-24 w-full'} />
        ) : empty ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            {emptyText}
          </div>
        ) : (
          children
        )}
      </div>
    </section>
  );
}
