// Per-stage drill-in. Lists every lead in the selected disposition stage; each
// row expands inline to show that lead's call summaries (lazy-fetched).
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/getUser';
import { getClientLeadsByStage } from '@/lib/queries/client';
import { stageFromSlug, stageMeta } from '@/lib/lead-stages';
import { Header } from '@/components/layout/Header';
import { RefreshButton } from '@/components/layout/RefreshButton';
import { StageLeadsTable } from './stage-leads-table';

type PageProps = { params: Promise<{ stage: string }> };

export default async function DispositionStagePage({ params }: PageProps) {
  const { stage: slug } = await params;
  const stage = stageFromSlug(slug);
  if (!stage) notFound();

  const user = (await getCurrentUser())!;
  const sb = await createSupabaseServerClient();
  const leads = await getClientLeadsByStage(sb, stage);
  const meta = stageMeta(stage);

  return (
    <>
      <Header
        email={user.email ?? ''}
        role={user.role}
        displayName={user.displayName}
        context="UGSOT · Client View · Dispositions"
        title={meta.label}
        subtitle={meta.description}
        toolbar={<RefreshButton />}
      />

      <div className="space-y-4 p-6">
        <div className="flex items-center gap-2 text-sm">
          <Link
            href="/dashboard/dispositions"
            className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" /> All dispositions
          </Link>
          <span className="text-muted-foreground">·</span>
          <span className="font-numeric tabular-nums">
            {leads.length.toLocaleString('en-IN')} lead{leads.length === 1 ? '' : 's'}
          </span>
        </div>

        <StageLeadsTable leads={leads} stage={stage} />
      </div>
    </>
  );
}
