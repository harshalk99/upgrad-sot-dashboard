'use client';

// 3-line series: calls_made / connected / qualified per day. SPEC.md §8.1.1.
import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts';
import { format } from 'date-fns';
import { CompactTooltip, Responsive, SEMANTIC_COLORS } from './chart-defaults';

type Row = {
  day: string | null;
  calls_made: number | null;
  connected: number | null;
  qualified: number | null;
};

export function DailyVolumeLine({ data }: { data: Row[] }) {
  const cleaned = data
    .filter((d) => d.day)
    .map((d) => ({
      day: d.day!,
      label: format(new Date(d.day!), 'd MMM'),
      'Calls Made': d.calls_made ?? 0,
      Connected: d.connected ?? 0,
      Qualified: d.qualified ?? 0
    }));

  return (
    <Responsive>
      <LineChart data={cleaned} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgb(0 0 0 / 0.06)" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <Tooltip content={<CompactTooltip />} />
        <Line
          type="monotone"
          dataKey="Calls Made"
          stroke={SEMANTIC_COLORS.attempted}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
        <Line
          type="monotone"
          dataKey="Connected"
          stroke={SEMANTIC_COLORS.connected}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
        <Line
          type="monotone"
          dataKey="Qualified"
          stroke={SEMANTIC_COLORS.qualified}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </Responsive>
  );
}
