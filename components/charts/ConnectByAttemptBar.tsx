'use client';

// Connect rate by attempt number. Shows total + connected bars overlaid with rate label.
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts';
import { CompactTooltip, Responsive, SEMANTIC_COLORS } from './chart-defaults';

type Row = {
  attempt_number: number | null;
  total: number | null;
  connected: number | null;
  connect_rate_pct: number | null;
};

export function ConnectByAttemptBar({ data }: { data: Row[] }) {
  const cleaned = data
    .filter((d) => d.attempt_number != null)
    .map((d) => ({
      attempt: `#${d.attempt_number}`,
      Total: d.total ?? 0,
      Connected: d.connected ?? 0,
      rate: d.connect_rate_pct ?? 0
    }));

  return (
    <Responsive>
      <BarChart data={cleaned} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgb(0 0 0 / 0.06)" vertical={false} />
        <XAxis dataKey="attempt" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <Tooltip content={<CompactTooltip />} />
        <Bar dataKey="Total" fill={SEMANTIC_COLORS.attempted} opacity={0.4} radius={[2, 2, 0, 0]} />
        <Bar
          dataKey="Connected"
          fill={SEMANTIC_COLORS.connected}
          radius={[2, 2, 0, 0]}
        />
      </BarChart>
    </Responsive>
  );
}
