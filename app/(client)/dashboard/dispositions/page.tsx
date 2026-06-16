// Client Dispositions (SPEC.md §8.1.3).
// CHANGED: removed Qualified-Leads-Trend; dispositions are now the primary
// content with drill-in to per-stage lead lists.
// CHANGED 2026-05-28: added date filter (last_called_at-based) using the same
// DateRangeFilter pattern as the Overview disposition card.
import { format as formatDate } from 'date-fns';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/getUser';
import { getClientDispositionBreakdown, listAllowedCampaigns } from '@/lib/queries/client';
import { resolveCampaignFilter, resolveSourceFilter } from '@/lib/queries/scope';
import { decodeDateRange, encodeDateRange, hasDateRange } from '@/lib/url-filters';
import { Header } from '@/components/layout/Header';
import { RefreshButton } from '@/components/layout/RefreshButton';
import { ChartCard } from '@/components/charts/ChartCard';
import { DispositionDonut } from '@/components/charts/DispositionDonut';
import { StageBreakdownGrid } from '@/components/dashboard/StageBreakdownGrid';
import { DateRangeFilter } from '@/components/dashboard/DateRangeFilter';

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = 'force-dynamic';

export default async function DispositionsPage({ searchParams }: PageProps) {
  const rawParams = await searchParams;
  const range = decodeDateRange(rawParams, 'd');

  const user = (await getCurrentUser())!;
  const picked = typeof rawParams.c === 'string' ? rawParams.c : undefined;
  const campaigns = resolveCampaignFilter(user, picked);
  const scopeArgs = { campaigns, scope: user.sourceScope };
  const filters = resolveSourceFilter(user, undefined);

  const sb = await createSupabaseServerClient();
  const [dispositions, campaignOptions] = await Promise.all([
    getClientDispositionBreakdown(sb, range, scopeArgs, filters),
    listAllowedCampaigns(sb, scopeArgs)
  ]);
  const donutShape = dispositions.map((d) => ({ lead_stage: d.stage, lead_count: d.count }));

  const subtitle = hasDateRange(range)
    ? `Filtered: ${range.from ? formatDate(new Date(range.from), 'd MMM') : '…'} – ${range.to ? formatDate(new Date(range.to), 'd MMM yyyy') : '…'} · by last call`
    : 'Where every lead ends up. Click a stage to view the leads and their call summaries.';

  const preserveQuery = (() => {
    const p = encodeDateRange(range, 'd');
    if (picked) p.set('c', picked);
    return p.toString() || undefined;
  })();

  return (
    <>
      <Header
        email={user.email ?? ''}
        role={user.role}
        displayName={user.displayName}
        context="UGSOT · Client View"
        title="Dispositions"
        subtitle={subtitle}
        toolbar={
          <div className="flex items-center gap-2">
            <DateRangeFilter currentRange={range} paramPrefix="d" />
            <RefreshButton />
          </div>
        }
        campaignOptions={campaignOptions}
        currentCampaign={picked ?? null}
        allowAggregate={user.role === 'super_admin'}
      />
      <div className="space-y-6 p-6">
        <ChartCard
          title="Disposition Mix"
          subtitle={hasDateRange(range) ? 'Within selected range' : 'All-time'}
          height={320}
        >
          <DispositionDonut data={donutShape} />
        </ChartCard>

        <section>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
            By Stage
          </h2>
          <StageBreakdownGrid
            dispositions={dispositions}
            columns={2}
            preserveQuery={preserveQuery}
          />
        </section>
      </div>
    </>
  );
}
