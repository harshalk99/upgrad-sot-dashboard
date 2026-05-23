// Shared Recharts defaults — consistent axes, tooltips, colors across all chart wrappers.
import type { ReactNode } from 'react';
import { ResponsiveContainer } from 'recharts';

// 5-slot palette derived from shadcn chart-1..chart-5 CSS vars.
export const CHART_COLORS = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
  'var(--color-chart-4)',
  'var(--color-chart-5)'
] as const;

export const SEMANTIC_COLORS = {
  hot: 'rgb(220 38 38)',
  warm: 'rgb(217 119 6)',
  cold: 'rgb(100 116 139)',
  qualified: 'rgb(16 185 129)',
  connected: 'rgb(59 130 246)',
  attempted: 'rgb(168 85 247)',
  flagged: 'rgb(244 63 94)'
} as const;

export function Responsive({ children }: { children: ReactNode }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      {children as React.ReactElement}
    </ResponsiveContainer>
  );
}

/**
 * Compact, neutral tooltip — Kubota readout style.
 * Use as: <Tooltip content={<CompactTooltip />} />
 *
 * Recharts injects `active`, `payload`, `label` at render time; we type loosely
 * because Recharts v3 changed TooltipProps generics in ways that vary by chart type.
 */
type TooltipPayload = {
  name?: string | number;
  value?: number | string;
  color?: string;
};

type CompactTooltipProps = {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string | number;
};

export function CompactTooltip(props: CompactTooltipProps) {
  const { active, payload, label } = props;
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-md border border-border/80 bg-popover px-3 py-2 text-xs shadow-md">
      {label != null && (
        <div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {String(label)}
        </div>
      )}
      <ul className="space-y-0.5">
        {payload.map((p, i) => (
          <li key={i} className="flex items-center gap-2 tabular-nums">
            <span
              className="inline-block size-2 rounded-sm"
              style={{ backgroundColor: p.color ?? CHART_COLORS[i % CHART_COLORS.length] }}
            />
            <span className="text-muted-foreground">{p.name}</span>
            <span className="ml-auto font-numeric font-medium">
              {typeof p.value === 'number' ? p.value.toLocaleString('en-IN') : p.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
