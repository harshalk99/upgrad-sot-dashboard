'use client';

// ConnectivityFilterBar — URL-syncing multi-select filter bar for /dashboard/connectivity.
// 5 primary dropdowns (Lead Source first) + 6 UTM dropdowns under a Collapsible disclosure.
//
// UX rules (2026-05-23):
//   - Only ONE filter dimension can be active at a time. Selecting values in a
//     dropdown disables the other 10 dropdowns until cleared.
//   - Filters are "draft" until the user clicks Apply (URL push).
//   - Reset clears both the draft and the applied URL filters.

import { useMemo, useState, useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Check, ChevronsUpDown, Filter, RotateCcw, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from '@/components/ui/collapsible';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  CONNECTIVITY_FULL_TO_SHORT,
  encodeFiltersToSearchParams
} from '@/lib/url-filters';
import type {
  ConnectivityFilters,
  ConnectivityFilterOptions
} from '@/lib/queries/client';

const LABELS: Record<keyof ConnectivityFilterOptions, string> = {
  lead_source: 'Lead Source',
  data_acquisition_channel: 'Acquisition Channel',
  data_source_type: 'Source Type',
  data_source_name: 'Source Name',
  data_source_batch: 'Source Batch',
  utm_source: 'utm_source',
  original_utm_source: 'utm_source (original)',
  original_utm_campaign: 'utm_campaign',
  original_utm_medium: 'utm_medium',
  original_utm_content: 'utm_content',
  original_utm_term: 'utm_term'
};

// "Lead Source" was repointed to the data_source_name column (2026-06-08) —
// the dedicated data_source_name dropdown would now be a duplicate, so it's
// dropped from the UI. The filter dim is still wired in the URL/RPC layer
// for any old bookmarks that pin `dsn=...`.
const PRIMARY_KEYS: (keyof ConnectivityFilterOptions)[] = [
  'lead_source',
  'data_acquisition_channel',
  'data_source_type',
  'data_source_batch'
];

const UTM_KEYS: (keyof ConnectivityFilterOptions)[] = [
  'utm_source',
  'original_utm_source',
  'original_utm_campaign',
  'original_utm_medium',
  'original_utm_content',
  'original_utm_term'
];

type Props = {
  options: ConnectivityFilterOptions;
  currentFilters: ConnectivityFilters;
};

/** Find the first dimension key with non-empty values, or null. */
function findActiveDim(f: ConnectivityFilters): keyof ConnectivityFilterOptions | null {
  for (const k of [...PRIMARY_KEYS, ...UTM_KEYS]) {
    if ((f[k]?.length ?? 0) > 0) return k;
  }
  return null;
}

/** Stable signature for shallow change detection. */
function sig(f: ConnectivityFilters): string {
  return [...PRIMARY_KEYS, ...UTM_KEYS]
    .map((k) => `${k}=${(f[k] ?? []).slice().sort().join(',')}`)
    .join('|');
}

export function ConnectivityFilterBar({ options, currentFilters }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  // Draft state — local until Apply is pressed.
  const [draft, setDraft] = useState<ConnectivityFilters>(currentFilters);

  // If the URL state changes externally (e.g. user navigates), sync draft.
  // React 19 / React Compiler-friendly pattern: setState during render with a
  // prev-value sentinel. Avoids `useEffect` (which would trigger the
  // react-hooks/set-state-in-effect lint error and cascade renders).
  // Ref: https://react.dev/reference/react/useState#storing-information-from-previous-renders
  const appliedSig = sig(currentFilters);
  const [prevAppliedSig, setPrevAppliedSig] = useState(appliedSig);
  if (prevAppliedSig !== appliedSig) {
    setPrevAppliedSig(appliedSig);
    setDraft(currentFilters);
  }

  const draftSig = sig(draft);
  const isDirty = draftSig !== appliedSig;
  const draftActiveDim = findActiveDim(draft);
  const appliedActiveDim = findActiveDim(currentFilters);
  const anyApplied = appliedActiveDim != null;
  const anyDraft = draftActiveDim != null;

  const utmInitiallyOpen =
    appliedActiveDim != null && UTM_KEYS.includes(appliedActiveDim);
  const [utmOpen, setUtmOpen] = useState(utmInitiallyOpen);

  function setFilter(key: keyof ConnectivityFilterOptions, values: string[]) {
    // Mutual exclusion: picking values in one dimension clears every other.
    if (values.length === 0) {
      setDraft((prev) => ({ ...prev, [key]: undefined }));
    } else {
      const next: ConnectivityFilters = { [key]: values };
      setDraft(next);
    }
  }

  function apply() {
    const params = encodeFiltersToSearchParams(
      draft as Record<string, string[] | undefined>,
      CONNECTIVITY_FULL_TO_SHORT as Record<string, string>
    );
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }

  function reset() {
    setDraft({});
    startTransition(() => router.push(pathname, { scroll: false }));
  }

  return (
    <div className="rounded-lg border border-border/60 bg-card p-3">
      <div className="mb-2 flex items-center gap-2">
        <Filter className="size-3.5 text-muted-foreground" />
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Filters
        </span>
        <span className="text-[10px] text-muted-foreground">
          one dimension at a time
        </span>
        {anyApplied && (
          <Badge variant="secondary" className="ml-2 h-4 px-1.5 text-[9px]">
            {LABELS[appliedActiveDim!]}: {currentFilters[appliedActiveDim!]!.length} applied
          </Badge>
        )}

        <div className="ml-auto flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={reset}
            disabled={isPending || (!anyDraft && !anyApplied)}
          >
            <RotateCcw className="size-3" />
            Reset
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={apply}
            disabled={isPending || !isDirty}
          >
            <Send className="size-3" />
            {isPending ? 'Applying…' : 'Apply'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {PRIMARY_KEYS.map((k) => (
          <FilterDropdown
            key={k}
            label={LABELS[k]}
            options={options[k]}
            value={draft[k] ?? []}
            onChange={(v) => setFilter(k, v)}
            disabled={draftActiveDim != null && draftActiveDim !== k}
          />
        ))}
      </div>

      <Collapsible open={utmOpen} onOpenChange={setUtmOpen} className="mt-3">
        <CollapsibleTrigger className="inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-widest text-muted-foreground hover:text-foreground">
          <ChevronsUpDown className="size-3" />
          Website / UTM filters
          {draftActiveDim && UTM_KEYS.includes(draftActiveDim) && (
            <Badge variant="secondary" className="ml-1 h-4 px-1 text-[9px]">
              draft
            </Badge>
          )}
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {UTM_KEYS.map((k) => (
              <FilterDropdown
                key={k}
                label={LABELS[k]}
                options={options[k]}
                value={draft[k] ?? []}
                onChange={(v) => setFilter(k, v)}
                disabled={draftActiveDim != null && draftActiveDim !== k}
              />
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

type DropdownProps = {
  label: string;
  options: string[];
  value: string[];
  onChange: (values: string[]) => void;
  disabled?: boolean;
};

function FilterDropdown({ label, options, value, onChange, disabled }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const sortedOptions = useMemo(() => [...options].sort(), [options]);
  const hasSelection = value.length > 0;

  function toggle(v: string) {
    if (value.includes(v)) onChange(value.filter((x) => x !== v));
    else onChange([...value, v]);
  }

  return (
    <Popover open={open} onOpenChange={disabled ? undefined : setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            disabled={disabled}
            className={cn(
              'h-auto w-full justify-between gap-1.5 px-2.5 py-1.5 text-left',
              hasSelection && 'border-foreground/40',
              disabled && 'opacity-50'
            )}
          />
        }
      >
        <div className="flex min-w-0 flex-col items-start gap-0.5">
          <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
            {label}
          </span>
          <span className="w-full truncate text-xs">
            {hasSelection ? (
              value.length === 1 ? (
                value[0]
              ) : (
                <span>
                  {value[0]}
                  <span className="text-muted-foreground"> +{value.length - 1}</span>
                </span>
              )
            ) : (
              <span className="text-muted-foreground">
                {sortedOptions.length === 0 ? 'No values' : disabled ? '—' : 'Any'}
              </span>
            )}
          </span>
        </div>
        <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0">
        <Command>
          <CommandInput placeholder={`Filter ${label}…`} />
          <CommandList>
            {sortedOptions.length === 0 && (
              <CommandEmpty>No values available.</CommandEmpty>
            )}
            <CommandGroup>
              {hasSelection && (
                <CommandItem
                  value="__clear__"
                  onSelect={() => onChange([])}
                  className="cursor-pointer text-muted-foreground"
                >
                  <X className="mr-2 size-3.5" />
                  Clear selection
                </CommandItem>
              )}
              {sortedOptions.map((opt) => {
                const selected = value.includes(opt);
                return (
                  <CommandItem
                    key={opt}
                    value={opt}
                    onSelect={() => toggle(opt)}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        'mr-2 size-3.5',
                        selected ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <span className="truncate">{opt}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
