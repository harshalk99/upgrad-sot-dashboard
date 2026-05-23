// Admin Call Log Detail — SPEC.md §8.2.2.
//
// Left side (main): lead info, call info, recording, transcript, AI extraction.
// Right side: flag/malfunction banners, CallFlagPanel (admin sees read-only),
//             LS sync history for this call.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Flag,
  XCircle
} from 'lucide-react';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/getUser';
import { getCallLogDetail, getCallLogLsHistory } from '@/lib/queries/admin';
import { Header } from '@/components/layout/Header';
import { RefreshButton } from '@/components/layout/RefreshButton';
import { ChartCard } from '@/components/charts/ChartCard';
import { Badge } from '@/components/ui/badge';
import { RecordingPlayer } from '@/components/admin/RecordingPlayer';
import { TranscriptViewer } from '@/components/admin/TranscriptViewer';
import { formatDateTimeIST, formatDuration, formatRelative } from '@/lib/formatters';

export const dynamic = 'force-dynamic';

export default async function CallLogDetailPage({
  params
}: {
  params: Promise<{ call_id: string }>;
}) {
  const { call_id } = await params;
  const user = (await getCurrentUser())!;
  const sb = await createSupabaseServerClient();

  const [detail, lsHistory] = await Promise.all([
    getCallLogDetail(sb, call_id),
    getCallLogLsHistory(sb, call_id)
  ]);

  if (!detail) notFound();

  return (
    <>
      <Header
        email={user.email ?? ''}
        role={user.role}
        displayName={user.displayName}
        context="Predixion · Call Detail"
        title={detail.lead_name ?? 'Unknown lead'}
        subtitle={
          <span className="inline-flex items-center gap-2">
            <Link
              href="/admin/call-logs"
              className="inline-flex items-center gap-1 text-xs hover:underline"
            >
              <ArrowLeft className="size-3" /> Call logs
            </Link>
            <span className="text-muted-foreground">·</span>
            <span className="font-mono text-xs text-muted-foreground">{detail.call_id}</span>
          </span>
        }
        toolbar={<RefreshButton />}
      />

      <div className="space-y-6 p-6">
        {(detail.call_flagged || detail.agent_malfunction) && (
          <div className="space-y-2">
            {detail.call_flagged && (
              <div className="flex items-start gap-3 rounded-lg border border-amber-500/50 bg-amber-50 p-4 dark:border-amber-500/40 dark:bg-amber-950/40">
                <Flag className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-300" />
                <div className="space-y-1 text-sm">
                  <div className="font-medium text-amber-900 dark:text-amber-200">
                    Flagged{detail.flagged_source ? ` · ${detail.flagged_source}` : ''}
                    {detail.flagged_at ? ` · ${formatRelative(detail.flagged_at)}` : ''}
                  </div>
                  {detail.flagged_reason && (
                    <div className="text-xs text-amber-800 dark:text-amber-300">
                      {detail.flagged_reason}
                    </div>
                  )}
                </div>
              </div>
            )}
            {detail.agent_malfunction && (
              <div className="flex items-start gap-3 rounded-lg border border-red-500/50 bg-red-50 p-4 dark:border-red-500/40 dark:bg-red-950/40">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-700 dark:text-red-300" />
                <div className="space-y-1 text-sm">
                  <div className="font-medium text-red-900 dark:text-red-200">
                    Agent malfunction detected
                  </div>
                  {detail.agent_malfunction_details && (
                    <div className="text-xs text-red-800 dark:text-red-300">
                      {detail.agent_malfunction_details}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
          {/* MAIN */}
          <div className="space-y-6 min-w-0">
            <div className="grid gap-4 sm:grid-cols-2">
              <ChartCard title="Lead" height="auto">
                <dl className="space-y-1.5 text-xs">
                  <Row label="Name" value={detail.lead_name} />
                  <Row label="Phone" value={detail.lead_phone} mono />
                  <Row label="LS Prospect" value={detail.ls_prospect_id} mono />
                  <Row label="Campaign" value={detail.campaign_id} mono />
                  <Row label="Stage" value={detail.lead_stage} />
                  <Row label="Attempts" value={detail.total_attempts?.toString() ?? null} />
                  <Row
                    label="Location"
                    value={
                      [detail.caller_city, detail.caller_state].filter(Boolean).join(', ') || null
                    }
                  />
                  <Row label="Language" value={detail.caller_language} />
                </dl>
              </ChartCard>

              <ChartCard title="Call" height="auto">
                <dl className="space-y-1.5 text-xs">
                  <Row label="Started" value={formatDateTimeIST(detail.call_start)} mono />
                  <Row label="Ended" value={formatDateTimeIST(detail.call_end)} mono />
                  <Row label="Duration" value={formatDuration(detail.duration_seconds)} mono />
                  <Row label="Status" value={detail.call_status} />
                  <Row label="End reason" value={detail.call_end_reason ?? null} />
                  <Row label="Extracted status" value={detail.extracted_status} />
                  <Row label="Classification" value={detail.enquiry_classification} />
                  <Row label="Sentiment" value={detail.sentiment ?? null} />
                </dl>
              </ChartCard>
            </div>

            <ChartCard title="Recording" subtitle="Streamed via the admin recording proxy" height="auto">
              <RecordingPlayer callId={detail.call_id} />
            </ChartCard>

            <ChartCard
              title="Transcript"
              subtitle={detail.transcript_summary ? 'Full transcript + AI summary' : 'Full transcript'}
              height="auto"
            >
              <div className="space-y-4">
                {detail.transcript_summary && (
                  <div className="rounded-md border border-border/60 bg-muted/30 p-3">
                    <div className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                      AI summary
                    </div>
                    <p className="break-words text-xs leading-relaxed">{detail.transcript_summary}</p>
                  </div>
                )}
                <TranscriptViewer transcript={detail.transcript} />
              </div>
            </ChartCard>

            <ChartCard
              title="AI extraction"
              subtitle="Structured fields extracted from the conversation"
              height="auto"
            >
              <ExtractionGrid detail={detail} />
            </ChartCard>
          </div>

          {/* RIGHT */}
          <div className="space-y-6 min-w-0">
            <ChartCard title="Flag status" height="auto">
              <div className="space-y-2 text-xs">
                {detail.call_flagged ? (
                  <>
                    <div className="font-medium">This call is flagged.</div>
                    <Row label="Source" value={detail.flagged_source} />
                    <Row label="Reason" value={detail.flagged_reason} />
                    <Row label="At" value={formatDateTimeIST(detail.flagged_at)} mono />
                  </>
                ) : (
                  <div className="text-muted-foreground">
                    Not flagged.
                    {user.role === 'super_admin' ? (
                      <span className="block mt-1 text-[10px]">
                        Use the super-admin flag panel to flag this call (Phase 7).
                      </span>
                    ) : null}
                  </div>
                )}
              </div>
            </ChartCard>

            <ChartCard
              title="LS sync history"
              subtitle={`${lsHistory.length} sync attempt${lsHistory.length === 1 ? '' : 's'} for this call`}
              height="auto"
            >
              {lsHistory.length === 0 ? (
                <div className="text-xs text-muted-foreground">
                  No LS sync attempts recorded for this call.
                </div>
              ) : (
                <ol className="space-y-2">
                  {lsHistory.map((h) => (
                    <li
                      key={h.id}
                      className="rounded-md border border-border/60 bg-background p-2.5 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 font-medium">
                          {h.success ? (
                            <CheckCircle2 className="size-3 text-emerald-600" />
                          ) : (
                            <XCircle className="size-3 text-red-600" />
                          )}
                          {h.action}
                        </span>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {h.response_status ? `HTTP ${h.response_status}` : ''}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>{formatDateTimeIST(h.created_at)}</span>
                        <span>Attempt #{h.attempt_number ?? '—'}</span>
                      </div>
                      {h.error_message && (
                        <p className="mt-1 break-words text-[10px] text-red-700 dark:text-red-300">
                          {h.error_message}
                        </p>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </ChartCard>

            <ChartCard title="Quality flags" height="auto">
              <div className="flex flex-wrap gap-1.5 text-xs">
                <Pill ok={!detail.dnd} label="DND" trueLabel="DND" falseLabel="Not DND" value={detail.dnd} />
                <Pill ok={!detail.disqualified} label="Disqualified" value={detail.disqualified ?? null} />
                <Pill ok={detail.call_success === true} label="Call success" value={detail.call_success ?? null} />
                <Pill ok={detail.interested_lead === true} label="Interested" value={detail.interested_lead ?? null} />
                <Pill ok={detail.payment_concern !== true} label="Payment concern" value={detail.payment_concern ?? null} />
                <Pill ok={detail.retry_required !== true} label="Retry required" value={detail.retry_required ?? null} />
              </div>
            </ChartCard>
          </div>
        </div>
      </div>
    </>
  );
}

function Row({
  label,
  value,
  mono
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="w-24 shrink-0 text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </dt>
      <dd className={mono ? 'font-mono text-[11px] break-all' : 'text-xs break-words'}>
        {value || <span className="text-muted-foreground">—</span>}
      </dd>
    </div>
  );
}

function Pill({
  label,
  value,
  ok,
  trueLabel,
  falseLabel
}: {
  label: string;
  value: boolean | null;
  ok: boolean;
  trueLabel?: string;
  falseLabel?: string;
}) {
  const display = value == null ? '—' : value ? (trueLabel ?? 'Yes') : (falseLabel ?? 'No');
  return (
    <Badge
      variant="secondary"
      className={
        value == null
          ? 'bg-muted text-muted-foreground'
          : ok
          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
          : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200'
      }
    >
      {label}: {display}
    </Badge>
  );
}

// 30+ AI-extracted fields, grouped for readability.
function ExtractionGrid({ detail }: { detail: Awaited<ReturnType<typeof getCallLogDetail>> }) {
  if (!detail) return null;
  const groups: { title: string; fields: [string, unknown][] }[] = [
    {
      title: 'Education',
      fields: [
        ['12th year', detail.caller_twelfth_year ?? null],
        ['12th stream', detail.twelfth_stream ?? null],
        ['JEE status', detail.jee_status ?? null],
        ['College status', detail.caller_college_status ?? null],
        ['Colleges considering', detail.colleges_considering ?? null]
      ]
    },
    {
      title: 'Interest',
      fields: [
        ['Preferred campus', detail.preferred_campus ?? null],
        ['Interested field', detail.interested_field ?? null],
        ['Caller priority', detail.caller_type ?? null],
        ['UGNET registered', detail.ugnet_registered ?? null],
        ['Asked brochure', detail.asked_brochure ?? null],
        ['Asked payment link', detail.asked_payment_link ?? null]
      ]
    },
    {
      title: 'Conversation',
      fields: [
        ['Conversation depth', detail.conversation_depth ?? null],
        ['Duration quality', detail.call_duration_quality ?? null],
        ['Objections raised', detail.objections_raised ?? null],
        ['Disqualification reason', detail.disqualification_reason ?? null]
      ]
    },
    {
      title: 'Callback',
      fields: [
        ['Callback booked', detail.callback_booked ?? null],
        ['Callback at', formatDateTimeIST(detail.callback_datetime ?? null) === '—' ? null : formatDateTimeIST(detail.callback_datetime ?? null)]
      ]
    }
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {groups.map((g) => (
        <div key={g.title}>
          <div className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">
            {g.title}
          </div>
          <dl className="space-y-1.5">
            {g.fields.map(([label, value]) => (
              <div key={label} className="text-xs">
                <dt className="text-[10px] text-muted-foreground">{label}</dt>
                <dd className="break-words">
                  {value == null || value === '' ? (
                    <span className="text-muted-foreground">—</span>
                  ) : typeof value === 'boolean' ? (
                    value ? 'Yes' : 'No'
                  ) : (
                    String(value)
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}
