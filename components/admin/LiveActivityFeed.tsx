// LiveActivityFeed — last N events from call_logs + ls_sync_log, interleaved by time.
// Server-rendered; the 30s tick on the parent page refreshes it.
//
// SPEC.md §8.2.1 — "LiveActivityFeed (last 20 events)".

import Link from 'next/link';
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Flag,
  PhoneCall,
  XCircle
} from 'lucide-react';
import { formatRelative, formatDuration } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { ActivityEvent } from '@/lib/queries/admin';

export function LiveActivityFeed({ events }: { events: ActivityEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-xs text-muted-foreground">
        No recent activity.
      </div>
    );
  }
  return (
    <ol className="divide-y divide-border/40">
      {events.map((e, i) => (
        <li key={i} className="py-2.5">
          {e.kind === 'call' ? <CallRow e={e} /> : <SyncRow e={e} />}
        </li>
      ))}
    </ol>
  );
}

function CallRow({ e }: { e: Extract<ActivityEvent, { kind: 'call' }> }) {
  const status = (e.call_status ?? '').toLowerCase();
  const ok = !e.flagged && !e.malfunction;
  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-start gap-3 text-xs">
      <span
        className={cn(
          'mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full',
          e.flagged
            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
            : e.malfunction
            ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
            : 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300'
        )}
      >
        {e.flagged ? (
          <Flag className="size-3" />
        ) : e.malfunction ? (
          <AlertTriangle className="size-3" />
        ) : (
          <PhoneCall className="size-3" />
        )}
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{e.lead_name ?? 'Unknown'}</span>
          <span className="font-mono text-[10px] text-muted-foreground">{e.phone ?? ''}</span>
        </div>
        <div className="text-[10px] text-muted-foreground">
          {status ? `${status} · ` : ''}
          {formatDuration(e.duration_seconds)} · {formatRelative(e.ts)}
        </div>
      </div>
      <Link
        href={`/admin/call-logs/${encodeURIComponent(e.call_id)}`}
        className="inline-flex shrink-0 items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        Open <ArrowUpRight className="size-3" />
      </Link>
    </div>
  );
}

function SyncRow({ e }: { e: Extract<ActivityEvent, { kind: 'ls_sync' }> }) {
  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-start gap-3 text-xs">
      <span
        className={cn(
          'mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full',
          e.success
            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
            : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
        )}
      >
        {e.success ? <CheckCircle2 className="size-3" /> : <XCircle className="size-3" />}
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium">LS · {e.action}</span>
          {e.ls_prospect_id && (
            <span className="font-mono text-[10px] text-muted-foreground">
              {e.ls_prospect_id.slice(0, 8)}…
            </span>
          )}
        </div>
        <div className="text-[10px] text-muted-foreground">
          {e.response_status ? `HTTP ${e.response_status} · ` : ''}
          {e.error_message ? `${e.error_message.slice(0, 80)} · ` : ''}
          {formatRelative(e.ts)}
        </div>
      </div>
      <span className="text-[10px] text-muted-foreground">{e.success ? 'OK' : 'FAIL'}</span>
    </div>
  );
}
