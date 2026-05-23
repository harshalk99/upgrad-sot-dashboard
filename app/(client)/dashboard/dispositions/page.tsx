// Client Dispositions (SPEC.md §8.1.3).
// CHANGED (post-Phase-3 by user request): removed Qualified-Leads-Trend line chart;
// dispositions are now the primary content with drill-in to per-stage lead lists.
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/getUser';
import { getClientDispositionBreakdown } from '@/lib/queries/client';
import { Header } from '@/components/layout/Header';
import { RefreshButton } from '@/components/layout/RefreshButton';
import { ChartCard } from '@/components/charts/ChartCard';
import { DispositionDonut } from '@/components/charts/DispositionDonut';
import { StageBreakdownGrid } from '@/components/dashboard/StageBreakdownGrid';

export default async function DispositionsPage() {
  const user = (await getCurrentUser())!;
  const sb = await createSupabaseServerClient();
  const dispositions = await getClientDispositionBreakdown(sb);
  const donutShape = dispositions.map((d) => ({ lead_stage: d.stage, lead_count: d.count }));

  return (
    <>
      <Header
        email={user.email ?? ''}
        role={user.role}
        displayName={user.displayName}
        context="UGSOT · Client View"
        title="Dispositions"
        subtitle="Where every lead ends up. Click a stage to view the leads and their call summaries."
        toolbar={<RefreshButton />}
      />
      <div className="space-y-6 p-6">
        <ChartCard title="Disposition Mix" subtitle="All-time, all campaigns" height={320}>
          <DispositionDonut data={donutShape} />
        </ChartCard>

        <section>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
            By Stage
          </h2>
          <StageBreakdownGrid dispositions={dispositions} columns={2} />
        </section>
      </div>
    </>
  );
}
