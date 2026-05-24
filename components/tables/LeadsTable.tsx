'use client';

// LeadsTable — Hot / Warm / CB-Later leads with expandable call summaries.
// Click a row to fetch & show that lead's call history inline (lazy-loaded).
import { Fragment, useEffect, useMemo, useState } from 'react';
import {
  ArrowUpDown,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  Copy,
  Download,
  Search
} from 'lucide-react';
import type { ColumnDef, SortingState } from '@tanstack/react-table';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable
} from '@tanstack/react-table';
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
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { HotWarmLeadRow, ClientCallSummary } from '@/lib/queries/client';
import { LeadStageDropdown } from '@/components/admin/LeadStageDropdown';
import { formatDateOnly, formatDateTimeIST } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// Re-export for backwards compat with reports-actions.tsx
export type HotWarmLead = HotWarmLeadRow;

/** Inline copy-to-clipboard button. Used for LS IDs which clients sometimes
 *  need to paste into LeadSquared search. */
function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(value).then(
          () => {
            setCopied(true);
            toast.success(`${label ?? 'Copied'} to clipboard`);
            setTimeout(() => setCopied(false), 1200);
          },
          () => toast.error('Could not copy')
        );
      }}
      title={`Copy ${label ?? value}`}
      aria-label={`Copy ${label ?? value}`}
      className="inline-flex shrink-0 items-center justify-center rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
    >
      {copied ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
    </button>
  );
}

// Per UGSOT request 2026-05-23: badge labels mirror the raw lead_stage string.
const STAGE_BADGE: Record<string, { label: string; className: string }> = {
  'AI Bot Qualified - High Intent': {
    label: 'AI Bot Qualified - High Intent',
    className: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200'
  },
  'AI Bot Qualified - Warm': {
    label: 'AI Bot Qualified - Warm',
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200'
  },
  'AI Bot Reached - CB Later': {
    label: 'AI Bot Reached - CB Later',
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200'
  }
};

function escapeCsv(v: unknown): string {
  if (v == null) return '';
  const s = typeof v === 'string' ? v : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadCsv(rows: Record<string, unknown>[], baseName: string) {
  if (rows.length === 0) { toast.error('Nothing to export'); return; }
  const headers = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const csv = [
    headers.join(','),
    ...rows.map((r) => headers.map((h) => escapeCsv(r[h])).join(','))
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${baseName}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success('CSV downloaded');
}

export function LeadsTable({
  data,
  userRole
}: {
  data: HotWarmLeadRow[];
  /** Required so we know whether to show the manual stage-override dropdown. */
  userRole?: 'client' | 'admin' | 'super_admin';
}) {
  const isSuperAdmin = userRole === 'super_admin';
  const [sorting, setSorting] = useState<SortingState>([{ id: 'lead_stage', desc: false }]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [reviews, setReviews] = useState<Record<string, boolean>>({});
  const [reviewPending, setReviewPending] = useState<Set<string>>(new Set());

  // ── Expand / call-summaries state ──────────────────────────────────────────
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [summaries, setSummaries] = useState<
    Record<string, ClientCallSummary[] | 'loading' | 'error'>
  >({});

  async function toggleExpand(lsId: string) {
    if (expandedId === lsId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(lsId);
    if (!summaries[lsId]) {
      setSummaries((s) => ({ ...s, [lsId]: 'loading' }));
      try {
        const supa = createSupabaseBrowserClient();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: calls, error } = await (supa as any)
          .from('v_client_call_summaries')
          .select('*')
          .eq('lead_id', lsId)
          .order('call_start', { ascending: false, nullsFirst: false });
        if (error) throw error;
        setSummaries((s) => ({ ...s, [lsId]: (calls ?? []) as ClientCallSummary[] }));
      } catch (e) {
        console.error(e);
        setSummaries((s) => ({ ...s, [lsId]: 'error' }));
      }
    }
  }

  // ── Load existing review states on mount ──────────────────────────────────
  useEffect(() => {
    const ids = data.map((l) => l.ls_prospect_id).filter(Boolean) as string[];
    if (ids.length === 0) return;
    const supa = createSupabaseBrowserClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supa as any)
      .from('dashboard_lead_reviews')
      .select('lead_id, reviewed')
      .in('lead_id', ids)
      .then(({ data: rows }: { data: { lead_id: string; reviewed: boolean }[] | null }) => {
        const map: Record<string, boolean> = {};
        (rows ?? []).forEach((r) => { map[r.lead_id] = r.reviewed; });
        setReviews(map);
      });
  }, [data]);

  async function toggleReview(lsId: string) {
    const current = reviews[lsId] ?? false;
    const next = !current;
    setReviews((r) => ({ ...r, [lsId]: next }));
    setReviewPending((s) => new Set(s).add(lsId));
    try {
      const supa = createSupabaseBrowserClient();
      const { data: { user } } = await supa.auth.getUser();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supa as any)
        .from('dashboard_lead_reviews')
        .upsert({
          lead_id: lsId,
          reviewed: next,
          reviewed_by: user?.id ?? null,
          reviewed_at: next ? new Date().toISOString() : null
        }, { onConflict: 'lead_id' });
      if (error) throw error;
    } catch (e) {
      console.error(e);
      setReviews((r) => ({ ...r, [lsId]: current }));
      toast.error('Could not save review state');
    } finally {
      setReviewPending((s) => { const n = new Set(s); n.delete(lsId); return n; });
    }
  }

  const columns = useMemo<ColumnDef<HotWarmLeadRow>[]>(
    () => [
      {
        id: 'chevron',
        header: '',
        size: 36,
        enableSorting: false,
        cell: ({ row }) => {
          const lsId = row.original.ls_prospect_id;
          return expandedId === lsId ? (
            <ChevronDown className="size-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="size-4 rotate-[-90deg] text-muted-foreground" />
          );
        }
      },
      {
        accessorKey: 'first_name',
        header: 'Name',
        size: 100,
        cell: ({ row }) => (
          <span className="font-medium truncate block">{row.original.first_name ?? '—'}</span>
        )
      },
      {
        accessorKey: 'phone',
        header: 'Phone',
        size: 100,
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.original.phone ?? '—'}</span>
        )
      },
      {
        accessorKey: 'city',
        header: 'City',
        size: 120,
        cell: ({ row }) => (
          <span className="truncate block">
            {row.original.city ?? '—'}
            {row.original.state && (
              <span className="text-muted-foreground">, {row.original.state}</span>
            )}
          </span>
        )
      },
      {
        accessorKey: 'preferred_campus',
        header: 'Campus',
        size: 80,
        cell: ({ row }) => (
          <span className="truncate block">{row.original.preferred_campus ?? '—'}</span>
        )
      },
      {
        accessorKey: 'lead_stage',
        header: 'Stage',
        size: 220,
        cell: ({ row }) => {
          const stage = row.original.lead_stage ?? '';
          // Super admin gets an inline dropdown to override the stage.
          // Everyone else sees the read-only badge.
          if (isSuperAdmin && row.original.lead_uid) {
            return (
              <LeadStageDropdown
                leadId={row.original.lead_uid}
                currentStage={stage}
                className="w-full"
              />
            );
          }
          const meta = STAGE_BADGE[stage];
          return meta ? (
            <Badge variant="secondary" className={meta.className}>
              {meta.label}
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground">{stage || '—'}</span>
          );
        }
      },
      {
        accessorKey: 'last_call_summary',
        header: 'Last Summary',
        size: 280,
        enableSorting: false,
        cell: ({ row }) => {
          const s = row.original.last_call_summary;
          if (!s) return <span className="text-xs text-muted-foreground/50 italic">N/A</span>;
          return (
            <span className="text-xs leading-snug text-foreground/80 line-clamp-2" title={s}>
              {s}
            </span>
          );
        }
      },
      {
        accessorKey: 'callback_datetime',
        header: 'Callback',
        size: 110,
        cell: ({ row }) =>
          row.original.callback_datetime ? (
            <span className="font-mono text-xs">
              {formatDateTimeIST(row.original.callback_datetime)}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )
      },
      {
        accessorKey: 'last_called_at',
        header: 'Last Called',
        size: 90,
        cell: ({ row }) => (
          <span className="font-mono text-xs tabular-nums">
            {formatDateOnly(row.original.last_called_at)}
          </span>
        )
      },
      {
        id: 'reviewed',
        header: 'Reviewed',
        size: 80,
        enableSorting: false,
        cell: ({ row }) => {
          const lsId = row.original.ls_prospect_id;
          if (!lsId) return null;
          const isReviewed = reviews[lsId] ?? false;
          const isPending = reviewPending.has(lsId);
          return (
            <button
              type="button"
              disabled={isPending}
              onClick={(e) => {
                e.stopPropagation();
                toggleReview(lsId);
              }}
              title={isReviewed ? 'Mark as not reviewed' : 'Mark as reviewed'}
              className={cn(
                'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors',
                isReviewed
                  ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-950 dark:text-emerald-300'
                  : 'bg-muted text-muted-foreground hover:bg-muted/70',
                isPending && 'opacity-50 cursor-wait'
              )}
            >
              {isReviewed ? (
                <CheckCircle2 className="size-3" />
              ) : (
                <Circle className="size-3" />
              )}
              {isReviewed ? 'Reviewed' : 'Review'}
            </button>
          );
        }
      },
      {
        accessorKey: 'ls_prospect_id',
        header: 'LS ID',
        size: 90,
        enableSorting: false,
        cell: ({ row }) => {
          const id = row.original.ls_prospect_id;
          if (!id) return <span className="text-xs text-muted-foreground">—</span>;
          return (
            <div className="flex items-center gap-1">
              <span className="font-mono text-[10px] text-muted-foreground" title={id}>
                {id.slice(0, 8)}…
              </span>
              <CopyButton value={id} label="LS ID" />
            </div>
          );
        }
      }
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [expandedId, reviews, reviewPending, isSuperAdmin]
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 25 } }
  });

  function exportAll() {
    downloadCsv(
      data.map((r) => ({
        ls_prospect_id: r.ls_prospect_id,
        first_name: r.first_name,
        phone: r.phone,
        city: r.city,
        state: r.state,
        preferred_campus: r.preferred_campus,
        interested_field: r.interested_field,
        lead_stage: r.lead_stage,
        callback_booked: r.callback_booked,
        callback_datetime: r.callback_datetime,
        last_called_at: r.last_called_at,
        last_call_summary: r.last_call_summary
      })),
      'hot_warm_leads'
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Search name, city…"
            className="h-8 w-64 pl-7"
          />
        </div>
        <div className="ml-auto">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={exportAll} disabled={data.length === 0}>
            <Download className="size-3.5" /> CSV
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border/60">
        <Table className="table-fixed w-full min-w-[1200px]">
          <TableHeader className="bg-muted/40">
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="hover:bg-transparent">
                {hg.headers.map((h) => (
                  <TableHead
                    key={h.id}
                    className="text-[11px] uppercase tracking-wider"
                    style={{ width: h.getSize() }}
                  >
                    {h.isPlaceholder ? null : h.column.getCanSort() && h.column.id !== 'chevron' ? (
                      <button
                        type="button"
                        onClick={h.column.getToggleSortingHandler()}
                        className="inline-flex items-center gap-1 hover:text-foreground"
                      >
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        <ArrowUpDown className="size-3 opacity-60" />
                      </button>
                    ) : (
                      flexRender(h.column.columnDef.header, h.getContext())
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-sm text-muted-foreground">
                  No hot or warm leads yet.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => {
                const lsId = row.original.ls_prospect_id;
                const isExpanded = lsId != null && expandedId === lsId;
                const callData = lsId ? summaries[lsId] : undefined;
                return (
                  <Fragment key={row.id}>
                    <TableRow
                      onClick={() => lsId && toggleExpand(lsId)}
                      className={cn(
                        'cursor-pointer hover:bg-muted/30',
                        isExpanded && 'bg-muted/30'
                      )}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className="py-2.5">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                    {isExpanded && (
                      <TableRow className="hover:bg-transparent">
                        <TableCell
                          colSpan={columns.length}
                          className="border-t border-border/40 bg-muted/20 p-4"
                        >
                          <CallSummaryPanel lead={row.original} summaries={callData} />
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div>
          {table.getFilteredRowModel().rows.length} of {data.length.toLocaleString('en-IN')}{' '}
          · page {table.getState().pagination.pageIndex + 1} of {Math.max(table.getPageCount(), 1)}
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} aria-label="Previous">
            <ChevronLeft className="size-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} aria-label="Next">
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Inline call-summaries panel (shown on row expand) ───────────────────────
function CallSummaryPanel({
  lead,
  summaries
}: {
  lead: HotWarmLeadRow;
  summaries: ClientCallSummary[] | 'loading' | 'error' | undefined;
}) {
  return (
    // min-w-0 lets the panel shrink inside the colspan cell; max-w-3xl caps reading width.
    <div className="min-w-0 max-w-3xl">
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span className="font-medium">{lead.first_name ?? '—'}</span>
        <span className="font-mono text-[10px] text-muted-foreground">{lead.phone ?? ''}</span>
        <span className="text-muted-foreground">{lead.city}{lead.state ? `, ${lead.state}` : ''}</span>
        {lead.ls_prospect_id && (
          <span className="inline-flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
            LS · {lead.ls_prospect_id.slice(0, 8)}…
            <CopyButton value={lead.ls_prospect_id} label="LS ID" />
          </span>
        )}
      </div>

      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        Call summaries
      </div>

      {summaries === 'loading' && (
        <div className="mt-2 text-xs text-muted-foreground">Loading summaries…</div>
      )}
      {summaries === 'error' && (
        <div className="mt-2 text-xs text-red-600">Could not load summaries.</div>
      )}
      {Array.isArray(summaries) && summaries.length === 0 && (
        <div className="mt-2 text-xs text-muted-foreground">No calls yet for this lead.</div>
      )}
      {Array.isArray(summaries) && summaries.length > 0 && (
        <ol className="mt-2 space-y-2.5">
          {summaries.map((c, i) => (
            <li
              key={c.call_id}
              className="rounded-md border border-border/60 bg-background p-3 text-xs"
            >
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  Attempt #{summaries.length - i}
                </span>
                <span className="text-muted-foreground">
                  {c.call_start ? formatDateOnly(c.call_start) : c.attempt_date ?? '—'}
                </span>
                {c.call_status && (
                  <Badge variant="outline" className="text-[10px]">
                    {c.call_status}
                  </Badge>
                )}
                {c.enquiry_classification && (
                  <Badge variant="secondary" className="text-[10px]">
                    {c.enquiry_classification}
                  </Badge>
                )}
              </div>
              <p className="leading-relaxed text-foreground/90 break-words whitespace-pre-wrap">
                {c.transcript_summary || (
                  <span className="text-muted-foreground">No summary generated.</span>
                )}
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
