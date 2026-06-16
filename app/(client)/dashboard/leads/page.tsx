// Client Hot & Warm Leads (SPEC.md §8.1.4).
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/getUser';
import { getClientHotWarmLeads, listAllowedCampaigns } from '@/lib/queries/client';
import { resolveCampaignFilter } from '@/lib/queries/scope';
import { Header } from '@/components/layout/Header';
import { RefreshButton } from '@/components/layout/RefreshButton';
import { LeadsTable } from '@/components/tables/LeadsTable';

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = 'force-dynamic';

export default async function HotWarmLeadsPage({ searchParams }: PageProps) {
  const rawParams = await searchParams;
  const user = (await getCurrentUser())!;
  const picked = typeof rawParams.c === 'string' ? rawParams.c : undefined;
  const campaigns = resolveCampaignFilter(user, picked);
  const scopeArgs = { campaigns, scope: user.sourceScope };

  const sb = await createSupabaseServerClient();
  const [leads, campaignOptions] = await Promise.all([
    getClientHotWarmLeads(sb, scopeArgs),
    listAllowedCampaigns(sb, scopeArgs)
  ]);

  return (
    <>
      <Header
        email={user.email ?? ''}
        role={user.role}
        displayName={user.displayName}
        context="UGSOT · Client View"
        title="Hot & Warm Leads"
        subtitle={`${leads.length.toLocaleString('en-IN')} hot, warm, and callback-pending leads`}
        toolbar={<RefreshButton />}
        campaignOptions={campaignOptions}
        currentCampaign={picked ?? null}
        allowAggregate={user.role === 'super_admin'}
      />
      <div className="p-6">
        <LeadsTable data={leads} userRole={user.role} />
      </div>
    </>
  );
}
