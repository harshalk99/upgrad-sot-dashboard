'use client';

// Daily connectivity trend chart for the Client Connectivity page.
// Bars for the 3 absolute count series (Attempted / Connected / Engaged) grouped per day,
// with a dashed Connect % line overlaid on a secondary y-axis.
// Per-call counts (one row per call_log entry), per IST day.
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { format } from 'date-fns';
import { CompactTooltip, Responsive } from './chart-defaults';
import type { ConnectivityDailyRow } from '@/lib/queries/client';

type Props = { data: ConnectivityDailyRow[] };

export function ConnectivityTrendLine({ data }: Props) {
  const cleaned = data
    .filter((d) => d.day)
    .map((d) => ({
      day: d.day,
      label: format(new Date(d.day), 'd MMM'),
      Attempted: d.attempted,
      Connected: d.connected,
      Engaged: d.engaged,
      'Connect %': d.connect_pct ?? 0
    }));

  return (
    <Responsive>
      <ComposedChart
        data={cleaned}
        margin={{ top: 4, right: 16, left: -8, bottom: 0 }}
        barCategoryGap="20%"
      >
        <CartesianGrid strokeDasharray="3 3" stroke="rgb(0 0 0 / 0.06)" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          yAxisId="count"
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={40}
        />
        <YAxis
          yAxisId="pct"
          orientation="right"
          unit="%"
          domain={[0, 100]}
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={40}
        />
        <Tooltip content={<CompactTooltip />} />

        <Bar yAxisId="count" dataKey="Attempted" fill="#6366f1" radius={[2, 2, 0, 0]} />
        <Bar yAxisId="count" dataKey="Connected" fill="#0ea5e9" radius={[2, 2, 0, 0]} />
        <Bar yAxisId="count" dataKey="Engaged"   fill="#10b981" radius={[2, 2, 0, 0]} />

        <Line
          yAxisId="pct"
          type="monotone"
          dataKey="Connect %"
          stroke="#64748b"
          strokeWidth={1.5}
          strokeDasharray="4 4"
          dot={false}
          activeDot={{ r: 4 }}
        />
      </ComposedChart>
    </Responsive>
  );
}
