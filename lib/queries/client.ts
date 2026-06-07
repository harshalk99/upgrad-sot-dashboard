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

/** Voice minutes used vs allocated for the current UGSOT billing cycle.
 *  Cycle runs from the 18th of one month to the 17th of the next (inclusive).
 *  Backed by v_client_minutes_summary (recreated in migration 0018 — see
 *  supabase/migrations/0018_minutes_billing_cycle.sql). Shape:
 *    { campaign_id, billing_cycle_start, billing_cycle_end,
 *      allocated_minutes, minutes_used, minutes_remaining, utilization_pct }
 */
export type ClientMinutesSummary = {
  campaign_id: string | null;
  billing_cycle_start: string | null; // YYYY-MM-DD
  billing_cycle_end: string | null;   // YYYY-MM-DD (exclusive)
  allocated_minutes: number | null;
  minutes_used: number;
  minutes_remaining: number;
  utilization_pct: number;
};

export async function getClientMinutesSummary(sb: SB): Promise<ClientMinutesSummary | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb as any)
    .from('v_client_minutes_summary')
    .select('*')
    .maybeSingle();
  return (data ?? null) as ClientMinutesSummary | null;
}

/** Top objections raised in conversations over the last N days. Aggregates the
 *  comma-separated `objections_raised` text column. Filters out "none"/"n/a".
 *  Excludes flagged calls — those are post-cleanup bad data we don't trust. */
export async function getClientTopObjections(sb: SB, limit = 10) {
  // The existing top_objections(p_limit) RPC (per SPEC §5.4, SECURITY DEFINER)
  // aggregates over all unflagged calls — clients can't read upgrad_call_logs
  // directly due to RLS. The RPC is all-time; if a date window is needed in
  // future, extend the RPC and add the param here.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb as any).rpc('top_objections', { p_limit: limit });
  const rows = (data ?? []) as { objection: string; frequency: number }[];
  return rows.map((r) => ({ objection: r.objection, count: Number(r.frequency ?? 0) }));
}

/** Distribution of conversation_depth labels (e.g. "shallow", "deep") across all
 *  classified calls. Returns rows ordered by count desc. Excludes flagged calls.
 *  Backed by client_conversation_depth RPC (SECURITY DEFINER) so client sessions
 *  can aggregate without needing direct read access to upgrad_call_logs. */
export async function getClientConversationDepth(sb: SB) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb as any).rpc('client_conversation_depth');
  const rows = (data ?? []) as { depth: string; lead_count: number }[];
  return rows.map((r) => ({ depth: r.depth, count: Number(r.lead_count ?? 0) }));
}

/** Average call duration across connected calls (duration > 0). Returned in
 *  seconds. Per UGSOT request 2026-05-23 (overview-only): show on the Overview
 *  metric strip — replaces the Callbacks Pending card. Excludes flagged calls.
 *
 *  Backed by client_avg_call_duration RPC (SECURITY DEFINER). Previously
 *  queried upgrad_call_logs directly, which returns 0 rows for client sessions
 *  due to RLS — net effect was a permanent "0s" KPI for client users. */
export async function getClientAvgCallDuration(sb: SB) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb as any).rpc('client_avg_call_duration');
  const row = Array.isArray(data) ? data[0] : data;
  return {
    avg_seconds: Number(row?.avg_seconds ?? 0),
    connected_calls: Number(row?.connected_calls ?? 0)
  };
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
 *  regardless of `.limit(N)`. Pages via `.range()` until we hit a partial
 *  result. Safety stop at 20k rows.
 *
 *  Optional `range` filters by `last_called_at` (date-only). Leads with NULL
 *  `last_called_at` are excluded whenever any bound is provided.
 */
export async function getClientLeadsByStage(
  sb: SB,
  stage: string,
  range?: DispositionDateRange
): Promise<ClientLeadRow[]> {
  const pageSize = 1000;
  const out: ClientLeadRow[] = [];
  for (let from = 0; from < 20_000; from += pageSize) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (sb as any)
      .from('v_client_leads_by_stage')
      .select('*')
      .eq('lead_stage', stage);
    // IST-anchored day bounds (Asia/Kolkata = UTC+05:30) so a call at 02:00 IST
    // on the "to" day is included in that day's bucket. Without the +05:30 the
    // bound is interpreted as UTC and late-evening-IST calls get assigned to
    // the wrong day in the filtered list.
    if (range?.from) q = q.gte('last_called_at', `${range.from}T00:00:00+05:30`);
    if (range?.to)   q = q.lte('last_called_at', `${range.to}T23:59:59.999+05:30`);
    q = q.order('last_called_at', { ascending: false, nullsFirst: false })
         .range(from, from + pageSize - 1);
    const { data, error } = await q;
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

/** Per-stage breakdown for the Disposition card on /dashboard Overview.
 *
 *  Excludes "Not Yet Called" (no disposition outcome yet).
 *  Accepts an optional date range filtering by `last_called_at` IN IST — when
 *  the AI actually assigned the stage, bucketed by Asia/Kolkata day boundaries.
 *
 *  Backed by `get_dispositions_by_ist_date(p_from, p_to)` (SECURITY DEFINER,
 *  reads from v_lead_dispositions_ist which has a pre-computed
 *  last_called_date_ist column). This replaces the previous UTC-bucketed
 *  client_dispositions_in_range RPC — fixes a bug where late-evening IST calls
 *  bucketed into the wrong day (~1% of leads).
 *
 *  When no range is supplied, calls with NULL bounds — the function returns
 *  cumulative counts across all dispositions.
 */
export type DispositionDateRange = { from?: string; to?: string }; // YYYY-MM-DD

export async function getClientDispositionBreakdown(
  sb: SB,
  range?: DispositionDateRange
) {
  // When the user has set any bound, use the IST-bucketed RPC (correct day
  // boundaries for Asia/Kolkata). When no bound is set we want cumulative
  // all-time counts — the IST RPC returns 0 rows for NULL params, so fall
  // back to client_dispositions_in_range which treats NULL as "no filter".
  const hasBound = Boolean(range?.from || range?.to);
  const rpcName = hasBound ? 'get_dispositions_by_ist_date' : 'client_dispositions_in_range';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb as any).rpc(rpcName, {
    p_from: range?.from ?? null,
    p_to: range?.to ?? null
  });
  const rows = (data ?? []) as { lead_stage: string | null; lead_count: number }[];
  return rows
    .filter((r) => r.lead_stage && r.lead_stage !== 'Not Yet Called')
    .map((r) => ({ stage: r.lead_stage as string, count: r.lead_count ?? 0 }));
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

/** @deprecated Source performance card was removed from /dashboard Overview when
 *  the Connectivity page gained a Lead Source filter. Keep the helper for
 *  potential re-introduction. */
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

// ─── Connectivity filters (11 dimensions) ──────────────────────────────────
// All 3 connectivity queries below accept the same ConnectivityFilters shape.
// Passes through to the *_filtered RPC functions added in dashboard_setup_14/15.

export type ConnectivityFilters = {
  lead_source?: string[];
  data_acquisition_channel?: string[];
  data_source_type?: string[];
  data_source_name?: string[];
  data_source_batch?: string[];
  utm_source?: string[];
  original_utm_source?: string[];
  original_utm_campaign?: string[];
  original_utm_medium?: string[];
  original_utm_content?: string[];
  original_utm_term?: string[];
};

export type ConnectivityFilterOptions = {
  [K in keyof Required<ConnectivityFilters>]: string[];
};

/** Convert ConnectivityFilters to named RPC args; undefined / empty becomes null. */
function mapFiltersToRpcArgs(filters?: ConnectivityFilters) {
  const norm = (v?: string[]) => (v && v.length > 0 ? v : null);
  return {
    p_lead_source:              norm(filters?.lead_source),
    p_data_acquisition_channel: norm(filters?.data_acquisition_channel),
    p_data_source_type:         norm(filters?.data_source_type),
    p_data_source_name:         norm(filters?.data_source_name),
    p_data_source_batch:        norm(filters?.data_source_batch),
    p_utm_source:               norm(filters?.utm_source),
    p_original_utm_source:      norm(filters?.original_utm_source),
    p_original_utm_campaign:    norm(filters?.original_utm_campaign),
    p_original_utm_medium:      norm(filters?.original_utm_medium),
    p_original_utm_content:     norm(filters?.original_utm_content),
    p_original_utm_term:        norm(filters?.original_utm_term)
  };
}

export async function getClientEngagementFunnel(
  sb: SB,
  filters?: ConnectivityFilters
): Promise<EngagementFunnel> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb as any).rpc(
    'client_engagement_funnel_filtered',
    mapFiltersToRpcArgs(filters)
  );
  const row = Array.isArray(data) ? data[0] : data;
  return (row ?? { attempted: 0, connected: 0, qualified: 0 }) as EngagementFunnel;
}

export async function getClientEngagementBySource(
  sb: SB,
  filters?: ConnectivityFilters
): Promise<EngagementBySourceRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb as any).rpc(
    'client_engagement_by_source_filtered',
    mapFiltersToRpcArgs(filters)
  );
  return (data ?? []) as EngagementBySourceRow[];
}

export async function getClientConnectivityFilterOptions(
  sb: SB
): Promise<ConnectivityFilterOptions> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb as any).rpc('client_connectivity_filter_options');
  const base: ConnectivityFilterOptions = {
    lead_source: [],
    data_acquisition_channel: [],
    data_source_type: [],
    data_source_name: [],
    data_source_batch: [],
    utm_source: [],
    original_utm_source: [],
    original_utm_campaign: [],
    original_utm_medium: [],
    original_utm_content: [],
    original_utm_term: []
  };
  if (!data || typeof data !== 'object') return base;
  return { ...base, ...(data as ConnectivityFilterOptions) };
}

// ─── Per-day connectivity trend ────────────────────────────────────────────
// Unique-LEAD counts bucketed by IST day (matches the KPI cards above the
// chart so the trend doesn't double-count retried leads). A lead is:
//   attempted on day X = ≥1 call placed that day
//   connected on day X = ≥1 of those calls had a non-DNP/non-INVALID classification
//   engaged on day X   = ≥1 of those calls reached HOT/WARM/CB_LATER

export type ConnectivityDailyRow = {
  day: string;
  attempted: number;
  connected: number;
  engaged: number;
  connect_pct: number | null;
  engage_pct: number | null;
};

export async function getClientConnectivityDaily(
  sb: SB,
  filters?: ConnectivityFilters
): Promise<ConnectivityDailyRow[]> {
  // Calls the *_filtered RPC. When filters is undefined/empty, returns the same
  // 30-day daily breakdown as the legacy v_client_connectivity_daily view.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb as any).rpc(
    'client_connectivity_daily_filtered',
    mapFiltersToRpcArgs(filters)
  );
  return (data ?? []) as ConnectivityDailyRow[];
}

// Removed: getClientConnectivityTotals.
// Replaced by getClientEngagementFunnel which returns unique-lead counts at
// Attempted/Connected/Engaged stages. Duration-based aggregates are intentionally
// no longer surfaced to the client view per UGSOT request 2026-05-23.
