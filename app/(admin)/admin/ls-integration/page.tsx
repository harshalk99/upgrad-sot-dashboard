// Admin LS Integration — SPEC.md §8.2.4.
// Hourly success line, recent failures table, push success rate metric,
// stale unpushed leads, retry-failed-pushes button.

import Link from 'next/link';
import { ArrowLeftRight, CheckCircle2, XCircle } from 'lucide-react';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/getUser';
import {
  getLsHealth,
  getLsPushStats24h,
  getRecentLsFailures,
  getStaleUnpushedLeads
} from '@/lib/queries/admin';
import { Header } from '@/components/layout/Header';
import { RefreshButton } from '@/components/layout/RefreshButton';
import { ChartCard } from '@/components/charts/ChartCard';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { MetricCardGrid } from '@/components/dashboard/MetricCardGrid';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatDateTimeIST, formatRelative } from '@/lib/formatters';
import { RetryFailedPushesButton } from '@/components/admin/RetryFailedPushesButton';

export const dynamic = 'force-dynamic';

export default async function LsIntegrationPage() {
  const user = (await getCurrentUser())!;
  const sb = await createSupabaseServerClient();

  const [health, failures, stats, stale] = await Promise.all([
    getLsHealth(sb, 24),
    getRecentLsFailures(sb, 100),
    getLsPushStats24h(sb),
    getStaleUnpushedLeads(sb, 100)
  ]);

  return (
    <>
      <Header
        email={user.email ?? ''}
        role={user.role}
        displayName={user.displayName}
        context="Predixion · Operations"
        title="LeadSquared Integration"
        subtitle="CRM sync health — outbound pushes, failures, and stale leads."
        toolbar={
          <div className="flex items-center gap-2">
            <RetryFailedPushesButton />
            <RefreshButton />
          </div>
        }
      />

      <div className="space-y-6 p-6">
        <MetricCardGrid cols={4}>
          <MetricCard
            title="Push Success Rate (24h)"
            value={`${stats.success_pct}%`}
            subtitle={`${stats.succeeded_24h.toLocaleString('en-IN')} of ${stats.total_24h.toLocaleString('en-IN')} requests`}
            icon={ArrowLeftRight}
            threshold={{ warn: 90, critical: 80 }}
          />
          <MetricCard
            title="Failures (24h)"
            value={(stats.total_24h - stats.succeeded_24h).toLocaleString('en-IN')}
            subtitle="Outbound push errors"
            icon={XCircle}
            threshold={{ warn: 10, critical: 25 }}
            invert
          />
          <MetricCard
            title="Stale Unpushed Leads"
            value={stale.length}
            subtitle="lead_stage set, unpushed >30m"
            threshold={{ warn: 10, critical: 25 }}
            invert
          />
          <MetricCard
            title="Total Requests (24h)"
            value={stats.total_24h}
            subtitle="All LS API attempts"
          />
        </MetricCardGrid>

        <ChartCard
          title="Hourly success rate (last 24h)"
          subtitle="Stacked per-action: succeeded / failed by hour"
          height={280}
        >
          <LsHealthChart data={health} />
        </ChartCard>

        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard
            title={`Recent failures (${failures.length})`}
            subtitle="Latest 100 failed sync attempts"
            height="auto"
          >
            <FailuresTable rows={failures} />
          </ChartCard>

          <ChartCard
            title={`Stale unpushed leads (${stale.length})`}
            subtitle="Have a lead_stage but haven't been pushed to LS in >30m"
            height="auto"
          >
            <StaleLeadsTable rows={stale} />
          </ChartCard>
        </div>
      </div>
    </>
  );
}

function LsHealthChart({
  data
}: {
  data: { hour: string; action: string; total: number; succeeded: number; failed: number; success_pct: number }[];
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
        No LS sync activity in the last 24 hours.
      </div>
    );
  }
  // Aggregate by hour across all actions for a single line.
  const byHour = new Map<string, { succeeded: number; failed: number }>();
  for (const r of data) {
    const e = byHour.get(r.hour) ?? { succeeded: 0, failed: 0 };
    e.succeeded += r.succeeded;
    e.failed += r.failed;
    byHour.set(r.hour, e);
  }
  const points = Array.from(byHour.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([hour, v]) => ({ hour, ...v, total: v.succeeded + v.failed }));
  const maxTotal = Math.max(...points.map((p) => p.total), 1);

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block size-2 rounded-sm bg-emerald-500" /> Succeeded
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block size-2 rounded-sm bg-red-500" /> Failed
        </span>
      </div>
      <div className="flex flex-1 items-end gap-[2px]" style={{ minHeight: 160 }}>
        {points.map((p) => {
          const total = p.total;
          const sH = (p.succeeded / maxTotal) * 100;
          const fH = (p.failed / maxTotal) * 100;
          const d = new Date(p.hour);
          return (
            <div
              key={p.hour}
              className="group relative flex flex-1 min-w-0 flex-col-reverse"
              title={`${d.toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short', hour12: false })} · ${p.succeeded} ok / ${p.failed} fail`}
            >
              <div className="w-full bg-emerald-500" style={{ height: `${sH}%` }} />
              <div className="w-full bg-red-500" style={{ height: `${fH}%` }} />
              {total === 0 && (
                <div className="h-px w-full bg-border" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FailuresTable({
  rows
}: {
  rows: {
    id: string;
    action: string;
    ls_prospect_id: string | null;
    call_id: string | null;
    response_status: number | null;
    error_message: string | null;
    attempt_number: number | null;
    created_at: string;
  }[];
}) {
  if (rows.length === 0) {
    return (
      <div className="text-xs text-muted-foreground">
        <CheckCircle2 className="mr-1 inline size-3 text-emerald-600" />
        No failures in the recent log.
      </div>
    );
  }
  return (
    <div className="max-h-96 overflow-y-auto">
      <Table className="table-fixed w-full min-w-[700px]">
        <TableHeader className="sticky top-0 bg-muted/40">
          <TableRow>
            <TableHead className="w-[140px]">When</TableHead>
            <TableHead className="w-[110px]">Action</TableHead>
            <TableHead className="w-[70px]">HTTP</TableHead>
            <TableHead>Error</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-mono text-[10px] tabular-nums">
                {r.call_id ? (
                  <Link
                    href={`/admin/call-logs/${encodeURIComponent(r.call_id)}`}
                    className="hover:underline"
                  >
                    {formatDateTimeIST(r.created_at)}
                  </Link>
                ) : (
                  formatDateTimeIST(r.created_at)
                )}
              </TableCell>
              <TableCell className="text-xs">{r.action}</TableCell>
              <TableCell>
                {r.response_status ? (
                  <Badge
                    variant="secondary"
                    className={
                      r.response_status >= 500
                        ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200'
                    }
                  >
                    {r.response_status}
                  </Badge>
                ) : (
                  <Badge variant="secondary">net</Badge>
                )}
              </TableCell>
              <TableCell className="text-xs">
                <span className="block break-words" title={r.error_message ?? ''}>
                  {r.error_message ?? '—'}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function StaleLeadsTable({
  rows
}: {
  rows: {
    id: string;
    ls_prospect_id: string | null;
    first_name: string | null;
    name: string | null;
    phone: string | null;
    lead_stage: string | null;
    updated_at: string;
    total_attempts: number | null;
  }[];
}) {
  if (rows.length === 0) {
    return (
      <div className="text-xs text-muted-foreground">
        <CheckCircle2 className="mr-1 inline size-3 text-emerald-600" />
        No stale unpushed leads — CRM is caught up.
      </div>
    );
  }
  return (
    <div className="max-h-96 overflow-y-auto">
      <Table className="table-fixed w-full min-w-[700px]">
        <TableHeader className="sticky top-0 bg-muted/40">
          <TableRow>
            <TableHead className="w-[120px]">Lead</TableHead>
            <TableHead className="w-[110px]">Phone</TableHead>
            <TableHead>Stage</TableHead>
            <TableHead className="w-[110px]">Stale for</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="truncate">{r.first_name ?? r.name ?? '—'}</TableCell>
              <TableCell className="font-mono text-xs">{r.phone ?? '—'}</TableCell>
              <TableCell className="text-xs">
                <span className="block truncate" title={r.lead_stage ?? ''}>
                  {r.lead_stage ?? '—'}
                </span>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {formatRelative(r.updated_at)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
