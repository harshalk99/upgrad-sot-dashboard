// Admin Call Logs — SPEC.md §8.2.2.
// Server-side filtering & pagination via URL search params. Each render is a
// fresh DB query; this keeps RSC simple and lets users bookmark filter combos.
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/getUser';
import { getCallLogsList, type CallLogListFilters } from '@/lib/queries/admin';
import { Header } from '@/components/layout/Header';
import { RefreshButton } from '@/components/layout/RefreshButton';
import { CallLogsTable } from './call-logs-table';

export const dynamic = 'force-dynamic';

type SP = {
  q?: string;
  from?: string;
  to?: string;
  status?: string;
  classification?: string;
  stage?: string;
  flagged?: string;
  malfunction?: string;
  recording?: string;
  page?: string;
};

const PAGE_SIZE = 50;

function asBoolFilter(s: string | undefined): boolean | undefined {
  if (s === 'yes' || s === 'true') return true;
  if (s === 'no' || s === 'false') return false;
  return undefined;
}

export default async function CallLogsPage({
  searchParams
}: {
  // Next 16: searchParams is async.
  searchParams: Promise<SP>;
}) {
  const user = (await getCurrentUser())!;
  const sp = await searchParams;
  const sb = await createSupabaseServerClient();

  const page = Math.max(0, Number(sp.page ?? '0') | 0);
  const filters: CallLogListFilters = {
    search: sp.q?.trim() || undefined,
    dateFrom: sp.from || undefined,
    dateTo: sp.to || undefined,
    callStatus: sp.status || undefined,
    classification: sp.classification || undefined,
    leadStage: sp.stage || undefined,
    flagged: asBoolFilter(sp.flagged),
    malfunction: asBoolFilter(sp.malfunction),
    hasRecording: asBoolFilter(sp.recording)
  };

  const { rows, total } = await getCallLogsList(sb, filters, page, PAGE_SIZE);

  return (
    <>
      <Header
        email={user.email ?? ''}
        role={user.role}
        displayName={user.displayName}
        context="Predixion · Operations"
        title="Call Logs"
        subtitle={`${total.toLocaleString('en-IN')} calls · filter, search, drill into any conversation.`}
        toolbar={<RefreshButton />}
      />

      <div className="p-6">
        <CallLogsTable
          rows={rows}
          total={total}
          page={page}
          pageSize={PAGE_SIZE}
          filters={{
            q: sp.q ?? '',
            from: sp.from ?? '',
            to: sp.to ?? '',
            status: sp.status ?? '',
            classification: sp.classification ?? '',
            stage: sp.stage ?? '',
            flagged: sp.flagged ?? '',
            malfunction: sp.malfunction ?? '',
            recording: sp.recording ?? ''
          }}
        />
      </div>
    </>
  );
}
