'use client';

// DataTable — generic TanStack Table wrapper used by every table on the dashboard.
// Features (SPEC.md "Style and conventions"): pagination, sort, search, CSV export, loading skeletons,
// empty state, and column visibility.

import { useState, type ReactNode } from 'react';
import {
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable
} from '@tanstack/react-table';
import { ArrowUpDown, ChevronLeft, ChevronRight, Download, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

type Props<TData, TValue> = {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  loading?: boolean;
  /** Column id used for the global free-text search box. Set to null/undefined to hide search. */
  searchColumn?: string | null;
  searchPlaceholder?: string;
  /** Initial page size (default 50). */
  pageSize?: number;
  /** File name (without extension) for CSV export. Pass null to disable export. */
  exportFileName?: string | null;
  /** Custom CSV row mapper. Defaults to JSON-serializing every column. */
  exportRowMapper?: (row: TData) => Record<string, unknown>;
  toolbar?: ReactNode;
  emptyText?: string;
  className?: string;
};

export function DataTable<TData, TValue>({
  columns,
  data,
  loading,
  searchColumn = null,
  searchPlaceholder = 'Search…',
  pageSize = 50,
  exportFileName = 'export',
  exportRowMapper,
  toolbar,
  emptyText = 'No rows.',
  className
}: Props<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [filters, setFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [globalFilter, setGlobalFilter] = useState('');

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters: filters, columnVisibility, globalFilter },
    onSortingChange: setSorting,
    onColumnFiltersChange: setFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    initialState: { pagination: { pageSize } }
  });

  function exportCsv() {
    if (!exportFileName) return;
    const rows = table.getFilteredRowModel().rows;
    if (rows.length === 0) return;
    const mapped = rows.map((r) =>
      exportRowMapper ? exportRowMapper(r.original) : (r.original as Record<string, unknown>)
    );
    const headers = Array.from(
      new Set(mapped.flatMap((row) => Object.keys(row)))
    );
    const escape = (v: unknown) => {
      if (v == null) return '';
      const s = typeof v === 'string' ? v : JSON.stringify(v);
      // RFC 4180-ish CSV escape
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const csv = [
      headers.join(','),
      ...mapped.map((row) => headers.map((h) => escape(row[h])).join(','))
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const ts = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `${exportFileName}_${ts}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex flex-wrap items-center gap-2">
        {searchColumn !== null && (
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-8 w-64 pl-7"
            />
          </div>
        )}
        <div className="ml-auto flex items-center gap-2">
          {toolbar}
          {exportFileName && (
            <Button
              size="sm"
              variant="outline"
              onClick={exportCsv}
              disabled={loading || data.length === 0}
              className="gap-1.5"
            >
              <Download className="size-3.5" />
              CSV
            </Button>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border/60">
        <Table>
          <TableHeader className="bg-muted/40">
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="hover:bg-transparent">
                {hg.headers.map((h) => (
                  <TableHead key={h.id} className="text-[11px] uppercase tracking-wider">
                    {h.isPlaceholder ? null : h.column.getCanSort() ? (
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
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {columns.map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-sm text-muted-foreground"
                >
                  {emptyText}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} className="hover:bg-muted/30">
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-2.5">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div>
          {table.getFilteredRowModel().rows.length} row
          {table.getFilteredRowModel().rows.length === 1 ? '' : 's'} · page{' '}
          {table.getState().pagination.pageIndex + 1} of{' '}
          {Math.max(table.getPageCount(), 1)}
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="outline"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            aria-label="Previous page"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            aria-label="Next page"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
