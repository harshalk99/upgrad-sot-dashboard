// MetricCard — SPEC.md §9.1. Kubota-inspired: thin border, mono numeric, threshold colors.
//
// Props (SPEC §9.1):
//   title, value, subtitle?, trend?, trendValue?, sparklineData?, threshold?, icon?, loading?, href?
//
// Threshold logic: value > critical → red bg; > warn → amber; else neutral.

import Link from 'next/link';
import { ArrowDown, ArrowRight, ArrowUp, HelpCircle, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { formatNumber } from '@/lib/formatters';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip';

export type MetricCardProps = {
  title: string;
  value: number | string;
  subtitle?: string;
  trend?: 'up' | 'down' | 'flat';
  trendValue?: string;
  sparklineData?: number[];
  threshold?: { warn: number; critical: number };
  icon?: LucideIcon;
  loading?: boolean;
  href?: string;
  /** When true, lower numbers are better (e.g. stuck_pending) — flips threshold logic. */
  invert?: boolean;
  /** Override formatting; defaults to en-IN number with no decimals. */
  format?: (v: number | string) => string;
  /** Optional tooltip text — when provided, renders a (?) icon next to the title
   *  that reveals this definition on hover. Use it to clarify what the metric
   *  represents (e.g. "Engaged = Hot + Warm + Callback Later"). */
  help?: string;
};

function severityFor(
  value: number | string,
  threshold?: { warn: number; critical: number },
  invert?: boolean
): 'neutral' | 'warn' | 'critical' {
  if (!threshold || typeof value !== 'number') return 'neutral';
  if (invert) {
    if (value >= threshold.critical) return 'critical';
    if (value >= threshold.warn) return 'warn';
    return 'neutral';
  }
  if (value >= threshold.critical) return 'critical';
  if (value >= threshold.warn) return 'warn';
  return 'neutral';
}

export function MetricCard(props: MetricCardProps) {
  const {
    title,
    value,
    subtitle,
    trend,
    trendValue,
    sparklineData,
    threshold,
    icon: Icon,
    loading,
    href,
    invert,
    format,
    help
  } = props;

  const severity = severityFor(value, threshold, invert);
  const displayValue = format
    ? format(value)
    : typeof value === 'number'
    ? formatNumber(value)
    : value;

  const card = (
    <div
      className={cn(
        'group relative h-full rounded-lg border bg-card p-4 transition-colors',
        severity === 'neutral' && 'border-border/60 hover:border-border',
        severity === 'warn' &&
          'border-amber-500/40 bg-amber-50/40 dark:border-amber-500/30 dark:bg-amber-950/20',
        severity === 'critical' &&
          'border-red-500/50 bg-red-50/50 dark:border-red-500/40 dark:bg-red-950/30',
        href && 'cursor-pointer hover:shadow-sm'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
          <span>{title}</span>
          {help && (
            <TooltipProvider delay={200}>
              <Tooltip>
                <TooltipTrigger
                  type="button"
                  className="inline-flex items-center justify-center rounded-full text-muted-foreground/70 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  aria-label={`What does ${title} mean?`}
                >
                  <HelpCircle className="size-3" />
                </TooltipTrigger>
                <TooltipContent className="max-w-[260px] text-[11px] normal-case tracking-normal">
                  {help}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        {Icon && (
          <Icon
            className={cn(
              'size-4 shrink-0',
              severity === 'neutral' && 'text-muted-foreground',
              severity === 'warn' && 'text-amber-600 dark:text-amber-400',
              severity === 'critical' && 'text-red-600 dark:text-red-400'
            )}
          />
        )}
      </div>

      <div className="mt-2 flex items-baseline gap-2">
        {loading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <span
            className={cn(
              'font-numeric text-2xl font-semibold tabular-nums leading-none',
              severity === 'critical' && 'text-red-700 dark:text-red-300'
            )}
          >
            {displayValue}
          </span>
        )}
        {trend && trendValue && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 text-xs',
              trend === 'up' && 'text-emerald-600 dark:text-emerald-400',
              trend === 'down' && 'text-red-600 dark:text-red-400',
              trend === 'flat' && 'text-muted-foreground'
            )}
          >
            {trend === 'up' && <ArrowUp className="size-3" />}
            {trend === 'down' && <ArrowDown className="size-3" />}
            {trend === 'flat' && <ArrowRight className="size-3" />}
            {trendValue}
          </span>
        )}
      </div>

      {subtitle && <div className="mt-1 text-xs text-muted-foreground">{subtitle}</div>}

      {sparklineData && sparklineData.length > 1 && (
        <Sparkline data={sparklineData} severity={severity} />
      )}
    </div>
  );

  if (href) return <Link href={href}>{card}</Link>;
  return card;
}

/** Tiny inline sparkline as SVG. No external chart lib for fixed dims. */
function Sparkline({
  data,
  severity
}: {
  data: number[];
  severity: 'neutral' | 'warn' | 'critical';
}) {
  const w = 100;
  const h = 24;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const stepX = w / (data.length - 1);
  const points = data
    .map((v, i) => `${i * stepX},${h - ((v - min) / range) * h}`)
    .join(' ');
  const stroke =
    severity === 'critical'
      ? 'rgb(220 38 38)'
      : severity === 'warn'
      ? 'rgb(217 119 6)'
      : 'rgb(100 116 139)';
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className="mt-3 h-6 w-full opacity-80"
      aria-hidden="true"
    >
      <polyline points={points} fill="none" stroke={stroke} strokeWidth={1.25} />
    </svg>
  );
}
