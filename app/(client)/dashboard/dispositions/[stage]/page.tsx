// Disposition stage drill-in. Lists leads in the chosen stage, optionally
// filtered by date range (last_called_at). Filter state lives in URL so the
// back-link can preserve it.
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { format as formatDate } from 'date-fns';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/getUser';
import { getClientLeadsByStage, listAllowedCampaigns } from '@/lib/queries/client';
import { resolveCampaignFilter } from '@/lib/queries/scope';
import { stageFromSlug, stageMeta } from '@/lib/lead-stages';
import {
  decodeDateRange,
  encodeDateRange,
  hasDateRange
} from '@/lib/url-filters';
import { Header } from '@/components/layout/Header';
import { RefreshButton } from '@/components/layout/RefreshButton';
import { DateRangeFilter } from '@/components/dashboard/DateRangeFilter';
import { StageLeadsTable } from './stage-leads-table';

type PageProps = {
  params: Promise<{ stage: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = 'force-dynamic';

export default async function DispositionStagePage({ params, searchParams }: PageProps) {
  const [{ stage: slug }, rawParams] = await Promise.all([params, searchParams]);
  const stage = stageFromSlug(slug);
  if (!stage) notFound();

  const range = decodeDateRange(rawParams, 'd');

  const user = (await getCurrentUser())!;
  const picked = typeof rawParams.c === 'string' ? rawParams.c : undefined;
  const campaigns = resolveCampaignFilter(user, picked);
  const scopeArgs = { campaigns, scope: user.sourceScope };

  const sb = await createSupabaseServerClient();
  const [leads, campaignOptions] = await Promise.all([
    getClientLeadsByStage(sb, stage, range, scopeArgs),
    listAllowedCampaigns(sb, scopeArgs)
  ]);
  const meta = stageMeta(stage);

  // Preserve date + campaign on the back-link.
  const backParams = encodeDateRange(range, 'd');
  if (picked) backParams.set('c', picked);
  const backQs = backParams.toString();
  const backHref = backQs ? `/dashboard/dispositions?${backQs}` : '/dashboard/dispositions';

  const subtitle = hasDateRange(range)
    ? `${meta.description} · Filtered: ${range.from ? formatDate(new Date(range.from), 'd MMM') : '…'} – ${range.to ? formatDate(new Date(range.to), 'd MMM yyyy') : '…'}`
    : meta.description;

  return (
    <>
      <Header
        email={user.email ?? ''}
        role={user.role}
        displayName={user.displayName}
        context="UGSOT · Client View · Dispositions"
        title={meta.label}
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

      <div className="space-y-4 p-6">
        <div className="flex items-center gap-2 text-sm">
          <Link
            href={backHref}
            className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" /> All dispositions
          </Link>
          <span className="text-muted-foreground">·</span>
          <span className="font-numeric tabular-nums">
            {leads.length.toLocaleString('en-IN')} lead{leads.length === 1 ? '' : 's'}
          </span>
          {hasDateRange(range) && (
            <span className="text-muted-foreground">in range</span>
          )}
        </div>

        <StageLeadsTable leads={leads} stage={stage} userRole={user.role} />
      </div>
    </>
  );
}
