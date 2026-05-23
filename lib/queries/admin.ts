// All admin-facing (Predixion ops) queries live here. SPEC.md "Style and conventions":
// "All database queries go through lib/queries/{client,admin,super,mutations}.ts —
//  never inline in pages."
//
// These functions are designed to be called from Server Components in /admin.
// Each one accepts an awaited Supabase server client.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

type SB = SupabaseClient<Database>;

// ─── Real-time pipeline ─────────────────────────────────────────────────────
export type PipelineNow = {
  due_now: number;
  scheduled_future: number;
  in_flight: number;
  stuck_pending: number;
  awaiting_push: number;
  stale_unpushed: number;
  flagged_24h: number;
  malfunctions_24h: number;
};

export async function getAdminPipelineNow(sb: SB): Promise<PipelineNow> {
  const { data } = await sb.from('v_admin_pipeline_now').select('*').maybeSingle();
  return (
    (data as unknown as PipelineNow) ?? {
      due_now: 0,
      scheduled_future: 0,
      in_flight: 0,
      stuck_pending: 0,
      awaiting_push: 0,
      stale_unpushed: 0,
      flagged_24h: 0,
      malfunctions_24h: 0
    }
  );
}

// ─── Hourly dispatch bar (last 24h) ─────────────────────────────────────────
export type HourlyDispatch = { hour: string; dispatched: number };

export async function getHourlyDispatch(sb: SB): Promise<HourlyDispatch[]> {
  // Aggregate in JS — we only have ~4k queue rows.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb as any)
    .from('upgrad_call_queue')
    .select('dispatched_at')
    .gte('dispatched_at', since)
    .not('dispatched_at', 'is', null);

  const buckets = new Map<string, number>();
  // Initialize last-24h buckets so the bar is continuous
  const startHour = new Date();
  startHour.setMinutes(0, 0, 0);
  for (let i = 23; i >= 0; i--) {
    const d = new Date(startHour.getTime() - i * 60 * 60 * 1000);
    buckets.set(d.toISOString(), 0);
  }
  for (const row of (data ?? []) as { dispatched_at: string }[]) {
    const d = new Date(row.dispatched_at);
    d.setMinutes(0, 0, 0);
    const key = d.toISOString();
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([hour, dispatched]) => ({ hour, dispatched }));
}

// ─── Live activity feed (last 20 events) ────────────────────────────────────
export type ActivityEvent =
  | {
      kind: 'call';
      ts: string;
      call_id: string;
      lead_name: string | null;
      phone: string | null;
      call_status: string | null;
      duration_seconds: number | null;
      flagged: boolean;
      malfunction: boolean;
    }
  | {
      kind: 'ls_sync';
      ts: string;
      ls_prospect_id: string | null;
      action: string;
      success: boolean;
      response_status: number | null;
      error_message: string | null;
    };

export async function getRecentActivity(sb: SB, limit = 20): Promise<ActivityEvent[]> {
  const [calls, syncs] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb as any)
      .from('upgrad_call_logs')
      .select('call_id, call_start, customer_name, phone, call_status, duration_seconds, call_flagged, agent_malfunction')
      .order('call_start', { ascending: false, nullsFirst: false })
      .limit(limit),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb as any)
      .from('upgrad_ls_sync_log')
      .select('ls_prospect_id, action, success, response_status, error_message, created_at')
      .order('created_at', { ascending: false })
      .limit(limit)
  ]);

  const callEvents: ActivityEvent[] = (calls.data ?? []).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (r: any) => ({
      kind: 'call' as const,
      ts: r.call_start,
      call_id: r.call_id,
      lead_name: r.customer_name,
      phone: r.phone,
      call_status: r.call_status,
      duration_seconds: r.duration_seconds,
      flagged: !!r.call_flagged,
      malfunction: !!r.agent_malfunction
    })
  );

  const syncEvents: ActivityEvent[] = (syncs.data ?? []).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (r: any) => ({
      kind: 'ls_sync' as const,
      ts: r.created_at,
      ls_prospect_id: r.ls_prospect_id,
      action: r.action,
      success: !!r.success,
      response_status: r.response_status,
      error_message: r.error_message
    })
  );

  return [...callEvents, ...syncEvents]
    .filter((e) => !!e.ts)
    .sort((a, b) => b.ts.localeCompare(a.ts))
    .slice(0, limit);
}

// ─── Call logs (list view) ──────────────────────────────────────────────────
export type CallLogListFilters = {
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  callStatus?: string;
  classification?: string;
  leadStage?: string;
  flagged?: boolean;
  malfunction?: boolean;
  hasRecording?: boolean;
};

export type CallLogRow = {
  id: number;
  call_id: string;
  call_start: string | null;
  duration_seconds: number | null;
  call_status: string | null;
  enquiry_classification: string | null;
  lead_name: string | null;
  lead_phone: string | null;
  ls_prospect_id: string | null;
  lead_stage: string | null;
  call_flagged: boolean | null;
  agent_malfunction: boolean | null;
  recording_url: string | null;
};

export async function getCallLogsList(
  sb: SB,
  filters: CallLogListFilters,
  page: number,
  pageSize: number
): Promise<{ rows: CallLogRow[]; total: number }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = (sb as any)
    .from('v_admin_call_logs')
    .select(
      'id, call_id, call_start, duration_seconds, call_status, enquiry_classification, ' +
        'lead_name, lead_phone, ls_prospect_id, lead_stage, call_flagged, agent_malfunction, recording_url',
      { count: 'exact' }
    );

  if (filters.dateFrom) q = q.gte('call_start', filters.dateFrom);
  if (filters.dateTo) q = q.lte('call_start', filters.dateTo);
  if (filters.callStatus) q = q.eq('call_status', filters.callStatus);
  if (filters.classification) q = q.eq('enquiry_classification', filters.classification);
  if (filters.leadStage) q = q.eq('lead_stage', filters.leadStage);
  if (filters.flagged != null) q = q.eq('call_flagged', filters.flagged);
  if (filters.malfunction != null) q = q.eq('agent_malfunction', filters.malfunction);
  if (filters.hasRecording === true) q = q.not('recording_url', 'is', null);
  if (filters.hasRecording === false) q = q.is('recording_url', null);

  if (filters.search) {
    const s = filters.search.trim();
    // Match against call_id, lead_phone, lead_name, ls_prospect_id
    // Use 'or' clause — PostgREST syntax.
    q = q.or(
      `call_id.ilike.%${s}%,lead_phone.ilike.%${s}%,lead_name.ilike.%${s}%,ls_prospect_id.ilike.%${s}%`
    );
  }

  const from = page * pageSize;
  const to = from + pageSize - 1;
  q = q.order('call_start', { ascending: false, nullsFirst: false }).range(from, to);

  const { data, count } = await q;
  return { rows: (data ?? []) as CallLogRow[], total: count ?? 0 };
}

// ─── Call log detail ────────────────────────────────────────────────────────
export type CallLogDetail = {
  id: number;
  call_id: string;
  call_start: string | null;
  call_end: string | null;
  duration_seconds: number | null;
  call_status: string | null;
  extracted_status: string | null;
  enquiry_classification: string | null;
  caller_type: string | null;
  caller_language: string | null;
  dnd: boolean | null;
  agent_malfunction: boolean | null;
  call_flagged: boolean | null;
  transcript_summary: string | null;
  transcript: string | null;
  recording_url: string | null;
  objections_raised: string | null;
  disqualification_reason: string | null;
  lead_name: string | null;
  lead_phone: string | null;
  ls_prospect_id: string | null;
  lead_stage: string | null;
  total_attempts: number | null;
  campaign_id: string | null;
  agent_malfunction_details: string | null;
  ls_call_activity_id: string | null;
  flagged_by: string | null;
  flagged_reason: string | null;
  flagged_at: string | null;
  flagged_source: string | null;
  // From the raw call_logs table (not in v_admin_call_logs):
  call_end_reason?: string | null;
  sentiment?: string | null;
  conversation_depth?: string | null;
  caller_city?: string | null;
  caller_state?: string | null;
  twelfth_stream?: string | null;
  jee_status?: string | null;
  caller_college_status?: string | null;
  colleges_considering?: string | null;
  preferred_campus?: string | null;
  interested_field?: string | null;
  ugnet_registered?: boolean | null;
  callback_booked?: boolean | null;
  callback_datetime?: string | null;
  caller_twelfth_year?: string | null;
  asked_brochure?: boolean | null;
  asked_payment_link?: boolean | null;
  payment_concern?: boolean | null;
  call_success?: boolean | null;
  interested_lead?: boolean | null;
  disqualified?: boolean | null;
  call_duration_quality?: string | null;
  retry_required?: boolean | null;
};

export async function getCallLogDetail(sb: SB, callId: string): Promise<CallLogDetail | null> {
  // Fetch from raw table to get the full 30+ AI extraction field set, plus a
  // small join to active leads for lead_name/phone/ls_prospect_id/lead_stage.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: cl } = await (sb as any)
    .from('upgrad_call_logs')
    .select('*')
    .eq('call_id', callId)
    .maybeSingle();
  if (!cl) return null;

  const { data: lead } = cl.customer_id
    ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (sb as any)
        .from('upgrad_active_leads')
        .select('first_name, name, phone, ls_prospect_id, lead_stage, total_attempts')
        .eq('id', cl.customer_id)
        .maybeSingle()
    : { data: null };

  return {
    ...cl,
    lead_name: lead?.first_name ?? lead?.name ?? null,
    lead_phone: lead?.phone ?? cl.phone ?? null,
    ls_prospect_id: lead?.ls_prospect_id ?? null,
    lead_stage: lead?.lead_stage ?? null,
    total_attempts: lead?.total_attempts ?? null
  } as CallLogDetail;
}

export async function getCallLogLsHistory(sb: SB, callId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb as any)
    .from('upgrad_ls_sync_log')
    .select('id, action, success, response_status, error_message, created_at, attempt_number')
    .eq('call_id', callId)
    .order('created_at', { ascending: false });
  return (data ?? []) as Array<{
    id: string;
    action: string;
    success: boolean;
    response_status: number | null;
    error_message: string | null;
    created_at: string;
    attempt_number: number | null;
  }>;
}

// ─── Quality & QA ───────────────────────────────────────────────────────────
export async function getFlaggedCalls(sb: SB, limit = 50) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb as any)
    .from('v_admin_call_logs')
    .select(
      'call_id, call_start, lead_name, lead_phone, call_status, duration_seconds, ' +
        'enquiry_classification, flagged_reason, flagged_by, flagged_at, flagged_source'
    )
    .eq('call_flagged', true)
    .order('flagged_at', { ascending: false, nullsFirst: false })
    .limit(limit);
  return data ?? [];
}

export async function getMalfunctionCalls(sb: SB, limit = 50) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb as any)
    .from('v_admin_call_logs')
    .select(
      'call_id, call_start, lead_name, lead_phone, call_status, duration_seconds, ' +
        'enquiry_classification, agent_malfunction_details'
    )
    .eq('agent_malfunction', true)
    .order('call_start', { ascending: false, nullsFirst: false })
    .limit(limit);
  return data ?? [];
}

export async function getDndDetections(sb: SB, lastNDays = 7, limit = 100) {
  const since = new Date(Date.now() - lastNDays * 24 * 60 * 60 * 1000).toISOString();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb as any)
    .from('v_admin_call_logs')
    .select('call_id, call_start, lead_name, lead_phone, duration_seconds, transcript_summary')
    .eq('dnd', true)
    .gte('call_start', since)
    // Exclude post-cleanup flagged junk
    .not('call_flagged', 'is', true)
    .order('call_start', { ascending: false, nullsFirst: false })
    .limit(limit);
  return data ?? [];
}

export type ObjectionCount = { objection: string; count: number };

export async function getTopObjections(sb: SB, lastNDays = 30): Promise<ObjectionCount[]> {
  const since = new Date(Date.now() - lastNDays * 24 * 60 * 60 * 1000).toISOString();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb as any)
    .from('upgrad_call_logs')
    .select('objections_raised')
    .not('objections_raised', 'is', null)
    .neq('objections_raised', '')
    .gte('call_start', since)
    .not('call_flagged', 'is', true);
  // Aggregate in JS — objections_raised is comma-separated text.
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
    .slice(0, 15);
}

export async function getAvgDurationByStage(sb: SB) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb as any)
    .from('v_admin_call_logs')
    .select('lead_stage, duration_seconds')
    .not('lead_stage', 'is', null)
    .gt('duration_seconds', 0)
    .not('call_flagged', 'is', true);
  const acc = new Map<string, { total: number; n: number }>();
  for (const r of (data ?? []) as { lead_stage: string; duration_seconds: number }[]) {
    const e = acc.get(r.lead_stage) ?? { total: 0, n: 0 };
    e.total += r.duration_seconds;
    e.n += 1;
    acc.set(r.lead_stage, e);
  }
  return Array.from(acc.entries())
    .map(([stage, { total, n }]) => ({
      stage,
      avg_seconds: Math.round(total / n),
      calls: n
    }))
    .sort((a, b) => b.calls - a.calls);
}

export async function getConversationDepthDist(sb: SB) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb as any)
    .from('upgrad_call_logs')
    .select('conversation_depth')
    .not('conversation_depth', 'is', null)
    .not('call_flagged', 'is', true);
  const counts = new Map<string, number>();
  for (const r of (data ?? []) as { conversation_depth: string | null }[]) {
    if (!r.conversation_depth) continue;
    counts.set(r.conversation_depth, (counts.get(r.conversation_depth) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([depth, count]) => ({ depth, count }))
    .sort((a, b) => b.count - a.count);
}

export async function getWrongNumberRate(sb: SB, lastNDays = 30) {
  const since = new Date(Date.now() - lastNDays * 24 * 60 * 60 * 1000).toISOString();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb as any)
    .from('upgrad_call_logs')
    .select('disqualification_reason')
    .gte('call_start', since)
    .not('call_flagged', 'is', true);
  let total = 0;
  let wrong = 0;
  for (const r of (data ?? []) as { disqualification_reason: string | null }[]) {
    total += 1;
    if (r.disqualification_reason && /wrong\s*number/i.test(r.disqualification_reason)) wrong += 1;
  }
  return { total, wrong, rate_pct: total === 0 ? 0 : Math.round((1000 * wrong) / total) / 10 };
}

// ─── LS integration ────────────────────────────────────────────────────────
export type LsHealthBucket = {
  hour: string;
  action: string;
  total: number;
  succeeded: number;
  failed: number;
  success_pct: number;
};

export async function getLsHealth(sb: SB, hours = 24): Promise<LsHealthBucket[]> {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb as any)
    .from('v_admin_ls_health')
    .select('*')
    .gte('hour', since)
    .order('hour', { ascending: true });
  return (data ?? []) as LsHealthBucket[];
}

export type LsFailureRow = {
  id: string;
  action: string;
  ls_prospect_id: string | null;
  call_id: string | null;
  response_status: number | null;
  error_message: string | null;
  attempt_number: number | null;
  created_at: string;
};

export async function getRecentLsFailures(sb: SB, limit = 100): Promise<LsFailureRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb as any)
    .from('upgrad_ls_sync_log')
    .select('id, action, ls_prospect_id, call_id, response_status, error_message, attempt_number, created_at')
    .eq('success', false)
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data ?? []) as LsFailureRow[];
}

export async function getStaleUnpushedLeads(sb: SB, limit = 100) {
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb as any)
    .from('upgrad_active_leads')
    .select('id, ls_prospect_id, first_name, name, phone, lead_stage, updated_at, total_attempts')
    .eq('pushed_to_crm', false)
    .not('lead_stage', 'is', null)
    .lt('updated_at', thirtyMinAgo)
    .order('updated_at', { ascending: true })
    .limit(limit);
  return data ?? [];
}

export type LsPushStats = { total_24h: number; succeeded_24h: number; success_pct: number };

export async function getLsPushStats24h(sb: SB): Promise<LsPushStats> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb as any)
    .from('upgrad_ls_sync_log')
    .select('success')
    .gte('created_at', since);
  const rows = (data ?? []) as { success: boolean }[];
  const total = rows.length;
  const succeeded = rows.filter((r) => r.success).length;
  return {
    total_24h: total,
    succeeded_24h: succeeded,
    success_pct: total === 0 ? 0 : Math.round((1000 * succeeded) / total) / 10
  };
}
