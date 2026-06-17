// Connected Calls — billing audit list.
//
// Shows every call where the customer picked up (duration_seconds > 0), with
// just the columns the billing team needs to reconcile against an invoice:
// LS Prospect ID, Date, Duration. Optional date range filter; CSV export.
//
// Visible to client + admin + super_admin. Hidden from digital_partner (the
// sidebar filter handles that — `roles` excludes it).

import { format as formatDate } from 'date-fns';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/getUser';
import {
  getClientConnectedCalls,
  getClientConnectedCallsCount,
  listAllowedCampaigns
} from '@/lib/queries/client';
import {
  getComingSoonCampaign,
  resolveCampaignFilter
} from '@/lib/queries/scope';
import { decodeDateRange, hasDateRange } from '@/lib/url-filters';
import { Header } from '@/components/layout/Header';
import { RefreshButton } from '@/components/layout/RefreshButton';
import { DateRangeFilter } from '@/components/dashboard/DateRangeFilter';
import { ComingSoonView } from '@/components/dashboard/ComingSoonView';
import { ConnectedCallsTable } from './connected-calls-table';

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = 'force-dynamic';

export default async function ConnectedCallsPage({ searchParams }: PageProps) {
  const rawParams = await searchParams;
  const user = (await getCurrentUser())!;
  if (user.role === 'digital_partner') redirect('/dashboard');

  const range = decodeDateRange(rawParams, 'd');
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
          context="UGSOT · Billing Audit"
          title="Connected Calls"
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

  const [rows, total] = await Promise.all([
    getClientConnectedCalls(sb, range, scopeArgs, { limit: 50000 }),
    getClientConnectedCallsCount(sb, range, scopeArgs)
  ]);

  const totalDurationSec = rows.reduce((acc, r) => acc + (r.duration_seconds ?? 0), 0);
  const totalMinutes = Math.round((totalDurationSec / 60) * 10) / 10;

  const subtitle = hasDateRange(range)
    ? `${total.toLocaleString('en-IN')} connected calls · ${range.from ? formatDate(new Date(range.from), 'd MMM') : '…'} – ${range.to ? formatDate(new Date(range.to), 'd MMM yyyy') : '…'} · ${totalMinutes.toLocaleString('en-IN')} min`
    : `${total.toLocaleString('en-IN')} connected calls (all-time) · ${totalMinutes.toLocaleString('en-IN')} min`;

  return (
    <>
      <Header
        email={user.email ?? ''}
        role={user.role}
        displayName={user.displayName}
        context="UGSOT · Billing Audit"
        title="Connected Calls"
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
      <div className="p-6">
        <ConnectedCallsTable
          data={rows}
          serverTotal={total}
          renderedCount={rows.length}
        />
      </div>
    </>
  );
}
