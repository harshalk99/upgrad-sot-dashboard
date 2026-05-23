'use client';

// 3-step engagement funnel: Attempted → Connected → Qualified.
// "Connected" = AI had a real classified conversation (not just a pickup).
// "Qualified" = HOT + WARM + CB Later.
// Deliberately does NOT expose attempt counts or call durations.

import { useMemo } from 'react';

type Props = {
  attempted: number;
  connected: number;
  qualified: number;
};

export function EngagementFunnelChart({ attempted, connected, qualified }: Props) {
  const steps = useMemo(
    () => [
      { label: 'Attempted', value: attempted, color: '#6366f1', hint: 'Unique customers dialed at least once' },
      { label: 'Connected', value: connected, color: '#0ea5e9', hint: 'Had a real conversation with the AI' },
      {
        label: 'Qualified',
        value: qualified,
        color: '#10b981',
        hint: 'Hot, Warm, or Callback Later'
      }
    ],
    [attempted, connected, qualified]
  );
  const max = Math.max(...steps.map((s) => s.value), 1);

  return (
    <div className="flex h-full flex-col justify-center gap-3">
      {steps.map((s, i) => {
        const widthPct = (s.value / max) * 100;
        const prev = i > 0 ? steps[i - 1].value : null;
        const dropPct = prev && prev > 0 ? Math.round((100 * (prev - s.value)) / prev) : null;
        const passPct = prev && prev > 0 ? Math.round((100 * s.value) / prev) : null;
        return (
          <div key={s.label} className="group">
            <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
              <div>
                <span className="font-medium">{s.label}</span>
                <span className="ml-2 text-[10px] uppercase tracking-widest text-muted-foreground">
                  {s.hint}
                </span>
              </div>
              <span className="font-numeric tabular-nums">
                {s.value.toLocaleString('en-IN')}
                {passPct !== null && (
                  <span className="ml-2 text-[10px] text-muted-foreground">
                    {passPct}% pass · {dropPct}% drop
                  </span>
                )}
              </span>
            </div>
            <div className="h-3.5 w-full rounded-sm bg-muted/40">
              <div
                className="h-full rounded-sm transition-all"
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
