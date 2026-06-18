// All client-facing queries. Each function accepts an awaited Supabase server
// client and `ScopeArgs` ({ campaigns, scope }) so the caller (Server Component)
// can thread the current user's campaign + source scope without duplication.
//
// Campaign scope: `null` = aggregate across all non-excluded campaigns
// (super_admin default); `string[]` = narrow to those campaign_ids. Empty
// array = deny (no campaigns) — pages should short-circuit upstream.
//
// Source scope: `string[]` for digital_partner = data_source_name allowlist;
// undefined = no restriction.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import type { ScopeArgs } from '@/lib/queries/scope';

type SB = SupabaseClient<Database>;

// ─── Connectivity filters (11 dimensions) ──────────────────────────────────
// All connectivity queries below accept the same ConnectivityFilters shape.

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

/** Convert ConnectivityFilters + ScopeArgs to named RPC args. */
function rpcArgs(scope: ScopeArgs, filters?: ConnectivityFilters) {
  const norm = (v?: string[]) => (v && v.length > 0 ? v : null);
  return {
    p_campaign_id:              scope.campaigns,
    p_lead_source:              norm(filters?.lead_source),
    p_data_acquisition_channel: norm(filters?.data_acquisition_channel),
    p_data_source_type:         norm(filters?.data_source_type),
    p_data_source_name:         norm(filters?.data_source_name ?? scope.scope),
    p_data_source_batch:        norm(filters?.data_source_batch),
    p_utm_source:               norm(filters?.utm_source),
    p_original_utm_source:      norm(filters?.original_utm_source),
    p_original_utm_campaign:    norm(filters?.original_utm_campaign),
    p_original_utm_medium:      norm(filters?.original_utm_medium),
    p_original_utm_content:     norm(filters?.original_utm_content),
    p_original_utm_term:        norm(filters?.original_utm_term)
  };
}

// ─── Funnel ────────────────────────────────────────────────────────────────

export type ClientFunnelRow = {
  total_leads: number;
  attempted: number;
  connected: number;
  engaged: number;
  qualified: number;
  hot: number;
  warm: number;
  callback_pending: number;
};

export async function getClientFunnel(
  sb: SB,
  scope: ScopeArgs,
  filters?: ConnectivityFilters
): Promise<ClientFunnelRow | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb as any).rpc('client_funnel_filtered', rpcArgs(scope, filters));
  const row = Array.isArray(data) ? data[0] : data;
  return (row ?? null) as ClientFunnelRow | null;
}

// ─── Hot/Warm leads ────────────────────────────────────────────────────────

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

export async function getClientHotWarmLeads(
  sb: SB,
  scope: ScopeArgs
): Promise<HotWarmLeadRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb as any).rpc('client_hot_warm_leads_filtered', {
    p_campaign_id: scope.campaigns,
    p_data_source_name: scope.scope ?? null
  });
  return (data ?? []) as HotWarmLeadRow[];
}

// ─── Connectivity (legacy per-attempt view; only used in admin-style places) ─

export async function getClientConnectivity(sb: SB) {
  const { data } = await sb
    .from('v_client_connectivity')
    .select('*')
    .order('attempt_number', { ascending: true });
  return data ?? [];
}

// ─── Voice minutes ─────────────────────────────────────────────────────────
// Billing cycle (8th-to-8th) — backed by client_minutes_summary RPC.

export type ClientMinutesSummary = {
  campaign_id: string | null;
  billing_cycle_start: string | null;
  billing_cycle_end: string | null;
  allocated_minutes: number | null;
  minutes_used: number;
  minutes_remaining: number;
  utilization_pct: number;
};

export async function getClientMinutesSummary(
  sb: SB,
  scope: ScopeArgs
): Promise<ClientMinutesSummary | null> {
  // p_campaign_id is a single text param on this RPC (not text[]) — passing
  // the first picked campaign when there's exactly one, else null = aggregate.
  const picked = scope.campaigns && scope.campaigns.length === 1 ? scope.campaigns[0] : null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb as any).rpc('client_minutes_summary', { p_campaign_id: picked });
  const row = Array.isArray(data) ? data[0] : data;
  return (row ?? null) as ClientMinutesSummary | null;
}

// Per-campaign breakup over the current 8th-to-8th billing cycle. Excludes
// coming_soon campaigns (Kannada) so a not-yet-launched campaign never shows
// usage in the client view.
export type ClientMinutesByCampaignRow = {
  campaign_id: string;
  display_name: string;
  minutes_used: number;
};

export async function getClientMinutesByCampaignCycle(
  sb: SB,
  scope: ScopeArgs
): Promise<ClientMinutesByCampaignRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb as any).rpc('client_minutes_by_campaign_cycle', {
    p_campaign_id: scope.campaigns
  });
  return (data ?? []).map((r: { campaign_id: string; display_name: string; minutes_used: string | number }) => ({
    campaign_id: r.campaign_id,
    display_name: r.display_name,
    minutes_used: Number(r.minutes_used ?? 0)
  }));
}

// ─── Top objections + conversation depth + avg call duration ───────────────

export async function getClientTopObjections(
  sb: SB,
  scope: ScopeArgs,
  limit = 10
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb as any).rpc('top_objections', {
    p_limit: limit,
    p_campaign_id: scope.campaigns,
    p_data_source_name: scope.scope ?? null
  });
  const rows = (data ?? []) as { objection: string; frequency: number }[];
  return rows.map((r) => ({ objection: r.objection, count: Number(r.frequency ?? 0) }));
}

export async function getClientConversationDepth(sb: SB, scope: ScopeArgs) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb as any).rpc('client_conversation_depth', {
    p_campaign_id: scope.campaigns,
    p_data_source_name: scope.scope ?? null
  });
  const rows = (data ?? []) as { depth: string; lead_count: number }[];
  return rows.map((r) => ({ depth: r.depth, count: Number(r.lead_count ?? 0) }));
}

export async function getClientAvgCallDuration(sb: SB, scope: ScopeArgs) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb as any).rpc('client_avg_call_duration', {
    p_campaign_id: scope.campaigns,
    p_data_source_name: scope.scope ?? null
  });
  const row = Array.isArray(data) ? data[0] : data;
  return {
    avg_seconds: Number(row?.avg_seconds ?? 0),
    connected_calls: Number(row?.connected_calls ?? 0)
  };
}

// ─── Disposition drill-down (lead drill-in) ────────────────────────────────

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
  connected_on_attempt: number | null;
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

export type DispositionDateRange = { from?: string; to?: string };

export async function getClientLeadsByStage(
  sb: SB,
  stage: string,
  range: DispositionDateRange | undefined,
  scope: ScopeArgs
): Promise<ClientLeadRow[]> {
  const pageSize = 1000;
  const out: ClientLeadRow[] = [];
  for (let off = 0; off < 20_000; off += pageSize) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (sb as any).rpc('client_leads_by_stage_filtered', {
      p_stage: stage,
      p_from: range?.from ?? null,
      p_to: range?.to ?? null,
      p_campaign_id: scope.campaigns,
      p_data_source_name: scope.scope ?? null,
      p_offset: off,
      p_limit: pageSize
    });
    if (error) break;
    const rows = (data ?? []) as ClientLeadRow[];
    out.push(...rows);
    if (rows.length < pageSize) break;
  }
  return out;
}

/** Calls (summaries only) for a single lead. View v_client_call_summaries
 *  already filters out excluded campaigns globally; access to the specific
 *  lead is implicit (the lead row was already shown to the user). */
export async function getClientCallSummariesForLead(sb: SB, lsProspectId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb as any)
    .from('v_client_call_summaries')
    .select('*')
    .eq('lead_id', lsProspectId)
    .order('call_start', { ascending: false, nullsFirst: false });
  return (data ?? []) as ClientCallSummary[];
}

// ─── Disposition breakdown (Overview card) ─────────────────────────────────

export async function getClientDispositionBreakdown(
  sb: SB,
  range: DispositionDateRange | undefined,
  scope: ScopeArgs,
  filters?: ConnectivityFilters
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb as any).rpc('client_dispositions_filtered', {
    p_from: range?.from ?? null,
    p_to: range?.to ?? null,
    ...rpcArgs(scope, filters)
  });
  const rows = (data ?? []) as { lead_stage: string | null; lead_count: number }[];
  return rows
    .filter((r) => r.lead_stage && r.lead_stage !== 'Not Yet Called')
    .map((r) => ({ stage: r.lead_stage as string, count: r.lead_count ?? 0 }));
}

// ─── State performance ─────────────────────────────────────────────────────

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

export async function getClientStatePerformance(
  sb: SB,
  scope: ScopeArgs
): Promise<StatePerformanceRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb as any).rpc('client_state_performance_filtered', {
    p_campaign_id: scope.campaigns,
    p_data_source_name: scope.scope ?? null
  });
  return (data ?? []) as StatePerformanceRow[];
}

// ─── Engagement funnel + by-source + filter options ────────────────────────

export type EngagementFunnel = { attempted: number; connected: number; qualified: number };

export type EngagementBySourceRow = {
  source: string;
  total_leads: number;
  attempted: number;
  connected: number;
  engaged: number;
  engagement_rate_pct: number;
};

export async function getClientEngagementFunnel(
  sb: SB,
  scope: ScopeArgs,
  filters?: ConnectivityFilters
): Promise<EngagementFunnel> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb as any).rpc('client_engagement_funnel_filtered', rpcArgs(scope, filters));
  const row = Array.isArray(data) ? data[0] : data;
  return (row ?? { attempted: 0, connected: 0, qualified: 0 }) as EngagementFunnel;
}

export async function getClientEngagementBySource(
  sb: SB,
  scope: ScopeArgs,
  filters?: ConnectivityFilters
): Promise<EngagementBySourceRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb as any).rpc('client_engagement_by_source_filtered', rpcArgs(scope, filters));
  return (data ?? []) as EngagementBySourceRow[];
}

export async function getClientConnectivityFilterOptions(
  sb: SB,
  scope: ScopeArgs
): Promise<ConnectivityFilterOptions> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb as any).rpc('client_connectivity_filter_options', {
    p_campaign_id: scope.campaigns
  });
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
  const merged = { ...base, ...(data as ConnectivityFilterOptions) };
  // If the user has a fixed source scope, narrow the Lead Source dropdown to
  // only their allowed values. Other UTM dropdowns are left alone — they're
  // dimensions, not sources.
  if (scope.scope?.length) {
    const allowed = new Set(scope.scope);
    merged.lead_source = merged.lead_source.filter((v) => allowed.has(v));
  }
  return merged;
}

// ─── Per-day connectivity trend ────────────────────────────────────────────
// Unique-lead counts per IST day. "connected" = lead picked up ≥1 call that
// day (duration_seconds > 0) — robust to AI-classification lag. "engaged" =
// lead reached HOT/WARM/CB_LATER, which is classification-derived and only
// populates once the post-call AI pipeline runs for that day.

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
  scope: ScopeArgs,
  filters?: ConnectivityFilters
): Promise<ConnectivityDailyRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb as any).rpc('client_connectivity_daily_filtered', rpcArgs(scope, filters));
  return (data ?? []) as ConnectivityDailyRow[];
}

// ─── Connected calls (billing audit) ───────────────────────────────────────

export type ConnectedCallRow = {
  ls_prospect_id: string;
  call_start: string;        // timestamptz ISO
  duration_seconds: number;
  campaign_id: string;
};

export async function getClientConnectedCalls(
  sb: SB,
  range: DispositionDateRange | undefined,
  scope: ScopeArgs,
  opts: { offset?: number; limit?: number } = {}
): Promise<ConnectedCallRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb as any).rpc('client_connected_calls', {
    p_from: range?.from ?? null,
    p_to: range?.to ?? null,
    p_campaign_id: scope.campaigns,
    p_data_source_name: scope.scope ?? null,
    p_offset: opts.offset ?? 0,
    p_limit: opts.limit ?? 50000
  });
  return (data ?? []) as ConnectedCallRow[];
}

export async function getClientConnectedCallsCount(
  sb: SB,
  range: DispositionDateRange | undefined,
  scope: ScopeArgs
): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb as any).rpc('client_connected_calls_count', {
    p_from: range?.from ?? null,
    p_to: range?.to ?? null,
    p_campaign_id: scope.campaigns,
    p_data_source_name: scope.scope ?? null
  });
  return Number(data ?? 0);
}

// ─── Campaign registry (for the header dropdown) ───────────────────────────

export type CampaignVisibility = 'all' | 'coming_soon';
export type DashboardCampaign = {
  campaign_id: string;
  display_name: string;
  visibility: CampaignVisibility;
};

/** Campaigns to surface in the header dropdown.
 *
 *  super_admin (scope.campaigns === null): every active campaign.
 *  Others: union of the user's explicit `dashboard_user_campaigns` scope AND
 *  every `visibility='coming_soon'` campaign. The coming-soon ones are visible
 *  in the dropdown but render a placeholder when picked (see ComingSoonView).
 */
export async function listAllowedCampaigns(
  sb: SB,
  scope: ScopeArgs
): Promise<DashboardCampaign[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb as any)
    .from('dashboard_campaigns')
    .select('campaign_id, display_name, visibility')
    .eq('is_active', true)
    .order('visibility', { ascending: true })
    .order('display_name', { ascending: true });
  const all = (data ?? []) as DashboardCampaign[];
  if (scope.campaigns === null) return all; // super_admin sees everything
  const allowed = new Set(scope.campaigns);
  return all.filter(
    (c) => allowed.has(c.campaign_id) || c.visibility === 'coming_soon'
  );
}
