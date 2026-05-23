// Admin Quality & QA — SPEC.md §8.2.3.
// Flagged calls, malfunctions, DND detections, top objections, wrong-number rate,
// average duration by stage, conversation depth distribution.

import Link from 'next/link';
import { AlertTriangle, Flag, PhoneOff } from 'lucide-react';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/getUser';
import {
  getAvgDurationByStage,
  getConversationDepthDist,
  getDndDetections,
  getFlaggedCalls,
  getMalfunctionCalls,
  getTopObjections,
  getWrongNumberRate
} from '@/lib/queries/admin';
import { Header } from '@/components/layout/Header';
import { RefreshButton } from '@/components/layout/RefreshButton';
import { ChartCard } from '@/components/charts/ChartCard';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { MetricCardGrid } from '@/components/dashboard/MetricCardGrid';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { formatDateTimeIST, formatDuration } from '@/lib/formatters';

export const dynamic = 'force-dynamic';

export default async function QualityQAPage() {
  const user = (await getCurrentUser())!;
  const sb = await createSupabaseServerClient();

  const [flagged, malfunctions, dnd, objections, avgByStage, depthDist, wrongNum] = await Promise.all([
    getFlaggedCalls(sb, 50),
    getMalfunctionCalls(sb, 50),
    getDndDetections(sb, 7, 100),
    getTopObjections(sb, 30),
    getAvgDurationByStage(sb),
    getConversationDepthDist(sb),
    getWrongNumberRate(sb, 30)
  ]);

  return (
    <>
      <Header
        email={user.email ?? ''}
        role={user.role}
        displayName={user.displayName}
        context="Predixion · Operations"
        title="Quality & QA"
        subtitle="Flagged calls, agent malfunctions, DND detections, and conversation quality signals."
        toolbar={<RefreshButton />}
      />

      <div className="space-y-6 p-6">
        <MetricCardGrid cols={4}>
          <MetricCard
            title="Flagged Calls"
            value={flagged.length}
            subtitle="Latest 50 shown below"
            icon={Flag}
            threshold={{ warn: 10, critical: 25 }}
            invert
          />
          <MetricCard
            title="Malfunctions"
            value={malfunctions.length}
            subtitle="Latest 50 shown below"
            icon={AlertTriangle}
            threshold={{ warn: 5, critical: 15 }}
            invert
          />
          <MetricCard
            title="DND Detections (7d)"
            value={dnd.length}
            subtitle="Auto-detected do-not-call signals"
            icon={PhoneOff}
          />
          <MetricCard
            title="Wrong Number Rate (30d)"
            value={`${wrongNum.rate_pct}%`}
            subtitle={`${wrongNum.wrong.toLocaleString('en-IN')} of ${wrongNum.total.toLocaleString('en-IN')} calls`}
            threshold={{ warn: 3, critical: 6 }}
            invert
          />
        </MetricCardGrid>

        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard
            title="Top objections (30d)"
            subtitle="Most-common reasons leads push back"
            height="auto"
          >
            <ObjectionsList objections={objections} />
          </ChartCard>

          <ChartCard
            title="Avg duration by stage"
            subtitle="How long the average call lasts in each lead_stage"
            height="auto"
          >
            <AvgDurationBars rows={avgByStage} />
          </ChartCard>
        </div>

        <ChartCard
          title="Conversation depth distribution"
          subtitle="How thorough conversations tend to be"
          height="auto"
        >
          <DepthBars rows={depthDist} />
        </ChartCard>

        <ChartCard
          title={`Flagged calls (${flagged.length})`}
          subtitle="Latest 50, newest first"
          height="auto"
        >
          <FlaggedTable rows={flagged} />
        </ChartCard>

        <ChartCard
          title={`Agent malfunctions (${malfunctions.length})`}
          subtitle="Latest 50, newest first"
          height="auto"
        >
          <MalfunctionTable rows={malfunctions} />
        </ChartCard>

        <ChartCard
          title={`DND detections (${dnd.length}, last 7 days)`}
          subtitle="Calls where the agent detected a do-not-call signal"
          height="auto"
        >
          <DndTable rows={dnd} />
        </ChartCard>
      </div>
    </>
  );
}

// ─── Pieces ────────────────────────────────────────────────────────────────

function ObjectionsList({ objections }: { objections: { objection: string; count: number }[] }) {
  if (objections.length === 0) {
    return <div className="text-xs text-muted-foreground">No objections logged in the last 30 days.</div>;
  }
  const max = objections[0].count;
  return (
    <ol className="space-y-2">
      {objections.map((o) => (
        <li key={o.objection} className="grid grid-cols-[1fr_auto] items-center gap-2 text-xs">
          <div className="min-w-0 truncate" title={o.objection}>{o.objection}</div>
          <span className="font-mono tabular-nums text-muted-foreground">{o.count}</span>
          <div className="col-span-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-amber-500"
              style={{ width: `${(o.count / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}

function AvgDurationBars({ rows }: { rows: { stage: string; avg_seconds: number; calls: number }[] }) {
  if (rows.length === 0) {
    return <div className="text-xs text-muted-foreground">No data.</div>;
  }
  const max = Math.max(...rows.map((r) => r.avg_seconds), 1);
  return (
    <ol className="space-y-2">
      {rows.map((r) => (
        <li key={r.stage} className="grid grid-cols-[1fr_auto] items-center gap-2 text-xs">
          <div className="min-w-0 truncate" title={r.stage}>{r.stage}</div>
          <span className="font-mono tabular-nums">
            {formatDuration(r.avg_seconds)} · {r.calls.toLocaleString('en-IN')} calls
          </span>
          <div className="col-span-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-sky-500"
              style={{ width: `${(r.avg_seconds / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}

function DepthBars({ rows }: { rows: { depth: string; count: number }[] }) {
  if (rows.length === 0) {
    return <div className="text-xs text-muted-foreground">No depth labels recorded.</div>;
  }
  const total = rows.reduce((s, r) => s + r.count, 0);
  return (
    <div className="space-y-2">
      <div className="flex h-3 overflow-hidden rounded-md">
        {rows.map((r, i) => (
          <div
            key={r.depth}
            className="h-full"
            style={{
              width: `${(r.count / total) * 100}%`,
              backgroundColor:
                ['#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#94a3b8'][i % 6]
            }}
            title={`${r.depth}: ${r.count}`}
          />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {rows.map((r, i) => {
          const pct = total === 0 ? 0 : Math.round((1000 * r.count) / total) / 10;
          return (
            <div key={r.depth} className="flex items-center gap-2 text-xs">
              <span
                className="inline-block size-2 shrink-0 rounded-sm"
                style={{
                  backgroundColor:
                    ['#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#94a3b8'][i % 6]
                }}
              />
              <span className="truncate" title={r.depth}>{r.depth}</span>
              <span className="ml-auto font-mono text-[10px] text-muted-foreground tabular-nums">
                {pct}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

type FlaggedRow = {
  call_id: string;
  call_start: string | null;
  lead_name: string | null;
  lead_phone: string | null;
  call_status: string | null;
  duration_seconds: number | null;
  enquiry_classification: string | null;
  flagged_reason: string | null;
  flagged_source: string | null;
  flagged_at: string | null;
};

function FlaggedTable({ rows }: { rows: FlaggedRow[] }) {
  if (rows.length === 0) {
    return <div className="text-xs text-muted-foreground">No flagged calls.</div>;
  }
  return (
    <div className="overflow-x-auto">
      <Table className="table-fixed w-full min-w-[900px]">
        <TableHeader className="bg-muted/40">
          <TableRow>
            <TableHead className="w-[150px]">Flagged</TableHead>
            <TableHead className="w-[120px]">Lead</TableHead>
            <TableHead className="w-[110px]">Phone</TableHead>
            <TableHead className="w-[70px]">Source</TableHead>
            <TableHead>Reason</TableHead>
            <TableHead className="w-[80px]">Class.</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.call_id}>
              <TableCell className="font-mono text-xs tabular-nums">
                <Link href={`/admin/call-logs/${encodeURIComponent(r.call_id)}`} className="hover:underline">
                  {formatDateTimeIST(r.flagged_at)}
                </Link>
              </TableCell>
              <TableCell className="truncate">{r.lead_name ?? '—'}</TableCell>
              <TableCell className="font-mono text-xs">{r.lead_phone ?? '—'}</TableCell>
              <TableCell className="text-xs">{r.flagged_source ?? '—'}</TableCell>
              <TableCell className="text-xs">
                <span className="block break-words" title={r.flagged_reason ?? ''}>
                  {r.flagged_reason ?? '—'}
                </span>
              </TableCell>
              <TableCell>
                {r.enquiry_classification && (
                  <Badge variant="secondary" className="font-mono text-[10px]">
                    {r.enquiry_classification}
                  </Badge>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

type MalfRow = {
  call_id: string;
  call_start: string | null;
  lead_name: string | null;
  lead_phone: string | null;
  call_status: string | null;
  duration_seconds: number | null;
  enquiry_classification: string | null;
  agent_malfunction_details: string | null;
};

function MalfunctionTable({ rows }: { rows: MalfRow[] }) {
  if (rows.length === 0) {
    return <div className="text-xs text-muted-foreground">No malfunctions detected.</div>;
  }
  return (
    <div className="overflow-x-auto">
      <Table className="table-fixed w-full min-w-[900px]">
        <TableHeader className="bg-muted/40">
          <TableRow>
            <TableHead className="w-[150px]">Started</TableHead>
            <TableHead className="w-[120px]">Lead</TableHead>
            <TableHead className="w-[110px]">Phone</TableHead>
            <TableHead className="w-[70px]">Duration</TableHead>
            <TableHead>Details</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.call_id}>
              <TableCell className="font-mono text-xs tabular-nums">
                <Link href={`/admin/call-logs/${encodeURIComponent(r.call_id)}`} className="hover:underline">
                  {formatDateTimeIST(r.call_start)}
                </Link>
              </TableCell>
              <TableCell className="truncate">{r.lead_name ?? '—'}</TableCell>
              <TableCell className="font-mono text-xs">{r.lead_phone ?? '—'}</TableCell>
              <TableCell className="font-mono text-xs tabular-nums">
                {formatDuration(r.duration_seconds)}
              </TableCell>
              <TableCell className="text-xs">
                <span className="block break-words" title={r.agent_malfunction_details ?? ''}>
                  {r.agent_malfunction_details ?? '—'}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

type DndRow = {
  call_id: string;
  call_start: string | null;
  lead_name: string | null;
  lead_phone: string | null;
  duration_seconds: number | null;
  transcript_summary: string | null;
};

function DndTable({ rows }: { rows: DndRow[] }) {
  if (rows.length === 0) {
    return <div className="text-xs text-muted-foreground">No DND detections in the last 7 days.</div>;
  }
  return (
    <div className="overflow-x-auto">
      <Table className="table-fixed w-full min-w-[900px]">
        <TableHeader className="bg-muted/40">
          <TableRow>
            <TableHead className="w-[150px]">Started</TableHead>
            <TableHead className="w-[120px]">Lead</TableHead>
            <TableHead className="w-[110px]">Phone</TableHead>
            <TableHead className="w-[70px]">Duration</TableHead>
            <TableHead>Why detected</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.call_id}>
              <TableCell className="font-mono text-xs tabular-nums">
                <Link href={`/admin/call-logs/${encodeURIComponent(r.call_id)}`} className="hover:underline">
                  {formatDateTimeIST(r.call_start)}
                </Link>
              </TableCell>
              <TableCell className="truncate">{r.lead_name ?? '—'}</TableCell>
              <TableCell className="font-mono text-xs">{r.lead_phone ?? '—'}</TableCell>
              <TableCell className="font-mono text-xs tabular-nums">
                {formatDuration(r.duration_seconds)}
              </TableCell>
              <TableCell className="text-xs">
                <span className="line-clamp-2 break-words" title={r.transcript_summary ?? ''}>
                  {r.transcript_summary ?? '—'}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
