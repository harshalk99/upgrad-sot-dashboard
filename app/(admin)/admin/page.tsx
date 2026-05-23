// Admin Real-time Health — SPEC.md §8.2.1.
// Dense grid of live counters + alert callouts + activity feed + hourly dispatch bar.
// Auto-refresh every 30s via the client AutoRefresh island that calls router.refresh().
//
// `dynamic = 'force-dynamic'` opts out of full route caching so each refresh
// hits the DB. Individual queries are still parallelised via Promise.all.
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  Clock,
  Flag,
  PhoneOutgoing,
  Radio,
  Wrench
} from 'lucide-react';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/getUser';
import {
  getAdminPipelineNow,
  getHourlyDispatch,
  getRecentActivity
} from '@/lib/queries/admin';
import { Header } from '@/components/layout/Header';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { MetricCardGrid } from '@/components/dashboard/MetricCardGrid';
import { ChartCard } from '@/components/charts/ChartCard';
import { AutoRefresh } from '@/components/admin/AutoRefresh';
import { HourlyDispatchBar } from '@/components/admin/HourlyDispatchBar';
import { LiveActivityFeed } from '@/components/admin/LiveActivityFeed';

export const dynamic = 'force-dynamic';

export default async function AdminHealthPage() {
  const user = (await getCurrentUser())!;
  const sb = await createSupabaseServerClient();

  const [pipeline, hourly, activity] = await Promise.all([
    getAdminPipelineNow(sb),
    getHourlyDispatch(sb),
    getRecentActivity(sb, 20)
  ]);

  // Compute alerts deterministically (matches MetricCard threshold logic).
  const alerts: { severity: 'warn' | 'critical'; message: string }[] = [];
  if (pipeline.stuck_pending >= 50)
    alerts.push({
      severity: 'critical',
      message: `${pipeline.stuck_pending} calls stuck in pending state (>5m old). Check 11Labs webhook health.`
    });
  else if (pipeline.stuck_pending >= 25)
    alerts.push({
      severity: 'warn',
      message: `${pipeline.stuck_pending} calls stuck in pending state. Monitor for retry.`
    });

  if (pipeline.stale_unpushed >= 20)
    alerts.push({
      severity: 'critical',
      message: `${pipeline.stale_unpushed} leads have unpushed CRM updates older than 30 minutes. LS sync may be down.`
    });
  else if (pipeline.stale_unpushed >= 10)
    alerts.push({
      severity: 'warn',
      message: `${pipeline.stale_unpushed} leads waiting on CRM push for >30 minutes.`
    });

  if (pipeline.malfunctions_24h >= 10)
    alerts.push({
      severity: 'critical',
      message: `${pipeline.malfunctions_24h} agent malfunctions in last 24h. Review Quality & QA.`
    });
  else if (pipeline.malfunctions_24h >= 3)
    alerts.push({
      severity: 'warn',
      message: `${pipeline.malfunctions_24h} agent malfunctions in last 24h.`
    });

  return (
    <>
      <Header
        email={user.email ?? ''}
        role={user.role}
        displayName={user.displayName}
        context="Predixion · Operations"
        title="Real-time Health"
        subtitle="Pipeline status, refreshing every 30 seconds."
        toolbar={<AutoRefresh intervalMs={30_000} />}
      />

      <div className="space-y-6 p-6">
        {alerts.length > 0 && (
          <div className="space-y-2">
            {alerts.map((a, i) => (
              <div
                key={i}
                className={
                  'flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ' +
                  (a.severity === 'critical'
                    ? 'border-red-500/50 bg-red-50 text-red-900 dark:border-red-500/40 dark:bg-red-950/40 dark:text-red-200'
                    : 'border-amber-500/50 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-200')
                }
              >
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <span>{a.message}</span>
              </div>
            ))}
          </div>
        )}

        <MetricCardGrid cols={4}>
          <MetricCard title="Calls In Flight" value={pipeline.in_flight} icon={Radio} />
          <MetricCard
            title="Queue Due Now"
            value={pipeline.due_now}
            icon={PhoneOutgoing}
          />
          <MetricCard
            title="Stuck Pending"
            value={pipeline.stuck_pending}
            threshold={{ warn: 25, critical: 50 }}
            invert
            icon={AlertOctagon}
          />
          <MetricCard
            title="Scheduled Future"
            value={pipeline.scheduled_future}
            icon={Clock}
          />
          <MetricCard
            title="Awaiting CRM Push"
            value={pipeline.awaiting_push}
            icon={Activity}
          />
          <MetricCard
            title="Stale Unpushed (>30m)"
            value={pipeline.stale_unpushed}
            threshold={{ warn: 10, critical: 20 }}
            invert
            icon={AlertTriangle}
          />
          <MetricCard
            title="Flagged Calls (24h)"
            value={pipeline.flagged_24h}
            icon={Flag}
            href="/admin/quality-qa"
          />
          <MetricCard
            title="Malfunctions (24h)"
            value={pipeline.malfunctions_24h}
            threshold={{ warn: 3, critical: 10 }}
            invert
            icon={Wrench}
            href="/admin/quality-qa"
          />
        </MetricCardGrid>

        <div className="grid gap-4 lg:grid-cols-[2fr_3fr]">
          <ChartCard
            title="Live Activity"
            subtitle="Last 20 events across calls and LS sync"
            height={420}
          >
            <div className="h-full overflow-y-auto pr-1">
              <LiveActivityFeed events={activity} />
            </div>
          </ChartCard>

          <ChartCard
            title="Hourly Dispatch Volume"
            subtitle="Calls dispatched to the voice agent, hour by hour"
            height={420}
          >
            <HourlyDispatchBar data={hourly} />
          </ChartCard>
        </div>
      </div>
    </>
  );
}
