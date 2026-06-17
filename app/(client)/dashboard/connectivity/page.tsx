// Client Connectivity (SPEC.md §8.1.2).
// REVISED: 3-step funnel — Attempted → Connected → Qualified.
// "Connected" = AI classified the call (real conversation happened).
// "Qualified" = HOT + WARM + CB Later stages.
// No attempt counts, no call durations exposed to client.
//
// 2026-05-23: Added URL-syncing filter bar (11 lead/UTM dimensions). The filter
// state lives in searchParams; all 3 data fetches accept the same ConnectivityFilters.
import { Users, PhoneCall, Star } from 'lucide-react';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/getUser';
import {
  getClientConnectivityDaily,
  getClientConnectivityFilterOptions,
  getClientEngagementBySource,
  getClientEngagementFunnel,
  listAllowedCampaigns,
  type ConnectivityFilters
} from '@/lib/queries/client';
import { getComingSoonCampaign, resolveCampaignFilter, resolveSourceFilter } from '@/lib/queries/scope';
import { ComingSoonView } from '@/components/dashboard/ComingSoonView';
import {
  CONNECTIVITY_SHORT_TO_FULL,
  decodeFiltersFromSearchParams
} from '@/lib/url-filters';
import { Header } from '@/components/layout/Header';
import { RefreshButton } from '@/components/layout/RefreshButton';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { MetricCardGrid } from '@/components/dashboard/MetricCardGrid';
import { ConnectivityFilterBar } from '@/components/dashboard/ConnectivityFilterBar';
import { ChartCard } from '@/components/charts/ChartCard';
import { ConnectivityTrendLine } from '@/components/charts/ConnectivityTrendLine';
import { EngagementFunnelChart } from '@/components/charts/EngagementFunnelChart';
import { PerformanceTable } from '@/components/dashboard/PerformanceTable';

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// Opt out of route caching so search-param changes always re-render with fresh data.
// (Defensive — Next 16 should already treat searchParams as dynamic input.)
export const dynamic = 'force-dynamic';

export default async function ConnectivityPage({ searchParams }: PageProps) {
  // Next 16: searchParams is async.
  const rawParams = await searchParams;
  const urlFilters = decodeFiltersFromSearchParams(
    rawParams,
    CONNECTIVITY_SHORT_TO_FULL
  ) as ConnectivityFilters;

  const user = (await getCurrentUser())!;
  const picked = typeof rawParams.c === 'string' ? rawParams.c : undefined;
  const campaigns = resolveCampaignFilter(user, picked);
  const scopeArgs = { campaigns, scope: user.sourceScope };
  // Intersect URL-applied source filter with the user's fixed scope.
  const filters = resolveSourceFilter(user, urlFilters);

  const sb = await createSupabaseServerClient();

  const campaignOptions = await listAllowedCampaigns(sb, scopeArgs);
  const comingSoon = getComingSoonCampaign(user, picked, campaignOptions);
  if (comingSoon) {
    return (
      <>
        <Header
          email={user.email ?? ''}
          role={user.role}
          displayName={user.displayName}
          context="UGSOT · Client View"
          title="Connectivity"
          subtitle=""
          toolbar={<RefreshButton />}
          campaignOptions={campaignOptions}
          currentCampaign={picked ?? null}
          allowAggregate={false}
        />
        <ComingSoonView campaignDisplayName={comingSoon.display_name} />
      </>
    );
  }

  const [funnel, sources, daily, options] = await Promise.all([
    getClientEngagementFunnel(sb, scopeArgs, filters),
    getClientEngagementBySource(sb, scopeArgs, filters),
    getClientConnectivityDaily(sb, scopeArgs, filters),
    getClientConnectivityFilterOptions(sb, scopeArgs)
  ]);

  const connectRate =
    funnel.attempted > 0 ? Math.round((100 * funnel.connected) / funnel.attempted) : 0;
  const qualRate =
    funnel.attempted > 0 ? Math.round((100 * funnel.qualified) / funnel.attempted) : 0;
  const qualOfConnected =
    funnel.connected > 0 ? Math.round((100 * funnel.qualified) / funnel.connected) : 0;

  // Reshape engagement-by-source for PerformanceTable.
  const sourceRows = sources
    .filter((s) => s.total_leads >= 10) // hide low-volume noise
    .map((s) => ({
      label: s.source,
      total: s.total_leads,
      connected: s.connected,
      hot: s.engaged,
      warm: 0,
      qualPct: s.engagement_rate_pct,
      connectPct:
        s.attempted > 0 ? Math.round((1000 * s.connected) / s.attempted) / 10 : 0
    }));

  return (
    <>
      <Header
        email={user.email ?? ''}
        role={user.role}
        displayName={user.displayName}
        context="UGSOT · Client View"
        title="Connectivity"
        subtitle="How many customers we reached and meaningfully connected with."
        toolbar={<RefreshButton />}
        campaignOptions={campaignOptions}
        currentCampaign={picked ?? null}
        allowAggregate={user.role === 'super_admin'}
      />
      <div className="space-y-6 p-6">
        <ConnectivityFilterBar options={options} currentFilters={filters} />

        <MetricCardGrid cols={3}>
          <MetricCard
            title="Customers Attempted"
            value={funnel.attempted}
            subtitle="Unique leads dialed at least once"
            icon={Users}
          />
          <MetricCard
            title="Customers Connected"
            value={funnel.connected}
            subtitle={`${connectRate}% of attempted had a real conversation`}
            icon={PhoneCall}
          />
          <MetricCard
            title="Engaged Leads"
            value={funnel.qualified}
            subtitle={`${qualRate}% of attempted · ${qualOfConnected}% of connected`}
            icon={Star}
            help="Customers who showed genuine intent — Hot + Warm + Callback Later combined."
          />
        </MetricCardGrid>

        <ChartCard
          title="Engagement Funnel"
          subtitle="Attempted → Connected → Engaged · unique customers"
          height={240}
        >
          <EngagementFunnelChart {...funnel} />
        </ChartCard>

        <ChartCard
          title="Daily Connectivity Trend"
          subtitle={
            <>
              Last 30 days · unique leads attempted, connected, engaged + daily connect %
              <span className="ml-1 text-muted-foreground/70">
                · a lead retried multiple times in a day counts once
              </span>
            </>
          }
          height={280}
        >
          <ConnectivityTrendLine data={daily} />
        </ChartCard>

        <ChartCard
          title="Engagement Quality by Source"
          subtitle="Which channels deliver real conversations. Sources with fewer than 10 leads hidden."
          height="auto"
        >
          <PerformanceTable
            rows={sourceRows.map((r) => ({
              label: r.label,
              total: r.total,
              connected: r.connected,
              hot: r.hot,
              warm: 0,
              qualPct: r.qualPct,
              connectPct: r.connectPct
            }))}
            limit={8}
            showConnectRate
            labels={{
              segment: 'Source',
              leads: 'Leads',
              connected: 'Connected',
              hot: 'Engaged',
              warm: '',
              qualRate: 'Engagement rate',
              connectRate: 'Connect rate'
            }}
          />
        </ChartCard>
      </div>
    </>
  );
}
