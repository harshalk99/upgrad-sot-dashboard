// All client-facing queries live here. SPEC.md "Style and conventions":
// "All database queries go through lib/queries/{client,admin,super,mutations}.ts —
//  never inline in pages."
//
// These functions are designed to be called from Server Components.
// Each one accepts an awaited Supabase server client.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

type SB = SupabaseClient<Database>;

export async function getClientFunnel(sb: SB) {
  const { data } = await sb.from('v_client_funnel').select('*').maybeSingle();
  return data;
}

export async function getClientDispositions(sb: SB) {
  const { data } = await sb.from('v_client_dispositions').select('*');
  return data ?? [];
}

export type HotWarmLeadRow = {
  lead_uid: string | null;
  first_name: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  preferred_campus: string | null;
  interested_field: string | null;
  lead_stage: string | null;
  callback_booked: boolean | null;
  callback_datetime: string | null;
  last_called_at: string | null;
  ls_prospect_id: string | null;
  is_archived: boolean;
  last_call_summary: string | null;
};

export async function getClientHotWarmLeads(sb: SB): Promise<HotWarmLeadRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb as any).from('v_client_hot_warm_leads').select('*');
  return (data ?? []) as HotWarmLeadRow[];
}

export async function getClientDailyVolume(sb: SB, lastNDays = 14) {
  const { data } = await sb
    .from('v_client_daily_volume')
    .select('*')
    .order('day', { ascending: false })
    .limit(lastNDays);
  // Return ascending so charts read left-to-right
  return (data ?? []).slice().reverse();
}

export async function getClientConnectivity(sb: SB) {
  const { data } = await sb
    .from('v_client_connectivity')
    .select('*')
    .order('attempt_number', { ascending: true });
  return data ?? [];
}

export async function getClientMinutesSummary(sb: SB) {
  const { data } = await sb.from('v_client_minutes_summary').select('*').maybeSingle();
  return data;
}

/** Top objections raised in conversations over the last N days. Aggregates the
 *  comma-separated `objections_raised` text column. Filters out "none"/"n/a". */
export async function getClientTopObjections(sb: SB, lastNDays = 30, limit = 10) {
  const since = new Date(Date.now() - lastNDays * 24 * 60 * 60 * 1000).toISOString();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb as any)
    .from('upgrad_call_logs')
    .select('objections_raised')
    .not('objections_raised', 'is', null)
    .neq('objections_raised', '')
    .gte('call_start', since);
  const counts = new Map<string, number>();
  for (const row of (data ?? []) as { objections_raised: string | null }[]) {
    if (!row.objections_raised) continue;
    for (const raw of row.objections_raised.split(/[,;]/)) {
      const k = raw.trim();
      if (!k || k.toLowerCase() === 'none' || k.toLowerCase() === 'n/a') continue;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .map(([objection, count]) => ({ objection, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/** Distribution of conversation_depth labels (e.g. "shallow", "deep") across all
 *  classified calls. Returns rows ordered by count desc. */
export async function getClientConversationDepth(sb: SB) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb as any)
    .from('upgrad_call_logs')
    .select('conversation_depth')
    .not('conversation_depth', 'is', null);
  const counts = new Map<string, number>();
  for (const r of (data ?? []) as { conversation_depth: string | null }[]) {
    if (!r.conversation_depth) continue;
    counts.set(r.conversation_depth, (counts.get(r.conversation_depth) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([depth, count]) => ({ depth, count }))
    .sort((a, b) => b.count - a.count);
}

/** Average call duration across connected calls (duration > 0). Returned in
 *  seconds. Per UGSOT request 2026-05-23 (overview-only): show on the Overview
 *  metric strip — replaces the Callbacks Pending card. */
export async function getClientAvgCallDuration(sb: SB) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb as any)
    .from('upgrad_call_logs')
    .select('duration_seconds')
    .gt('duration_seconds', 0);
  const rows = (data ?? []) as { duration_seconds: number }[];
  const n = rows.length;
  if (n === 0) return { avg_seconds: 0, connected_calls: 0 };
  const total = rows.reduce((s, r) => s + (r.duration_seconds ?? 0), 0);
  return { avg_seconds: Math.round(total / n), connected_calls: n };
}

// ─── Disposition drill-down ─────────────────────────────────────────────────
// New views added in migration 07: v_client_leads_by_stage, v_client_call_summaries
// Types defined here (rather than regenerating the full Database typings) so
// they're co-located with the queries that use them.

// NOTE (post-Phase-3, by client request): the client-side row now returns
// the raw phone (no XXXXXX mask) and a `connected_on_attempt` ordinal
// indicating which attempt number first connected (NULL = never connected).
// Phone unmasking is an explicit override of SPEC.md §0 "sanitized" rule —
// UGSOT owns this data and wants direct phone visibility.
export type ClientLeadRow = {
  lead_uid: string;
  first_name: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  preferred_campus: string | null;
  interested_field: string | null;
  lead_source: string | null;
  lead_stage: string;
  callback_booked: boolean | null;
  callback_datetime: string | null;
  last_called_at: string | null;
  ls_prospect_id: string;
  total_attempts: number | null;
  total_connects: number | null;
  ls_ingested_at: string | null;
  is_archived: boolean;
  /** Attempt number (1, 2, 3 …) on which the lead first connected. NULL = never connected. */
  connected_on_attempt: number | null;
  /** Latest non-null, non-INVALID transcript summary for this lead. NULL = no summary yet. */
  last_call_summary: string | null;
};

export type ClientCallSummary = {
  call_id: string;
  lead_id: string;
  attempt_date: string | null;
  attempt_time: string | null;
  call_start: string | null;
  duration_seconds: number | null;
  call_status: string | null;
  call_end_reason: string | null;
  enquiry_classification: string | null;
  transcript_summary: string | null;
  lead_source: string | null;
  campaign_id: string | null;
  callback_booked: boolean | null;
  callback_datetime: string | null;
};

/** Leads in a given stage, sorted by most-recent attempt.
 *
 *  NOTE: Supabase REST API caps a single `select` at `MAX_ROWS` (default 1,000)
 *  regardless of `.limit(N)`. To return all leads in large stages like
 *  "AI Bot Reached - DNP" (~2,400 leads), we paginate via `.range()` in pages
 *  of 1,000 until we get a partial page back. Safety stop at 20k.
 */
export async function getClientLeadsByStage(sb: SB, stage: string): Promise<ClientLeadRow[]> {
  const pageSize = 1000;
  const out: ClientLeadRow[] = [];
  for (let from = 0; from < 20_000; from += pageSize) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (sb as any)
      .from('v_client_leads_by_stage')
      .select('*')
      .eq('lead_stage', stage)
      .order('last_called_at', { ascending: false, nullsFirst: false })
      .range(from, from + pageSize - 1);
    if (error) break;
    const rows = (data ?? []) as ClientLeadRow[];
    out.push(...rows);
    if (rows.length < pageSize) break;
  }
  return out;
}

/** Calls (summaries only) for a single lead identified by ls_prospect_id. */
export async function getClientCallSummariesForLead(sb: SB, lsProspectId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb as any)
    .from('v_client_call_summaries')
    .select('*')
    .eq('lead_id', lsProspectId)
    .order('call_start', { ascending: false, nullsFirst: false });
  return (data ?? []) as ClientCallSummary[];
}

/** Per-stage richer breakdown for the Dispositions page: counts + sample lead.
 *  EXCLUDES "Not Yet Called" — those leads have no disposition outcome yet
 *  (per client request 2026-05-23).
 */
/** All disposition stages from lead_stage on active + archived leads.
 *  Every lead is accounted for — total should match funnel.total_leads exactly.
 */
export async function getClientDispositionBreakdown(sb: SB) {
  const { data: rows } = await sb
    .from('v_client_dispositions')
    .select('lead_stage, lead_count')
    .order('lead_count', { ascending: false });
  return (rows ?? [])
    .filter((r) => r.lead_stage != null)
    .map((r) => ({
      stage: r.lead_stage as string,
      count: r.lead_count ?? 0
    }));
}

// ─── Business performance views (added post-Phase-3 by client request) ─────
export type SourcePerformanceRow = {
  source: string;
  total_leads: number;
  attempted: number;
  connected: number;
  hot: number;
  warm: number;
  ugnet_registrations: number;
  qualification_rate_pct: number;
  connect_rate_pct: number;
};

export type StatePerformanceRow = {
  state: string;
  total_leads: number;
  attempted: number;
  connected: number;
  hot: number;
  warm: number;
  ugnet_registrations: number;
  qualification_rate_pct: number;
};

export async function getClientSourcePerformance(sb: SB) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb as any)
    .from('v_client_source_performance')
    .select('*');
  return (data ?? []) as SourcePerformanceRow[];
}

export async function getClientStatePerformance(sb: SB) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb as any)
    .from('v_client_state_performance')
    .select('*');
  return (data ?? []) as StatePerformanceRow[];
}

// ─── Engagement funnel (unique-lead based) ─────────────────────────────────
// SPEC §0 sanitization update: client view hides attempt counts. The funnel
// is in UNIQUE LEADS at each phase, not call rows.

export type EngagementFunnel = {
  attempted: number;
  connected: number;
  qualified: number;
};

export type EngagementBySourceRow = {
  source: string;
  total_leads: number;
  attempted: number;
  connected: number;
  engaged: number;
  engagement_rate_pct: number;
};

export async function getClientEngagementFunnel(sb: SB): Promise<EngagementFunnel> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb as any)
    .from('v_client_engagement_funnel')
    .select('*')
    .maybeSingle();
  return (data ?? { attempted: 0, connected: 0, qualified: 0 }) as EngagementFunnel;
}

export async function getClientEngagementBySource(sb: SB): Promise<EngagementBySourceRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb as any)
    .from('v_client_engagement_by_source')
    .select('*');
  return (data ?? []) as EngagementBySourceRow[];
}

// Removed: getClientConnectivityTotals.
// Replaced by getClientEngagementFunnel which returns unique-lead counts at
// Attempted/Connected/Engaged stages. Duration-based aggregates are intentionally
// no longer surfaced to the client view per UGSOT request 2026-05-23.
