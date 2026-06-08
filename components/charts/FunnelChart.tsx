'use client';

// 4-stage lead funnel for the client Overview.
//
//   Attempted   leads we placed at least one call to (lead_stage <> 'Not Yet Called')
//   Connected   picked up the call (all stages except DNP)
//   Engaged     had a meaningful conversation —
//                 HOT + WARM + CB Later + Not Interested + Not Eligible
//   Qualified   classified Hot or Warm
//
// Numbers come from v_client_funnel / client_funnel_filtered — `qualified`
// already equals HOT+WARM server-side, so we render it directly.

import { useMemo } from 'react';
import { cn } from '@/lib/utils';

type Props = {
  data: {
    attempted?: number | null;
    connected?: number | null;
    engaged?: number | null;
    qualified?: number | null;
  } | null;
};

export function FunnelChart({ data }: Props) {
  const steps = useMemo(
    () => [
      { label: 'Attempted', value: data?.attempted ?? 0, color: 'rgb(168 85 247)' },
      { label: 'Connected', value: data?.connected ?? 0, color: 'rgb(59 130 246)' },
      { label: 'Engaged',   value: data?.engaged   ?? 0, color: 'rgb(16 185 129)' },
      { label: 'Qualified (Hot + Warm)', value: data?.qualified ?? 0, color: 'rgb(220 38 38)' }
    ],
    [data]
  );

  const max = Math.max(...steps.map((s) => s.value), 1);

  return (
    <div className="flex h-full flex-col justify-center gap-2">
      {steps.map((s, i) => {
        const widthPct = (s.value / max) * 100;
        const prev = i > 0 ? steps[i - 1].value : null;
        const dropPct =
          prev && prev > 0 ? Math.round((100 * (prev - s.value)) / prev) : null;
        const ofAttempted =
          steps[0].value > 0 ? Math.round((100 * s.value) / steps[0].value) : null;
        return (
          <div key={s.label} className="group relative">
            <div className="mb-1 flex items-baseline justify-between text-xs">
              <span className="text-muted-foreground">{s.label}</span>
              <span className="font-numeric font-medium tabular-nums">
                {s.value.toLocaleString('en-IN')}
                {ofAttempted !== null && i > 0 && (
                  <span className="ml-2 text-[10px] text-muted-foreground">
                    {ofAttempted}% of attempted
                  </span>
                )}
                {dropPct !== null && dropPct > 0 && (
                  <span className="ml-2 text-[10px] text-muted-foreground/70">
                    −{dropPct}% step
                  </span>
                )}
              </span>
            </div>
            <div className="h-3 w-full rounded-sm bg-muted/40">
              <div
                className={cn('h-full rounded-sm transition-all')}
                style={{ width: `${widthPct}%`, backgroundColor: s.color }}
                title={`${s.label}: ${s.value.toLocaleString('en-IN')}`}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
