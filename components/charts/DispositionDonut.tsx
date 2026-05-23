'use client';

// Recharts PieChart-based donut for lead-stage breakdown.
// Each stage gets a distinct, semantically-meaningful color from lib/lead-stages.
import { Cell, Pie, PieChart, Tooltip } from 'recharts';
import { CompactTooltip, Responsive } from './chart-defaults';
import { stageMeta } from '@/lib/lead-stages';

type Row = { lead_stage: string | null; lead_count: number | null };

type Props = { data: Row[] };

export function DispositionDonut({ data }: Props) {
  const cleaned = data
    .filter((d) => (d.lead_count ?? 0) > 0 && d.lead_stage !== 'Not Yet Called')
    .map((d) => ({
      name: d.lead_stage ?? 'Unknown',
      value: d.lead_count ?? 0,
      color: stageMeta(d.lead_stage ?? '').color
    }))
    .sort((a, b) => b.value - a.value);

  return (
    <Responsive>
      <PieChart>
        <Tooltip content={<CompactTooltip />} />
        <Pie
          data={cleaned}
          dataKey="value"
          nameKey="name"
          innerRadius="55%"
          outerRadius="85%"
          paddingAngle={2}
          stroke="var(--card)"
          strokeWidth={2}
        >
          {cleaned.map((entry, i) => (
            <Cell key={i} fill={entry.color} />
          ))}
        </Pie>
      </PieChart>
    </Responsive>
  );
}

/** Legend rendered alongside the donut. */
export function DispositionLegend({ data }: Props) {
  const cleaned = data
    .filter((d) => (d.lead_count ?? 0) > 0 && d.lead_stage !== 'Not Yet Called')
    .map((d) => ({
      name: d.lead_stage ?? 'Unknown',
      value: d.lead_count ?? 0,
      meta: stageMeta(d.lead_stage ?? '')
    }))
    .sort((a, b) => b.value - a.value);
  const total = cleaned.reduce((s, c) => s + c.value, 0);
  return (
    <ul className="space-y-1.5 text-xs">
      {cleaned.map((d) => (
        <li key={d.name} className="flex items-center gap-2">
          <span
            className="inline-block size-2 rounded-sm"
            style={{ backgroundColor: d.meta.color }}
          />
          <span className="truncate text-muted-foreground">{d.meta.label}</span>
          <span className="ml-auto font-numeric tabular-nums">
            {d.value.toLocaleString('en-IN')}
            <span className="ml-1 text-[10px] text-muted-foreground">
              ({total > 0 ? Math.round((100 * d.value) / total) : 0}%)
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
