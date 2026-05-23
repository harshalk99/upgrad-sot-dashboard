'use client';

// HourlyDispatchBar — last 24h of dispatches grouped by hour, rendered as a sparse
// bar chart. Pure SVG so it stays light. SPEC.md §8.2.1.

type Props = { data: { hour: string; dispatched: number }[] };

export function HourlyDispatchBar({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-xs text-muted-foreground">
        No dispatches in the last 24 hours.
      </div>
    );
  }

  const max = Math.max(...data.map((d) => d.dispatched), 1);
  const total = data.reduce((s, d) => s + d.dispatched, 0);

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-baseline justify-between text-xs">
        <div className="text-muted-foreground">Last 24 hours · hourly buckets</div>
        <div className="font-mono tabular-nums">
          {total.toLocaleString('en-IN')} dispatched
        </div>
      </div>
      <div className="flex flex-1 items-end gap-[2px]" style={{ minHeight: 80 }}>
        {data.map((d) => {
          const h = (d.dispatched / max) * 100;
          const date = new Date(d.hour);
          const hour = date.getHours();
          return (
            <div
              key={d.hour}
              className="group relative flex-1 min-w-0"
              title={`${date.toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short', hour12: false })} · ${d.dispatched} calls`}
            >
              <div
                className="w-full rounded-sm bg-sky-500/70 transition-colors hover:bg-sky-500"
                style={{ height: `${Math.max(h, d.dispatched > 0 ? 4 : 0)}%` }}
              />
              {hour % 6 === 0 && (
                <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 font-mono text-[9px] text-muted-foreground">
                  {String(hour).padStart(2, '0')}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-3 h-1" />
    </div>
  );
}
