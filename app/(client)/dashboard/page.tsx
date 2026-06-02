// Client Overview (SPEC.md §8.1.1).
// CHANGED (post-Phase-3 by user request):
//   - Removed Daily-Volume-per-day chart
//   - Added per-disposition-stage breakdown grid
//   - Added Source performance + State performance business tables
import { Flame, Heart, Clock, Timer } from 'lucide-react';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/getUser';
import {
  getClientAvgCallDuration,
  getClientConversationDepth,
  getClientDispositionBreakdown,
  getClientFunnel,
  getClientMinutesSummary,
  getClientStatePerformance,
  getClientTopObjections
} from '@/lib/queries/client';
import { formatDuration, formatPct } from '@/lib/formatters';
import { decodeDateRange, encodeDateRange, hasDateRange } from '@/lib/url-filters';
import { format as formatDate } from 'date-fns';
import { Header } from '@/components/layout/Header';
import { RefreshButton } from '@/components/layout/RefreshButton';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { MetricCardGrid } from '@/components/dashboard/MetricCardGrid';
import { ChartCard } from '@/components/charts/ChartCard';
import { FunnelChart } from '@/components/charts/FunnelChart';
import { StageBreakdownGrid } from '@/components/dashboard/StageBreakdownGrid';
import { PerformanceTable } from '@/components/dashboard/PerformanceTable';
import { DateRangeFilter } from '@/components/dashboard/DateRangeFilter';

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// Defensive — search-param changes should always re-render with fresh data.
export const dynamic = 'force-dynamic';

export default async function DashboardOverviewPage({ searchParams }: PageProps) {
  const rawParams = await searchParams;
  // 'd' prefix = disposition card date range. Other date filters on this page later
  // can use different prefixes (e.g. 'r' for reports).
  const dispRange = decodeDateRange(rawParams, 'd');

  const user = (await getCurrentUser())!;
  const sb = await createSupabaseServerClient();

  // Source performance card removed 2026-05-23 — moved to /dashboard/connectivity
  // as a filter dimension, where it can slice the entire connectivity story.
  const [funnel, dispositions, minutes, states, avgCall, objections, depth] =
    await Promise.all([
      getClientFunnel(sb),
      getClientDispositionBreakdown(sb, dispRange),
      getClientMinutesSummary(sb),
      getClientStatePerformance(sb),
      getClientAvgCallDuration(sb),
      getClientTopObjections(sb, 10),
      getClientConversationDepth(sb)
    ]);

  const dispSubtitle = hasDateRange(dispRange)
    ? `Filtered: ${dispRange.from ? formatDate(new Date(dispRange.from), 'd MMM') : '…'} – ${dispRange.to ? formatDate(new Date(dispRange.to), 'd MMM yyyy') : '…'} (by last call)`
    : 'Where every lead ends up. Click a stage to drill in.';

  // "Disqualified" card removed 2026-05-24 — the count (total − hot − warm)
  // was misleading because it lumped DNP, Not Yet Called, and pending callbacks
  // together with actual disqualifications. Use the Dispositions page instead.

  const connectRate =
    funnel?.attempted && funnel.attempted > 0
      ? Math.round((100 * (funnel.connected ?? 0)) / funnel.attempted)
      : 0;

  const minutesUtilSeverity =
    (minutes?.utilization_pct ?? 0) >= 90
      ? { warn: 75, critical: 90 }
      : (minutes?.utilization_pct ?? 0) >= 75
      ? { warn: 75, critical: 90 }
      : undefined;

  // Shape rows for PerformanceTable (State only — Source moved to Connectivity filters).
  const stateRows = states.map((s) => ({
    label: s.state,
    total: s.total_leads,
    connected: s.connected,
    hot: s.hot,
    warm: s.warm,
    qualPct: Number(s.qualification_rate_pct ?? 0)
  }));

  return (
    <>
      <Header
        email={user.email ?? ''}
        role={user.role}
        displayName={user.displayName}
        context="UGSOT · Client View"
        title="Overview"
        subtitle="Campaign performance at a glance."
        toolbar={<RefreshButton />}
      />

      <div className="space-y-6 p-6">
        <MetricCardGrid cols={5}>
          <MetricCard title="Hot Leads" value={funnel?.hot ?? 0} icon={Flame} />
          <MetricCard title="Warm Leads" value={funnel?.warm ?? 0} icon={Heart} />
          <MetricCard
            title="Avg Call Duration"
            value={formatDuration(avgCall.avg_seconds)}
            icon={Timer}
          />
          <MetricCard
            title="Connect Rate"
            value={`${connectRate}%`}
            subtitle={`${(funnel?.connected ?? 0).toLocaleString('en-IN')} / ${(funnel?.attempted ?? 0).toLocaleString('en-IN')}`}
          />
          <MetricCard
            title="Voice Minutes (Month)"
            value={`${minutes?.minutes_used ?? 0}`}
            subtitle={`${formatPct(minutes?.utilization_pct)} of ${minutes?.allocated_minutes ?? 0}`}
            threshold={minutesUtilSeverity}
            invert
            icon={Clock}
          />
        </MetricCardGrid>

        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard
            title="Lead Funnel"
            subtitle="Total → Attempted → Connected → Engaged → Hot/Warm"
            height={260}
          >
            <FunnelChart data={funnel ?? null} />
          </ChartCard>

          <ChartCard
            title="Disposition breakdown"
            subtitle={dispSubtitle}
            toolbar={<DateRangeFilter currentRange={dispRange} paramPrefix="d" />}
            height={260}
          >
            <div className="h-full overflow-y-auto pr-1">
              <StageBreakdownGrid
                dispositions={dispositions}
                columns={2}
                compact
                preserveQuery={encodeDateRange(dispRange, 'd').toString() || undefined}
              />
            </div>
          </ChartCard>
        </div>

        <ChartCard
          title="Performance by State"
          subtitle="Geographic distribution and where high-intent leads concentrate · slice by source/UTM on the Connectivity page"
          height="auto"
        >
          <PerformanceTable rows={stateRows} limit={8} />
        </ChartCard>

        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard
            title="Top objections (30 days)"
            subtitle="Why prospects most often push back during conversations"
            height="auto"
          >
            <ObjectionsList objections={objections} />
          </ChartCard>

          <ChartCard
            title="Conversation depth"
            subtitle="How thorough conversations tend to get"
            height="auto"
          >
            <ConversationDepth rows={depth} />
          </ChartCard>
        </div>
      </div>
    </>
  );
}

// ─── Local presentation helpers ─────────────────────────────────────────────
// Kept inline because they're only used here. If we ever need them on another
// page, lift them into components/dashboard/.

function ObjectionsList({
  objections
}: {
  objections: { objection: string; count: number }[];
}) {
  if (objections.length === 0) {
    return (
      <div className="text-xs text-muted-foreground">
        No objections recorded in the last 30 days.
      </div>
    );
  }
  const max = objections[0].count;
  return (
    <ol className="space-y-2">
      {objections.map((o) => (
        <li key={o.objection} className="grid grid-cols-[1fr_auto] items-center gap-2 text-xs">
          <div className="min-w-0 truncate" title={o.objection}>
            {o.objection}
          </div>
          <span className="font-mono tabular-nums text-muted-foreground">{o.count}</span>
          <div className="col-span-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-amber-500"
              style={{ width: `${(o.count / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}

function ConversationDepth({ rows }: { rows: { depth: string; count: number }[] }) {
  if (rows.length === 0) {
    return <div className="text-xs text-muted-foreground">No depth data yet.</div>;
  }
  const palette = ['#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#94a3b8'];
  const total = rows.reduce((s, r) => s + r.count, 0);
  return (
    <div className="space-y-3">
      <div className="flex h-3 overflow-hidden rounded-md">
        {rows.map((r, i) => (
          <div
            key={r.depth}
            className="h-full"
            style={{ width: `${(r.count / total) * 100}%`, backgroundColor: palette[i % palette.length] }}
            title={`${r.depth}: ${r.count}`}
          />
        ))}
      </div>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5 sm:grid-cols-3">
        {rows.map((r, i) => {
          const pct = total === 0 ? 0 : Math.round((1000 * r.count) / total) / 10;
          return (
            <li key={r.depth} className="flex items-center gap-2 text-xs">
              <span
                className="inline-block size-2 shrink-0 rounded-sm"
                style={{ backgroundColor: palette[i % palette.length] }}
              />
              <span className="truncate" title={r.depth}>
                {r.depth}
              </span>
              <span className="ml-auto font-mono text-[10px] text-muted-foreground tabular-nums">
                {pct}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
