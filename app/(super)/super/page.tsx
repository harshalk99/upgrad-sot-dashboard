// Phase 2 stub. Real strategic overview built in Phase 6 (SPEC.md §8.3.1).
import { TrendingUp, Users, Award, Clock } from 'lucide-react';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/getUser';
import { Header } from '@/components/layout/Header';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { MetricCardGrid } from '@/components/dashboard/MetricCardGrid';
import { formatPct } from '@/lib/formatters';

export default async function SuperOverviewPage() {
  const user = (await getCurrentUser())!;
  const supabase = await createSupabaseServerClient();
  const [{ data: campaigns }, { data: minutes }] = await Promise.all([
    supabase.from('v_super_campaign_summary').select('*'),
    supabase.from('v_client_minutes_summary').select('*').maybeSingle()
  ]);

  const totals = (campaigns ?? []).reduce(
    (acc, c) => ({
      total: acc.total + (c.total_leads ?? 0),
      hot: acc.hot + (c.hot ?? 0),
      ugnet: acc.ugnet + (c.ugnet_registrations ?? 0)
    }),
    { total: 0, hot: 0, ugnet: 0 }
  );

  return (
    <>
      <Header
        email={user.email ?? ''}
        role={user.role}
        displayName={user.displayName}
        context="Predixion · Strategic View"
        title="Strategic Overview"
        subtitle="Phase 2 stub — full analytics with trends + date filters land in Phase 6."
      />
      <div className="space-y-6 p-6">
        <MetricCardGrid cols={4}>
          <MetricCard
            title="Total Leads (All Time)"
            value={totals.total}
            icon={Users}
          />
          <MetricCard
            title="High Intent (All Time)"
            value={totals.hot}
            icon={TrendingUp}
          />
          <MetricCard
            title="uGNET Registrations"
            value={totals.ugnet}
            icon={Award}
          />
          <MetricCard
            title="Minutes Used (This Month)"
            value={minutes?.minutes_used ?? 0}
            subtitle={`${formatPct(minutes?.utilization_pct)} of ${minutes?.allocated_minutes ?? 0}`}
            icon={Clock}
          />
        </MetricCardGrid>

        <section className="rounded-lg border border-border/60 bg-card p-4">
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Campaigns
          </h2>
          {(campaigns ?? []).map((c) => (
            <div
              key={c.campaign_id ?? 'unknown'}
              className="mt-3 flex items-baseline justify-between border-t border-border/40 pt-3"
            >
              <div>
                <div className="font-medium">{c.campaign_name ?? c.campaign_id}</div>
                <div className="text-xs text-muted-foreground">
                  {c.total_leads} leads · {c.hot} hot · {c.warm} warm · {c.ugnet_registrations}{' '}
                  uGNET
                </div>
              </div>
              <div className="text-right font-numeric tabular-nums">
                <div className="text-lg">{c.qualification_rate_pct}%</div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  qual rate
                </div>
              </div>
            </div>
          ))}
        </section>
      </div>
    </>
  );
}
