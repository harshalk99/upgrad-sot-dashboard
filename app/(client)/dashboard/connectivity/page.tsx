// Client Connectivity (SPEC.md §8.1.2).
// REVISED: 3-step funnel — Attempted → Connected → Qualified.
// "Connected" = AI classified the call (real conversation happened).
// "Qualified" = HOT + WARM + CB Later stages.
// No attempt counts, no call durations exposed to client.
import { Users, PhoneCall, Star } from 'lucide-react';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/getUser';
import {
  getClientEngagementBySource,
  getClientEngagementFunnel
} from '@/lib/queries/client';
import { Header } from '@/components/layout/Header';
import { RefreshButton } from '@/components/layout/RefreshButton';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { MetricCardGrid } from '@/components/dashboard/MetricCardGrid';
import { ChartCard } from '@/components/charts/ChartCard';
import { EngagementFunnelChart } from '@/components/charts/EngagementFunnelChart';
import { PerformanceTable } from '@/components/dashboard/PerformanceTable';

export default async function ConnectivityPage() {
  const user = (await getCurrentUser())!;
  const sb = await createSupabaseServerClient();

  const [funnel, sources] = await Promise.all([
    getClientEngagementFunnel(sb),
    getClientEngagementBySource(sb)
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
      />
      <div className="space-y-6 p-6">
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
            title="Qualified Leads"
            value={funnel.qualified}
            subtitle={`${qualRate}% of attempted · ${qualOfConnected}% of connected`}
            icon={Star}
          />
        </MetricCardGrid>

        <ChartCard
          title="Engagement Funnel"
          subtitle="Attempted → Connected → Qualified · unique customers"
          height={240}
        >
          <EngagementFunnelChart {...funnel} />
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
              hot: 'Qualified',
              warm: '',
              qualRate: 'Qualification rate',
              connectRate: 'Connect rate'
            }}
          />
        </ChartCard>
      </div>
    </>
  );
}
