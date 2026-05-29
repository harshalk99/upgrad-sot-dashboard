'use client';

// DateRangeFilter — reusable URL-syncing date-range picker.
// Presets (All time / Today / Last 7d / Last 30d / Last 90d / This month / Custom)
// in a Popover. Apply/Reset semantics mirror ConnectivityFilterBar.
//
// URL params: `${prefix}from=YYYY-MM-DD` + `${prefix}to=YYYY-MM-DD`. The prefix
// lets multiple date filters coexist on a page later (e.g. 'd' for dispositions,
// 'r' for reports).

import { useMemo, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { CalendarDays, RotateCcw, Send } from 'lucide-react';
import {
  endOfMonth,
  format,
  startOfMonth,
  subDays,
  subMonths
} from 'date-fns';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { encodeDateRange, type DateRange } from '@/lib/url-filters';

type Props = {
  currentRange: DateRange;
  /** URL param prefix (default 'd'). Encodes as `${prefix}from`, `${prefix}to`. */
  paramPrefix?: string;
  /** Compact button label (default "Date range"). */
  label?: string;
};

type PresetKey = 'all' | 'today' | '7d' | '30d' | '90d' | 'month' | 'last_month' | 'custom';

function presetToRange(key: PresetKey): DateRange {
  const today = new Date();
  const fmt = (d: Date) => format(d, 'yyyy-MM-dd');
  switch (key) {
    case 'today':
      return { from: fmt(today), to: fmt(today) };
    case '7d':
      return { from: fmt(subDays(today, 6)), to: fmt(today) };
    case '30d':
      return { from: fmt(subDays(today, 29)), to: fmt(today) };
    case '90d':
      return { from: fmt(subDays(today, 89)), to: fmt(today) };
    case 'month':
      return { from: fmt(startOfMonth(today)), to: fmt(today) };
    case 'last_month': {
      const lastMonth = subMonths(today, 1);
      return { from: fmt(startOfMonth(lastMonth)), to: fmt(endOfMonth(lastMonth)) };
    }
    case 'all':
    case 'custom':
    default:
      return {};
  }
}

/** Detect which preset (if any) matches a given range exactly. */
function rangeToPreset(range: DateRange): PresetKey {
  if (!range.from && !range.to) return 'all';
  const presets: PresetKey[] = ['today', '7d', '30d', '90d', 'month', 'last_month'];
  for (const k of presets) {
    const r = presetToRange(k);
    if (r.from === range.from && r.to === range.to) return k;
  }
  return 'custom';
}

const PRESET_OPTIONS: { key: PresetKey; label: string }[] = [
  { key: 'all', label: 'All time' },
  { key: 'today', label: 'Today' },
  { key: '7d', label: 'Last 7 days' },
  { key: '30d', label: 'Last 30 days' },
  { key: '90d', label: 'Last 90 days' },
  { key: 'month', label: 'This month' },
  { key: 'last_month', label: 'Last month' },
  { key: 'custom', label: 'Custom' }
];

function fmtDisplay(range: DateRange): string {
  if (!range.from && !range.to) return 'All time';
  const preset = rangeToPreset(range);
  if (preset !== 'custom' && preset !== 'all') {
    const found = PRESET_OPTIONS.find((p) => p.key === preset);
    if (found) return found.label;
  }
  const f = range.from ? format(new Date(range.from), 'd MMM') : '…';
  const t = range.to ? format(new Date(range.to), 'd MMM yyyy') : '…';
  return `${f} – ${t}`;
}

export function DateRangeFilter({ currentRange, paramPrefix = 'd', label = 'Date range' }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange>(currentRange);
  const [preset, setPreset] = useState<PresetKey>(rangeToPreset(currentRange));

  // Sync local draft when URL changes externally.
  // React 19 / React Compiler-friendly pattern: setState during render with a
  // prev-value sentinel. Avoids `useEffect` + the react-hooks/set-state-in-effect lint error.
  // Ref: https://react.dev/reference/react/useState#storing-information-from-previous-renders
  const appliedSig = `${currentRange.from ?? ''}|${currentRange.to ?? ''}`;
  const [prevAppliedSig, setPrevAppliedSig] = useState(appliedSig);
  if (prevAppliedSig !== appliedSig) {
    setPrevAppliedSig(appliedSig);
    setDraft(currentRange);
    setPreset(rangeToPreset(currentRange));
  }

  const draftSig = `${draft.from ?? ''}|${draft.to ?? ''}`;
  const isDirty = draftSig !== appliedSig;
  const hasApplied = Boolean(currentRange.from || currentRange.to);

  function selectPreset(key: PresetKey) {
    setPreset(key);
    if (key === 'custom') return; // keep current draft for calendar refinement
    setDraft(presetToRange(key));
  }

  function applyDraft() {
    // Merge with other existing search params so we don't blow away unrelated filters.
    const params = new URLSearchParams(searchParams.toString());
    params.delete(`${paramPrefix}from`);
    params.delete(`${paramPrefix}to`);
    const encoded = encodeDateRange(draft, paramPrefix);
    encoded.forEach((value, key) => params.set(key, value));
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      setOpen(false);
    });
  }

  function reset() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete(`${paramPrefix}from`);
    params.delete(`${paramPrefix}to`);
    const qs = params.toString();
    setDraft({});
    setPreset('all');
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      setOpen(false);
    });
  }

  const calendarSelected = useMemo(() => {
    if (!draft.from) return undefined;
    return { from: new Date(draft.from), to: draft.to ? new Date(draft.to) : undefined };
  }, [draft.from, draft.to]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className={cn(
              'h-7 gap-1.5 px-2.5 text-xs',
              hasApplied && 'border-foreground/40 bg-muted/50'
            )}
          />
        }
      >
        <CalendarDays className="size-3.5" />
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
        <span className="text-xs">{fmtDisplay(currentRange)}</span>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[320px] p-0">
        <div className="border-b border-border/60 p-3">
          <div className="grid grid-cols-2 gap-1.5">
            {PRESET_OPTIONS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => selectPreset(p.key)}
                className={cn(
                  'rounded px-2 py-1.5 text-left text-xs transition-colors',
                  preset === p.key
                    ? 'bg-foreground text-background'
                    : 'hover:bg-muted text-foreground'
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {preset === 'custom' && (
          <div className="border-b border-border/60 p-2">
            <Calendar
              mode="range"
              selected={calendarSelected}
              onSelect={(r) => {
                if (!r) {
                  setDraft({});
                  return;
                }
                setDraft({
                  from: r.from ? format(r.from, 'yyyy-MM-dd') : undefined,
                  to: r.to ? format(r.to, 'yyyy-MM-dd') : undefined
                });
              }}
              numberOfMonths={1}
            />
          </div>
        )}

        <div className="flex items-center justify-between gap-2 p-2.5">
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            {draft.from || draft.to ? fmtDisplay(draft) : 'No range'}
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 gap-1 text-xs"
              onClick={reset}
              disabled={isPending || (!hasApplied && !draft.from && !draft.to)}
            >
              <RotateCcw className="size-3" /> Reset
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={applyDraft}
              disabled={isPending || !isDirty}
            >
              <Send className="size-3" />
              {isPending ? 'Applying…' : 'Apply'}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
