// Client Reports (SPEC.md §8.1.6).
// Phase 3 ships a basic "export hot/warm leads + funnel summary" set.
// PDF reports + report history table are scheduled for Phase 8 polish.
import { FileSpreadsheet } from 'lucide-react';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/getUser';
import {
  getClientDispositionBreakdown,
  getClientFunnel,
  getClientHotWarmLeads,
  listAllowedCampaigns
} from '@/lib/queries/client';
import { getComingSoonCampaign, resolveCampaignFilter } from '@/lib/queries/scope';
import { ComingSoonView } from '@/components/dashboard/ComingSoonView';
import { Header } from '@/components/layout/Header';
import { RefreshButton } from '@/components/layout/RefreshButton';
import { ReportsActions } from './reports-actions';

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = 'force-dynamic';

export default async function ReportsPage({ searchParams }: PageProps) {
  const rawParams = await searchParams;
  const user = (await getCurrentUser())!;
  const picked = typeof rawParams.c === 'string' ? rawParams.c : undefined;
  const campaigns = resolveCampaignFilter(user, picked);
  const scopeArgs = { campaigns, scope: user.sourceScope };

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
          title="Reports"
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
  const [funnel, dispositionRows, leads] = await Promise.all([
    getClientFunnel(sb, scopeArgs),
    getClientDispositionBreakdown(sb, undefined, scopeArgs),
    getClientHotWarmLeads(sb, scopeArgs)
  ]);
  // Reports component expects {lead_stage, lead_count} shape — adapt.
  const dispositions = dispositionRows.map((d) => ({ lead_stage: d.stage, lead_count: d.count }));

  return (
    <>
      <Header
        email={user.email ?? ''}
        role={user.role}
        displayName={user.displayName}
        context="UGSOT · Client View"
        title="Reports"
        subtitle="Snapshot exports of campaign data. PDF + scheduled reports land in Phase 8."
        toolbar={<RefreshButton />}
        campaignOptions={campaignOptions}
        currentCampaign={picked ?? null}
        allowAggregate={user.role === 'super_admin'}
      />
      <div className="p-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ReportCard
            title="Funnel Summary"
            description="Total → Attempted → Connected → Qualified → Hot+Warm counts as of right now."
            kind="funnel"
            rowCount={1}
          />
          <ReportCard
            title="Disposition Breakdown"
            description="Lead counts grouped by stage. CSV with header row."
            kind="dispositions"
            rowCount={dispositions.length}
          />
          <ReportCard
            title="Hot & Warm Leads (Masked)"
            description="All currently-hot/warm/CB-later leads with masked phone numbers."
            kind="leads"
            rowCount={leads.length}
          />
        </div>

        <ReportsActions funnel={funnel ?? null} dispositions={dispositions} leads={leads} />
      </div>
    </>
  );
}

function ReportCard({
  title,
  description,
  rowCount
}: {
  title: string;
  description: string;
  kind: 'funnel' | 'dispositions' | 'leads';
  rowCount: number;
}) {
  return (
    <div className="rounded-lg border border-border/60 p-4">
      <FileSpreadsheet className="size-5 text-muted-foreground" />
      <h3 className="mt-2 text-sm font-semibold">{title}</h3>
      <p className="text-xs text-muted-foreground">{description}</p>
      <div className="mt-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {rowCount.toLocaleString('en-IN')} row{rowCount === 1 ? '' : 's'}
      </div>
    </div>
  );
}
