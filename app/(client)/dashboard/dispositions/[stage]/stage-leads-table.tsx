'use client';

// Expandable per-lead table. Click a row to fetch & show that lead's call summaries.
import { Fragment, useEffect, useMemo, useState } from 'react';
import {
  ArrowUpDown,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  Copy,
  Download,
  Link as LinkIcon,
  MapPin,
  Phone,
  Play,
  Search,
  Tag
} from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState
} from '@tanstack/react-table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type {
  ClientCallSummary,
  ClientLeadRow
} from '@/lib/queries/client';
import { formatDateOnly, formatDateTimeIST, formatRelative } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { LeadStageDropdown } from '@/components/admin/LeadStageDropdown';

type Props = {
  leads: ClientLeadRow[];
  stage: string;
  userRole?: 'client' | 'admin' | 'super_admin';
};

function escapeCsv(v: unknown): string {
  if (v == null) return '';
  const s = typeof v === 'string' ? v : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadCsv(rows: Record<string, unknown>[], baseName: string) {
  if (rows.length === 0) {
    toast.error('Nothing to export');
    return;
  }
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

export function StageLeadsTable({ leads, stage, userRole }: Props) {
  const isSuperAdmin = userRole === 'super_admin';
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [summaries, setSummaries] = useState<Record<string, ClientCallSummary[] | 'loading' | 'error'>>(
    {}
  );
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'first_name', desc: false }
  ]);
  const [globalFilter, setGlobalFilter] = useState('');

  // ── Reviewed state ──────────────────────────────────────────────────────────
  // Map of ls_prospect_id → reviewed boolean. Loaded in bulk on mount.
  const [reviews, setReviews] = useState<Record<string, boolean>>({});
  const [reviewPending, setReviewPending] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (leads.length === 0) return;
    const ids = leads.map((l) => l.ls_prospect_id);
    const supa = createSupabaseBrowserClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supa as any)
      .from('dashboard_lead_reviews')
      .select('lead_id, reviewed')
      .in('lead_id', ids)
      .then(({ data }: { data: { lead_id: string; reviewed: boolean }[] | null }) => {
        const map: Record<string, boolean> = {};
        (data ?? []).forEach((r) => { map[r.lead_id] = r.reviewed; });
        setReviews(map);
      });
  }, [leads]);

  async function toggleReview(lsId: string) {
    const current = reviews[lsId] ?? false;
    const next = !current;
    // Optimistic
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
      // Rollback
      setReviews((r) => ({ ...r, [lsId]: current }));
      toast.error('Could not save review state');
    } finally {
      setReviewPending((s) => { const n = new Set(s); n.delete(lsId); return n; });
    }
  }

  async function toggle(lsId: string) {
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
        const { data, error } = await (supa as any)
          .from('v_client_call_summaries')
          .select('*')
          .eq('lead_id', lsId)
          .order('call_start', { ascending: false, nullsFirst: false });
        if (error) throw error;
        setSummaries((s) => ({ ...s, [lsId]: (data ?? []) as ClientCallSummary[] }));
      } catch (e) {
        console.error(e);
        setSummaries((s) => ({ ...s, [lsId]: 'error' }));
      }
    }
  }

  const columns = useMemo<ColumnDef<ClientLeadRow>[]>(
    () => [
      {
        id: 'chevron',
        header: '',
        size: 36,
        cell: ({ row }) =>
          expandedId === row.original.ls_prospect_id ? (
            <ChevronDown className="size-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-4 text-muted-foreground" />
          )
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
          <span className="text-sm truncate block">
            {row.original.city ?? '—'}
            {row.original.state ? (
              <span className="text-muted-foreground">, {row.original.state}</span>
            ) : null}
          </span>
        )
      },
      // Stage override — only shown to super_admin. Lets them reclassify a lead
      // inline; on change, the lead moves out of the current drill-down (the
      // server action revalidates this route).
      ...(isSuperAdmin
        ? [
            {
              id: 'stage_override',
              header: 'Stage',
              size: 220,
              enableSorting: false,
              cell: ({ row }: { row: { original: ClientLeadRow } }) => (
                <LeadStageDropdown
                  leadId={row.original.lead_uid}
                  currentStage={stage}
                  className="w-full"
                />
              )
            } as ColumnDef<ClientLeadRow>
          ]
        : []),
      {
        accessorKey: 'lead_source',
        header: 'Lead Source',
        size: 80,
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground truncate block">
            {row.original.lead_source ?? '—'}
          </span>
        )
      },
      {
        accessorKey: 'last_call_summary',
        header: 'Last Summary',
        size: 260,
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
      // "Connected On" column removed 2026-05-23 — wasn't useful in the per-stage
      // drill-in (the connect-attempt number is mostly noise once stage is known).
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
        cell: ({ row }) => {
          const id = row.original.ls_prospect_id;
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
    [expandedId, reviews, reviewPending, isSuperAdmin, stage]
  );

  const table = useReactTable({
    data: leads,
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
      leads.map((l) => ({
        ls_prospect_id: l.ls_prospect_id,
        first_name: l.first_name,
        phone: l.phone,
        city: l.city,
        state: l.state,
        preferred_campus: l.preferred_campus,
        interested_field: l.interested_field,
        lead_source: l.lead_source,
        last_called_at: l.last_called_at,
        total_attempts: l.total_attempts,
        total_connects: l.total_connects,
        callback_datetime: l.callback_datetime,
        last_call_summary: l.last_call_summary,
        is_archived: l.is_archived
      })),
      `leads_${stage.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`
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
            placeholder="Search by name, city, source…"
            className="h-8 w-80 pl-7"
          />
        </div>
        <div className="ml-auto">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={exportAll}
            disabled={leads.length === 0}
          >
            <Download className="size-3.5" /> CSV
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border/60">
        <Table className="table-fixed w-full min-w-[900px]">
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
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-sm text-muted-foreground"
                >
                  No leads in this stage.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => {
                const lsId = row.original.ls_prospect_id;
                const isExpanded = expandedId === lsId;
                const data = summaries[lsId];
                return (
                  <Fragment key={row.id}>
                    <TableRow
                      onClick={() => toggle(lsId)}
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
                          <LeadDetailPanel lead={row.original} summaries={data} />
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
          {table.getFilteredRowModel().rows.length} of {leads.length.toLocaleString('en-IN')}{' '}
          · page {table.getState().pagination.pageIndex + 1} of{' '}
          {Math.max(table.getPageCount(), 1)}
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="outline"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            aria-label="Previous"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            aria-label="Next"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function LeadDetailPanel({
  lead,
  summaries
}: {
  lead: ClientLeadRow;
  summaries: ClientCallSummary[] | 'loading' | 'error' | undefined;
}) {
  return (
    // min-w-0 on grid children is essential — otherwise long unbroken summary text
    // forces the right column past the table's colspan cell and out of the viewport.
    <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
      <div className="min-w-0">
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Lead details
        </div>
        <ul className="mt-2 space-y-1.5 text-xs">
          <Detail icon={<Phone className="size-3.5" />} label="Phone">
            <span className="font-mono">{lead.phone ?? '—'}</span>
          </Detail>
          <Detail label="LS Prospect">
            <span className="inline-flex items-center gap-1.5">
              <span className="font-mono text-[10px] text-muted-foreground break-all" title={lead.ls_prospect_id}>
                {lead.ls_prospect_id}
              </span>
              <CopyButton value={lead.ls_prospect_id} label="LS ID" />
            </span>
          </Detail>
          <Detail icon={<MapPin className="size-3.5" />} label="Location">
            {[lead.city, lead.state].filter(Boolean).join(', ') || '—'}
          </Detail>
          <Detail icon={<LinkIcon className="size-3.5" />} label="Lead Source">
            {lead.lead_source ?? '—'}
          </Detail>
          <Detail icon={<Tag className="size-3.5" />} label="Campus / Field">
            {[lead.preferred_campus, lead.interested_field].filter(Boolean).join(' · ') || '—'}
          </Detail>
          <Detail icon={<Calendar className="size-3.5" />} label="Ingested">
            {lead.ls_ingested_at ? formatRelative(lead.ls_ingested_at) : '—'}
          </Detail>
          {lead.callback_datetime && (
            <Detail icon={<Calendar className="size-3.5" />} label="Callback">
              <span className="font-mono">{formatDateTimeIST(lead.callback_datetime)}</span>
            </Detail>
          )}
          <Detail label="Status">
            {lead.is_archived ? (
              <Badge variant="outline" className="text-[10px]">
                Archived
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-[10px]">
                Active
              </Badge>
            )}
          </Detail>
        </ul>
      </div>

      <div className="min-w-0">
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
                    <Badge variant="outline" className="rounded-full text-[10px]">
                      {c.call_status}
                    </Badge>
                  )}
                  {/* classification pill removed 2026-06-01 — redundant when the
                     call summary text already conveys the outcome. */}
                  <div className="ml-auto">
                    <RecordingPlayButton callId={c.call_id} />
                  </div>
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
    </div>
  );
}

// ClassificationPill removed 2026-06-01 — the summary text already conveys
// the outcome (Warm / Did Not Pick / etc.) and the redundant chip added noise.

function Detail({
  icon,
  label,
  children
}: {
  icon?: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-baseline gap-2">
      <span className="inline-flex w-20 shrink-0 items-center gap-1 text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="flex-1">{children}</span>
    </li>
  );
}

// Inline recording player. Lazy-loads the audio: the recording route either
// returns a direct URL (newer calls in object storage) or streams the bytes
// (legacy calls proxied through ElevenLabs). We swap the trigger out for a
// native <audio controls> element so users can scrub.
function RecordingPlayButton({ callId }: { callId: string }) {
  const [loading, setLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isBlob, setIsBlob] = useState(false);

  // Revoke the blob URL when the card unmounts so we don't leak it. Direct
  // URLs (Azure-hosted) don't need cleanup.
  useEffect(() => {
    return () => {
      if (isBlob && audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [isBlob, audioUrl]);

  async function load() {
    if (audioUrl || loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/recording/${encodeURIComponent(callId)}`);
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        toast.error(body?.error || 'Recording is not available.');
        return;
      }
      const ct = res.headers.get('content-type') ?? '';
      if (ct.includes('application/json')) {
        const body = (await res.json()) as { url?: string };
        if (!body.url) {
          toast.error('Recording is not available.');
          return;
        }
        setAudioUrl(body.url);
        setIsBlob(false);
      } else {
        const blob = await res.blob();
        setAudioUrl(URL.createObjectURL(blob));
        setIsBlob(true);
      }
    } catch {
      toast.error('Could not load recording.');
    } finally {
      setLoading(false);
    }
  }

  if (audioUrl) {
    return <audio src={audioUrl} controls className="h-7" preload="metadata" />;
  }
  return (
    <button
      type="button"
      onClick={load}
      disabled={loading}
      className="inline-flex items-center gap-1 rounded-md border border-border/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
    >
      <Play className="size-3" />
      {loading ? 'Loading…' : 'Play recording'}
    </button>
  );
}
