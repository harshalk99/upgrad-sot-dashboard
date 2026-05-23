// Client Hot & Warm Leads (SPEC.md §8.1.4).
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/getUser';
import { getClientHotWarmLeads } from '@/lib/queries/client';
import { Header } from '@/components/layout/Header';
import { RefreshButton } from '@/components/layout/RefreshButton';
import { LeadsTable } from '@/components/tables/LeadsTable';

export default async function HotWarmLeadsPage() {
  const user = (await getCurrentUser())!;
  const sb = await createSupabaseServerClient();
  const leads = await getClientHotWarmLeads(sb);

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
      />
      <div className="p-6">
        <LeadsTable data={leads} />
      </div>
    </>
  );
}
