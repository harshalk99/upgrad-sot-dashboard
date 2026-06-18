// Client Overview (SPEC.md §8.1.1).
//
// Multi-campaign tenancy (added 2026-06-12):
//   - Header CampaignSwitcher writes `?c=<id>`; super_admin defaults to
//     aggregate (no `?c=`).
//   - Every query runs with the resolved {campaigns, scope} pair so the same
//     page serves UGSOT client, super_admin aggregate, single-campaign
//     drill-in, and digital_partner scoped view.
//   - Voice Minutes cards (cycle + this month) are hidden for digital_partner.

import { Flame, Heart, Clock, Timer } from 'lucide-react';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/getUser';
import {
  getClientAvgCallDuration,
  getClientConversationDepth,
  getClientDispositionBreakdown,
  getClientFunnel,
  getClientMinutesSummary,
  getClientMinutesByCampaignCycle,
  getClientStatePerformance,
  getClientTopObjections,
  listAllowedCampaigns
} from '@/lib/queries/client';
import { getComingSoonCampaign, resolveCampaignFilter, resolveSourceFilter } from '@/lib/queries/scope';
import { ComingSoonView } from '@/components/dashboard/ComingSoonView';
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

export const dynamic = 'force-dynamic';

const STAGE_DNP = 'AI Bot Reached - DNP';
const STAGE_HOT = 'AI Bot Qualified - High Intent';
const STAGE_WARM = 'AI Bot Qualified - Warm';
const STAGE_CB_LATER = 'AI Bot Reached - CB Later';
const STAGE_NOT_INTERESTED = 'AI Bot Called - Not Interested';
const STAGE_NOT_ELIGIBLE = 'AI Bot Called - Not Eligible';
const ENGAGED_STAGES = new Set([
  STAGE_HOT, STAGE_WARM, STAGE_CB_LATER, STAGE_NOT_INTERESTED, STAGE_NOT_ELIGIBLE
]);

function deriveFunnelFromDispositions(rows: { stage: string; count: number }[]) {
  const get = (s: string) => rows.find((r) => r.stage === s)?.count ?? 0;
  const total = rows.reduce((acc, r) => acc + r.count, 0);
  const dnp = get(STAGE_DNP);
  const hot = get(STAGE_HOT);
  const warm = get(STAGE_WARM);
  const engaged = rows.reduce(
    (acc, r) => acc + (ENGAGED_STAGES.has(r.stage) ? r.count : 0),
    0
  );
  return {
    total_leads: total,
    attempted: total,
    connected: total - dnp,
    engaged,
    qualified: hot + warm,
    hot,
    warm,
    callback_pending: get(STAGE_CB_LATER)
  };
}

export default async function DashboardOverviewPage({ searchParams }: PageProps) {
  const rawParams = await searchParams;
  const dispRange = decodeDateRange(rawParams, 'd');
  const dateActive = hasDateRange(dispRange);

  const user = (await getCurrentUser())!;
  const picked = typeof rawParams.c === 'string' ? rawParams.c : undefined;
  const campaigns = resolveCampaignFilter(user, picked);
  const scopeArgs = { campaigns, scope: user.sourceScope };
  // No source/UTM filter on Overview — but apply digital_partner scope here
  // by passing it via scope.scope.
  const filtersForOverview = resolveSourceFilter(user, undefined);

  const sb = await createSupabaseServerClient();

  // Resolve campaign options first so we can short-circuit on coming-soon picks
  // before kicking off the heavier data queries.
  const campaignOptions = await listAllowedCampaigns(sb, scopeArgs);
  const comingSoon = getComingSoonCampaign(user, picked, campaignOptions);
  if (comingSoon) {
    const contextLabel =
      user.role === 'digital_partner'
        ? `${user.displayName ?? 'Digital Partner'} · Scoped View`
        : 'UGSOT · Client View';
    return (
      <>
        <Header
          email={user.email ?? ''}
          role={user.role}
          displayName={user.displayName}
          context={contextLabel}
          title="Overview"
          subtitle="Campaign performance at a glance."
          toolbar={<RefreshButton />}
          campaignOptions={campaignOptions}
          currentCampaign={picked ?? null}
          allowAggregate={false}
        />
        <ComingSoonView campaignDisplayName={comingSoon.display_name} />
      </>
    );
  }

  const showMinutesCards = user.role !== 'digital_partner';

  const [funnelAllTime, dispositions, minutes, minutesByCampaign, states, avgCall, objections, depth] =
    await Promise.all([
      getClientFunnel(sb, scopeArgs, filtersForOverview),
      getClientDispositionBreakdown(sb, dispRange, scopeArgs, filtersForOverview),
      showMinutesCards ? getClientMinutesSummary(sb, scopeArgs) : Promise.resolve(null),
      showMinutesCards
        ? getClientMinutesByCampaignCycle(sb, scopeArgs)
        : Promise.resolve([]),
      getClientStatePerformance(sb, scopeArgs),
      getClientAvgCallDuration(sb, scopeArgs),
      getClientTopObjections(sb, scopeArgs, 10),
      getClientConversationDepth(sb, scopeArgs)
    ]);

  const funnel = dateActive ? deriveFunnelFromDispositions(dispositions) : funnelAllTime;

  const preserveQuery = (() => {
    const p = encodeDateRange(dispRange, 'd');
    if (picked) p.set('c', picked);
    return p.toString() || undefined;
  })();

  const dispSubtitle = dateActive
    ? `Filtered: ${dispRange.from ? formatDate(new Date(dispRange.from), 'd MMM') : '…'} – ${dispRange.to ? formatDate(new Date(dispRange.to), 'd MMM yyyy') : '…'} (by last call)`
    : 'Where every lead ends up. Click a stage to drill in.';
  const funnelSubtitle = dateActive
    ? `Attempted → Connected → Engaged → Qualified · ${dispSubtitle.replace(/^Filtered: /, '')}`
    : 'Attempted → Connected → Engaged → Qualified (Hot + Warm)';

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

  const stateRows = states.map((s) => ({
    label: s.state,
    total: s.total_leads,
    connected: s.connected,
    hot: s.hot,
    warm: s.warm,
    qualPct: Number(s.qualification_rate_pct ?? 0)
  }));

  const contextLabel =
    user.role === 'super_admin'
      ? 'Predixion · Strategic View'
      : user.role === 'admin'
      ? 'Predixion · Operations View'
      : user.role === 'digital_partner'
      ? `${user.displayName ?? 'Digital Partner'} · Scoped View`
      : 'UGSOT · Client View';

  return (
    <>
      <Header
        email={user.email ?? ''}
        role={user.role}
        displayName={user.displayName}
        context={contextLabel}
        title="Overview"
        subtitle="Campaign performance at a glance."
        toolbar={<RefreshButton />}
        campaignOptions={campaignOptions}
        currentCampaign={picked ?? null}
        allowAggregate={user.role === 'super_admin'}
      />

      <div className="space-y-6 p-6">
        <MetricCardGrid cols={showMinutesCards ? 5 : 4}>
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
          {showMinutesCards && (
            <MetricCard
              title="Voice Minutes (Cycle)"
              value={`${minutes?.minutes_used ?? 0}`}
              subtitle={
                <div className="space-y-1">
                  <div>
                    {minutes?.billing_cycle_start && minutes?.billing_cycle_end
                      ? `${formatPct(minutes.utilization_pct)} of ${minutes.allocated_minutes ?? 0} · ${formatDate(new Date(minutes.billing_cycle_start), 'd MMM')} – ${formatDate(new Date(new Date(minutes.billing_cycle_end).getTime() - 86_400_000), 'd MMM')}`
                      : `${formatPct(minutes?.utilization_pct)} of ${minutes?.allocated_minutes ?? 0}`}
                  </div>
                  {minutesByCampaign.length > 1 && (
                    <ul className="space-y-0.5 border-t border-border/40 pt-1">
                      {minutesByCampaign.slice(0, 4).map((r) => (
                        <li key={r.campaign_id} className="flex justify-between gap-2">
                          <span className="truncate">{r.display_name}</span>
                          <span className="font-mono tabular-nums">
                            {r.minutes_used.toLocaleString('en-IN')}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              }
              threshold={minutesUtilSeverity}
              invert
              icon={Clock}
              help="Voice-minute usage for the current billing cycle — 8th of each month to the 7th of the next (resets every 8th). When you can see more than one campaign, the breakup lists each campaign's minutes for the cycle. Allocation per WO-DOT-UGSOT-053."
            />
          )}
        </MetricCardGrid>

        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard
            title="Lead Funnel"
            subtitle={funnelSubtitle}
            toolbar={<DateRangeFilter currentRange={dispRange} paramPrefix="d" />}
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
                preserveQuery={preserveQuery}
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
            <div className="h-full bg-amber-500" style={{ width: `${(o.count / max) * 100}%` }} />
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
