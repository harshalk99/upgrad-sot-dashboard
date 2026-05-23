'use client';

// Client island for /admin/call-logs.
// All state (filters + pagination) is reflected in the URL via router.replace.
// The parent server component re-renders with new search params and feeds us
// the filtered rows. Keeps the table cheap — no client-side fetching.

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Filter,
  Flag,
  Search,
  X
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { formatDateTimeIST, formatDuration } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { CallLogRow } from '@/lib/queries/admin';

const CALL_STATUSES = [
  'completed',
  'no-answer',
  'busy',
  'failed',
  'voicemail',
  'in_progress'
];
const CLASSIFICATIONS = ['HOT', 'WARM', 'COLD', 'CB_LATER', 'NOT_INTERESTED', 'INVALID', 'DNP'];
const LEAD_STAGES = [
  'AI Bot Reached - DNP',
  'AI Bot Qualified - Low Interest',
  'AI Bot Qualified - Warm',
  'AI Bot Qualified - High Intent',
  'AI Bot Reached - CB Later',
  'AI Bot Called - Not Interested',
  'AI Bot Called - Not Eligible',
  'AI Bot Sent - Brochure',
  'AI Bot Sent - Payment Link'
];

type Filters = {
  q: string;
  from: string;
  to: string;
  status: string;
  classification: string;
  stage: string;
  flagged: string;
  malfunction: string;
  recording: string;
};

type Props = {
  rows: CallLogRow[];
  total: number;
  page: number;
  pageSize: number;
  filters: Filters;
};

export function CallLogsTable({ rows, total, page, pageSize, filters }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [local, setLocal] = useState<Filters>(filters);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const activeCount = useMemo(
    () => Object.values(local).filter((v) => v !== '').length,
    [local]
  );

  function apply(next: Partial<Filters>, opts?: { resetPage?: boolean }) {
    const merged = { ...local, ...next };
    setLocal(merged);
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) {
      if (v) params.set(k, v);
    }
    if (!opts?.resetPage && page > 0) params.set('page', String(page));
    startTransition(() => {
      router.replace(`/admin/call-logs${params.toString() ? `?${params}` : ''}`);
    });
  }

  function goPage(p: number) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(local)) {
      if (v) params.set(k, v);
    }
    if (p > 0) params.set('page', String(p));
    startTransition(() => {
      router.replace(`/admin/call-logs${params.toString() ? `?${params}` : ''}`);
    });
  }

  function clearAll() {
    setLocal({
      q: '',
      from: '',
      to: '',
      status: '',
      classification: '',
      stage: '',
      flagged: '',
      malfunction: '',
      recording: ''
    });
    startTransition(() => router.replace('/admin/call-logs'));
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="space-y-3 rounded-lg border border-border/60 bg-card p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[260px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={local.q}
              onChange={(e) => setLocal((s) => ({ ...s, q: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') apply({}, { resetPage: true });
              }}
              placeholder="Search by call ID, phone, name, or LS prospect ID…"
              className="h-8 pl-7"
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => apply({}, { resetPage: true })}
            disabled={isPending}
            className="h-8"
          >
            Apply
          </Button>
          {activeCount > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={clearAll}
              className="h-8 gap-1 text-muted-foreground"
            >
              <X className="size-3.5" />
              Clear {activeCount}
            </Button>
          )}
          <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Filter className="size-3" />
            {total.toLocaleString('en-IN')} matching
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-6">
          <FilterField label="From">
            <Input
              type="date"
              value={local.from}
              onChange={(e) => apply({ from: e.target.value }, { resetPage: true })}
              className="h-8"
            />
          </FilterField>
          <FilterField label="To">
            <Input
              type="date"
              value={local.to}
              onChange={(e) => apply({ to: e.target.value }, { resetPage: true })}
              className="h-8"
            />
          </FilterField>
          <FilterField label="Status">
            <select
              value={local.status}
              onChange={(e) => apply({ status: e.target.value }, { resetPage: true })}
              className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
            >
              <option value="">Any</option>
              {CALL_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Classification">
            <select
              value={local.classification}
              onChange={(e) => apply({ classification: e.target.value }, { resetPage: true })}
              className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
            >
              <option value="">Any</option>
              {CLASSIFICATIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Lead stage">
            <select
              value={local.stage}
              onChange={(e) => apply({ stage: e.target.value }, { resetPage: true })}
              className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
            >
              <option value="">Any</option>
              {LEAD_STAGES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Quality">
            <div className="flex flex-wrap gap-1">
              <ToggleChip
                label="Flagged"
                active={local.flagged === 'yes'}
                onClick={() =>
                  apply({ flagged: local.flagged === 'yes' ? '' : 'yes' }, { resetPage: true })
                }
              />
              <ToggleChip
                label="Malfunction"
                active={local.malfunction === 'yes'}
                onClick={() =>
                  apply(
                    { malfunction: local.malfunction === 'yes' ? '' : 'yes' },
                    { resetPage: true }
                  )
                }
              />
              <ToggleChip
                label="Recording"
                active={local.recording === 'yes'}
                onClick={() =>
                  apply(
                    { recording: local.recording === 'yes' ? '' : 'yes' },
                    { resetPage: true }
                  )
                }
              />
            </div>
          </FilterField>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-border/60">
        <Table className="table-fixed w-full min-w-[1100px]">
          <TableHeader className="bg-muted/40">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[140px] text-[11px] uppercase tracking-wider">
                Started
              </TableHead>
              <TableHead className="w-[140px] text-[11px] uppercase tracking-wider">
                Lead
              </TableHead>
              <TableHead className="w-[110px] text-[11px] uppercase tracking-wider">
                Phone
              </TableHead>
              <TableHead className="w-[80px] text-[11px] uppercase tracking-wider">
                Status
              </TableHead>
              <TableHead className="w-[70px] text-right text-[11px] uppercase tracking-wider">
                Duration
              </TableHead>
              <TableHead className="w-[180px] text-[11px] uppercase tracking-wider">
                Stage
              </TableHead>
              <TableHead className="w-[100px] text-[11px] uppercase tracking-wider">
                Classification
              </TableHead>
              <TableHead className="w-[110px] text-[11px] uppercase tracking-wider">
                Flags
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-sm text-muted-foreground">
                  No calls match these filters.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id} className={cn(isPending && 'opacity-60')}>
                  <TableCell className="font-mono text-xs tabular-nums">
                    <Link
                      href={`/admin/call-logs/${encodeURIComponent(r.call_id)}`}
                      className="hover:underline"
                    >
                      {formatDateTimeIST(r.call_start)}
                    </Link>
                  </TableCell>
                  <TableCell className="truncate font-medium">
                    {r.lead_name ?? <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {r.lead_phone ?? '—'}
                  </TableCell>
                  <TableCell className="text-xs">
                    {r.call_status ?? <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs tabular-nums">
                    {formatDuration(r.duration_seconds)}
                  </TableCell>
                  <TableCell className="text-xs">
                    <span className="block truncate" title={r.lead_stage ?? ''}>
                      {r.lead_stage ?? '—'}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs">
                    {r.enquiry_classification ? (
                      <Badge variant="secondary" className="font-mono text-[10px]">
                        {r.enquiry_classification}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {r.call_flagged && (
                        <Badge
                          variant="secondary"
                          className="gap-1 bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200"
                        >
                          <Flag className="size-3" />
                          Flag
                        </Badge>
                      )}
                      {r.agent_malfunction && (
                        <Badge
                          variant="secondary"
                          className="gap-1 bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200"
                        >
                          <AlertTriangle className="size-3" />
                          Malf
                        </Badge>
                      )}
                      {!r.call_flagged && !r.agent_malfunction && (
                        <span className="text-[10px] text-muted-foreground">—</span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div>
          Page {page + 1} of {totalPages} · {total.toLocaleString('en-IN')} total
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="outline"
            onClick={() => goPage(Math.max(0, page - 1))}
            disabled={page === 0 || isPending}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => goPage(Math.min(totalPages - 1, page + 1))}
            disabled={page + 1 >= totalPages || isPending}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function ToggleChip({
  label,
  active,
  onClick
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-md border px-2 py-1 text-[10px] font-medium transition-colors',
        active
          ? 'border-sky-500 bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200'
          : 'border-border bg-background text-muted-foreground hover:text-foreground'
      )}
    >
      {label}
    </button>
  );
}
