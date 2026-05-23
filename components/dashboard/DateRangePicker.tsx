'use client';

// DateRangePicker — SPEC.md §9.8. Presets: 3mo / 6mo / 12mo / All time / Custom.
// Light wrapper around shadcn Calendar + Popover. URL-syncable via callback.

import { useState } from 'react';
import { CalendarRange } from 'lucide-react';
import { addMonths, format, startOfMonth } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover';

export type DateRange = {
  from?: Date;
  to?: Date;
};

export type Preset = '3mo' | '6mo' | '12mo' | 'all' | 'custom';

type Props = {
  value?: DateRange;
  onChange?: (range: DateRange, preset: Preset) => void;
  /** Default selected preset (defaults to 6mo). */
  defaultPreset?: Preset;
  /** Earliest date selectable (used for "all time"). */
  earliestDate?: Date;
};

const PRESETS: Array<{ key: Preset; label: string }> = [
  { key: '3mo', label: '3 mo' },
  { key: '6mo', label: '6 mo' },
  { key: '12mo', label: '12 mo' },
  { key: 'all', label: 'All' },
  { key: 'custom', label: 'Custom' }
];

function rangeFromPreset(
  preset: Preset,
  earliest?: Date
): DateRange {
  const now = new Date();
  switch (preset) {
    case '3mo':
      return { from: startOfMonth(addMonths(now, -2)), to: now };
    case '6mo':
      return { from: startOfMonth(addMonths(now, -5)), to: now };
    case '12mo':
      return { from: startOfMonth(addMonths(now, -11)), to: now };
    case 'all':
      return { from: earliest ?? new Date('2026-01-01'), to: now };
    default:
      return {};
  }
}

export function DateRangePicker({
  value,
  onChange,
  defaultPreset = '6mo',
  earliestDate
}: Props) {
  const [preset, setPreset] = useState<Preset>(defaultPreset);
  const [internal, setInternal] = useState<DateRange>(
    value ?? rangeFromPreset(defaultPreset, earliestDate)
  );

  const current = value ?? internal;

  function pickPreset(p: Preset) {
    setPreset(p);
    if (p === 'custom') return;
    const r = rangeFromPreset(p, earliestDate);
    setInternal(r);
    onChange?.(r, p);
  }

  return (
    <div className="inline-flex items-center gap-2">
      <div className="inline-flex rounded-md border border-border/60 bg-background p-0.5">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => pickPreset(p.key)}
            className={
              'rounded px-2.5 py-1 text-xs font-medium transition-colors ' +
              (preset === p.key
                ? 'bg-foreground text-background'
                : 'text-muted-foreground hover:text-foreground')
            }
          >
            {p.label}
          </button>
        ))}
      </div>

      {preset === 'custom' && (
        <Popover>
          <PopoverTrigger
            render={
              <Button variant="outline" size="sm" className="gap-2 font-mono text-xs" />
            }
          >
            <CalendarRange className="size-3.5" />
            {current.from ? format(current.from, 'd MMM') : 'From'}
            <span className="text-muted-foreground">→</span>
            {current.to ? format(current.to, 'd MMM yyyy') : 'To'}
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            {/* Calendar's selected requires `from` to be a Date; cast accepted by react-day-picker at runtime. */}
            <Calendar
              mode="range"
              selected={current.from ? { from: current.from, to: current.to } : undefined}
              onSelect={(r) => {
                const next: DateRange = {
                  from: r?.from ?? undefined,
                  to: r?.to ?? undefined
                };
                setInternal(next);
                onChange?.(next, 'custom');
              }}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
