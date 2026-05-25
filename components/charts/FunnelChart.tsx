'use client';

// 5-level funnel: Total → Attempted → Connected → Qualified → Hot+Warm.
// Implemented as a custom SVG (not Recharts FunnelChart) to keep clean Kubota lines.

import { useMemo } from 'react';
import { cn } from '@/lib/utils';

type Props = {
  data: {
    total_leads?: number | null;
    attempted?: number | null;
    connected?: number | null;
    qualified?: number | null;
    hot?: number | null;
    warm?: number | null;
  } | null;
};

export function FunnelChart({ data }: Props) {
  const steps = useMemo(() => {
    const total = data?.total_leads ?? 0;
    const attempted = data?.attempted ?? 0;
    const connected = data?.connected ?? 0;
    const qualified = data?.qualified ?? 0;
    const hotWarm = (data?.hot ?? 0) + (data?.warm ?? 0);
    return [
      { label: 'Total Leads', value: total, color: 'rgb(100 116 139)' },
      { label: 'Attempted', value: attempted, color: 'rgb(168 85 247)' },
      { label: 'Connected', value: connected, color: 'rgb(59 130 246)' },
      { label: 'Engaged', value: qualified, color: 'rgb(16 185 129)' },
      { label: 'Hot + Warm', value: hotWarm, color: 'rgb(220 38 38)' }
    ];
  }, [data]);

  const max = Math.max(...steps.map((s) => s.value), 1);

  return (
    <div className="flex h-full flex-col justify-center gap-2">
      {steps.map((s, i) => {
        const widthPct = (s.value / max) * 100;
        const prev = i > 0 ? steps[i - 1].value : null;
        const dropPct = prev && prev > 0 ? Math.round((100 * (prev - s.value)) / prev) : null;
        return (
          <div key={s.label} className="group relative">
            <div className="mb-1 flex items-baseline justify-between text-xs">
              <span className="text-muted-foreground">{s.label}</span>
              <span className="font-numeric font-medium tabular-nums">
                {s.value.toLocaleString('en-IN')}
                {dropPct !== null && dropPct > 0 && (
                  <span className="ml-2 text-[10px] text-muted-foreground">
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
