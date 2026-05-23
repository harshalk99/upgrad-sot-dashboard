// Responsive grid wrapper for MetricCards. Default 4 cols on lg, 2 on md, 1 mobile.
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Props = {
  children: ReactNode;
  className?: string;
  /** Card count per row at lg breakpoint (default 4). */
  cols?: 2 | 3 | 4 | 5 | 6;
};

const COL_CLASSES: Record<number, string> = {
  2: 'lg:grid-cols-2',
  3: 'lg:grid-cols-3',
  4: 'lg:grid-cols-4',
  5: 'lg:grid-cols-5',
  6: 'lg:grid-cols-6'
};

export function MetricCardGrid({ children, className, cols = 4 }: Props) {
  return (
    <div className={cn('grid grid-cols-1 gap-3 sm:grid-cols-2', COL_CLASSES[cols], className)}>
      {children}
    </div>
  );
}
