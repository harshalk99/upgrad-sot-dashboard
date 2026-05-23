// PerformanceTable — compact breakdown table for "by source" / "by state" sections.
// Highlights the highest qualification rate and conn rate with simple bar overlays.
import { cn } from '@/lib/utils';

type Row = {
  label: string;
  total: number;
  connected: number;
  hot: number;
  warm: number;
  qualPct: number;
  connectPct?: number;
};

type Props = {
  rows: Row[];
  /** Cap rows shown (default 8). Remaining are summed into a "Other" row. */
  limit?: number;
  /** Show connect_rate column. */
  showConnectRate?: boolean;
  /** Override default column labels (e.g. when same component is reused for engagement view). */
  labels?: {
    segment?: string;
    leads?: string;
    connected?: string;
    hot?: string;
    warm?: string;
    qualRate?: string;
    connectRate?: string;
  };
  /** Color used for the qual-rate mini-bar. Default emerald-500. */
  qualBarColor?: string;
};

export function PerformanceTable({
  rows,
  limit = 8,
  showConnectRate = false,
  labels,
  qualBarColor = '#10b981'
}: Props) {
  const L = {
    segment: 'Segment',
    leads: 'Leads',
    connected: 'Conn',
    hot: 'Hot',
    warm: 'Warm',
    qualRate: 'Qual rate',
    connectRate: 'Conn rate',
    ...(labels ?? {})
  };
  const sorted = [...rows].sort((a, b) => b.total - a.total);
  const head = sorted.slice(0, limit);
  const tail = sorted.slice(limit);

  const otherRow: Row | null =
    tail.length > 0
      ? {
          label: `Other (${tail.length})`,
          total: tail.reduce((s, r) => s + r.total, 0),
          connected: tail.reduce((s, r) => s + r.connected, 0),
          hot: tail.reduce((s, r) => s + r.hot, 0),
          warm: tail.reduce((s, r) => s + r.warm, 0),
          qualPct:
            tail.reduce((s, r) => s + r.total, 0) > 0
              ? Math.round(
                  (100 *
                    tail.reduce((s, r) => s + r.hot + r.warm, 0)) /
                    tail.reduce((s, r) => s + r.total, 0) *
                    10
                ) / 10
              : 0,
          connectPct:
            tail.reduce((s, r) => s + r.total, 0) > 0
              ? Math.round(
                  (100 * tail.reduce((s, r) => s + r.connected, 0)) /
                    tail.reduce((s, r) => s + r.total, 0) *
                    10
                ) / 10
              : 0
        }
      : null;

  const display = otherRow ? [...head, otherRow] : head;
  const maxQual = Math.max(...display.map((r) => r.qualPct), 1);

  return (
    <div className="overflow-hidden rounded-md border border-border/60">
      <table className="w-full text-xs">
        <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left font-medium">{L.segment}</th>
            <th className="px-3 py-2 text-right font-medium">{L.leads}</th>
            <th className="px-3 py-2 text-right font-medium">{L.connected}</th>
            <th className="px-3 py-2 text-right font-medium">{L.hot}</th>
            {L.warm && <th className="px-3 py-2 text-right font-medium">{L.warm}</th>}
            <th className="px-3 py-2 text-left font-medium">{L.qualRate}</th>
            {showConnectRate && (
              <th className="px-3 py-2 text-right font-medium">{L.connectRate}</th>
            )}
          </tr>
        </thead>
        <tbody>
          {display.map((r, i) => {
            const barWidth = Math.max((r.qualPct / maxQual) * 100, 2);
            return (
              <tr key={r.label + i} className="border-t border-border/40">
                <td className="px-3 py-2">
                  <span className="font-medium">{r.label}</span>
                </td>
                <td className="px-3 py-2 text-right font-numeric tabular-nums">
                  {r.total.toLocaleString('en-IN')}
                </td>
                <td className="px-3 py-2 text-right font-numeric tabular-nums text-muted-foreground">
                  {r.connected.toLocaleString('en-IN')}
                </td>
                <td className="px-3 py-2 text-right font-numeric tabular-nums">
                  <span
                    className={cn(
                      r.hot > 0 && 'text-red-700 dark:text-red-300 font-medium'
                    )}
                  >
                    {r.hot}
                  </span>
                </td>
                {L.warm && (
                  <td className="px-3 py-2 text-right font-numeric tabular-nums">
                    <span
                      className={cn(
                        r.warm > 0 && 'text-amber-700 dark:text-amber-300'
                      )}
                    >
                      {r.warm}
                    </span>
                  </td>
                )}
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-16 overflow-hidden rounded-sm bg-muted">
                      <div
                        className="h-full rounded-sm"
                        style={{ width: `${barWidth}%`, backgroundColor: qualBarColor }}
                      />
                    </div>
                    <span className="font-numeric tabular-nums">
                      {r.qualPct.toFixed(1)}%
                    </span>
                  </div>
                </td>
                {showConnectRate && (
                  <td className="px-3 py-2 text-right font-numeric tabular-nums text-muted-foreground">
                    {r.connectPct?.toFixed(1)}%
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
