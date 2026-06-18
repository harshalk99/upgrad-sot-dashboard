'use client';

// Connected-calls table. Three columns — LS Prospect ID, Date (IST),
// Duration — plus a CSV export. Built on TanStack Table v8 for sort + filter,
// matching the pattern used by StageLeadsTable / LeadsTable.

import { useMemo, useState } from 'react';
import {
  ArrowUpDown,
  Copy,
  Check,
  Download,
  Search
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
import { formatDateOnly } from '@/lib/formatters';
import { toast } from 'sonner';
import type { ConnectedCallRow } from '@/lib/queries/client';

type Props = {
  data: ConnectedCallRow[];
  serverTotal: number;
  renderedCount: number;
};

function escapeCsv(v: unknown): string {
  if (v == null) return '';
  const s = typeof v === 'string' ? v : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      toast.error('Copy failed');
    }
  }
  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center text-muted-foreground hover:text-foreground"
      aria-label="Copy prospect ID"
    >
      {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
    </button>
  );
}

export function ConnectedCallsTable({ data, serverTotal, renderedCount }: Props) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'call_start', desc: true }
  ]);
  const [globalFilter, setGlobalFilter] = useState('');

  const columns = useMemo<ColumnDef<ConnectedCallRow>[]>(
    () => [
      {
        accessorKey: 'ls_prospect_id',
        header: ({ column }) => (
          <button
            type="button"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="inline-flex items-center gap-1 text-left text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground"
          >
            LS Prospect ID
            <ArrowUpDown className="size-3 opacity-50" />
          </button>
        ),
        cell: ({ row }) => (
          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="truncate" title={row.original.ls_prospect_id}>
              {row.original.ls_prospect_id}
            </span>
            <CopyButton value={row.original.ls_prospect_id} />
          </div>
        )
      },
      {
        accessorKey: 'call_start',
        header: ({ column }) => (
          <button
            type="button"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="inline-flex items-center gap-1 text-left text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground"
          >
            Date (IST)
            <ArrowUpDown className="size-3 opacity-50" />
          </button>
        ),
        cell: ({ row }) => (
          <span className="font-mono text-xs tabular-nums">
            {row.original.call_start ? formatDateOnly(row.original.call_start) : '—'}
          </span>
        )
      },
      {
        accessorKey: 'duration_seconds',
        header: ({ column }) => (
          <button
            type="button"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="ml-auto inline-flex items-center gap-1 text-right text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground"
          >
            Duration
            <ArrowUpDown className="size-3 opacity-50" />
          </button>
        ),
        cell: ({ row }) => (
          <div className="text-right font-mono text-xs tabular-nums">
            {formatDuration(row.original.duration_seconds ?? 0)}
          </div>
        )
      }
    ],
    []
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: (row, _columnId, value) => {
      const v = String(value ?? '').toLowerCase();
      if (!v) return true;
      return String(row.original.ls_prospect_id ?? '').toLowerCase().includes(v);
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 50 } }
  });

  function exportCsv() {
    const rows = table.getFilteredRowModel().rows;
    if (rows.length === 0) {
      toast.error('Nothing to export');
      return;
    }
    const headers = ['ls_prospect_id', 'call_date_ist', 'duration_seconds', 'duration_minutes'];
    const lines = rows.map((r) => {
      const d = r.original;
      const minutes = Math.round((d.duration_seconds / 60) * 100) / 100;
      return [
        escapeCsv(d.ls_prospect_id),
        escapeCsv(d.call_start ? formatDateOnly(d.call_start) : ''),
        escapeCsv(d.duration_seconds),
        escapeCsv(minutes)
      ].join(',');
    });
    const csv = [headers.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const ts = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `connected_calls_${ts}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const truncated = renderedCount < serverTotal;

  return (
    <div className="rounded-lg border border-border/60 bg-background">
      <div className="flex flex-wrap items-center gap-2 border-b border-border/60 px-3 py-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Search by LS Prospect ID"
            className="h-8 w-72 pl-8 text-xs"
          />
        </div>
        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          Showing {table.getFilteredRowModel().rows.length.toLocaleString('en-IN')} of{' '}
          {renderedCount.toLocaleString('en-IN')}
          {truncated && ` (server has ${serverTotal.toLocaleString('en-IN')})`}
          <Button variant="outline" size="sm" className="h-8 gap-1" onClick={exportCsv}>
            <Download className="size-3.5" />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border/60 bg-muted/30">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th
                    key={h.id}
                    className="px-3 py-2 text-left font-medium first:pl-4 last:pr-4"
                  >
                    {h.isPlaceholder
                      ? null
                      : flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="border-b border-border/40 last:border-0">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-2 first:pl-4 last:pr-4">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            {table.getRowModel().rows.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-xs text-muted-foreground">
                  No connected calls in this range.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between gap-2 border-t border-border/60 px-3 py-2 text-xs text-muted-foreground">
        <div>
          Page {table.getState().pagination.pageIndex + 1} of{' '}
          {table.getPageCount() || 1}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Prev
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
