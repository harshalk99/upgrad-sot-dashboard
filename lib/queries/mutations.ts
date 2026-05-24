// Server actions for admin mutations. SPEC.md "All database queries go through
// lib/queries/{client,admin,super,mutations}.ts — never inline in pages".
//
// These are tagged with 'use server' so they can be invoked from client components
// via <form action={...}> or from server components via direct call.
'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireAdmin, requireSuperAdmin } from '@/lib/auth/requireRole';

export type TriggerResult =
  | { ok: true; message: string; status: number }
  | { ok: false; message: string; status?: number };

/** Fire a workflow webhook by key. Returns success/failure for inline UI display
 *  and writes an audit entry to dashboard_webhook_triggers. */
export async function triggerWorkflow(
  workflowKey: string,
  payload?: Record<string, unknown>
): Promise<TriggerResult> {
  const user = await requireAdmin();
  const sb = await createSupabaseServerClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: wh, error } = await (sb as any)
    .from('dashboard_workflow_webhooks')
    .select('workflow_key, webhook_url, http_method, default_payload, is_active')
    .eq('workflow_key', workflowKey)
    .maybeSingle();

  if (error || !wh) {
    return { ok: false, message: `Workflow "${workflowKey}" not configured` };
  }
  if (!wh.is_active) {
    return { ok: false, message: `Workflow "${workflowKey}" is disabled` };
  }
  if (!wh.webhook_url) {
    return {
      ok: false,
      message: `Workflow "${workflowKey}" has no webhook URL configured`
    };
  }

  const finalPayload = { ...(wh.default_payload ?? {}), ...(payload ?? {}) };
  const method = (wh.http_method ?? 'POST').toUpperCase();
  const secret = process.env.N8N_WEBHOOK_SECRET;

  let resp: Response;
  let bodyText = '';
  try {
    resp = await fetch(wh.webhook_url as string, {
      method,
      headers: {
        'content-type': 'application/json',
        ...(secret ? { 'x-webhook-secret': secret } : {})
      },
      body: method === 'GET' ? undefined : JSON.stringify(finalPayload),
      cache: 'no-store'
    });
    bodyText = await resp.text();
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Network error';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (sb as any).from('dashboard_webhook_triggers').insert({
      workflow_key: workflowKey,
      triggered_by: user.id,
      payload_sent: finalPayload,
      response_status: null,
      response_body: message,
      success: false
    });
    return { ok: false, message };
  }

  const ok = resp.status >= 200 && resp.status < 300;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (sb as any).from('dashboard_webhook_triggers').insert({
    workflow_key: workflowKey,
    triggered_by: user.id,
    payload_sent: finalPayload,
    response_status: resp.status,
    response_body: bodyText.slice(0, 2000),
    success: ok
  });

  // Update last_triggered_* on the webhook config row
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (sb as any)
    .from('dashboard_workflow_webhooks')
    .update({ last_triggered_at: new Date().toISOString(), last_triggered_by: user.id })
    .eq('workflow_key', workflowKey);

  return ok
    ? { ok: true, message: `Triggered ${workflowKey}`, status: resp.status }
    : { ok: false, message: `Workflow returned ${resp.status}`, status: resp.status };
}

/** /admin/ls-integration → Retry Failed Pushes button. Calls trigger_egress workflow. */
export async function retryFailedLsPushes(): Promise<TriggerResult> {
  const result = await triggerWorkflow('trigger_egress', { reason: 'manual_retry' });
  revalidatePath('/admin/ls-integration');
  return result;
}

// ─── Manual lead-stage override (super_admin only) ─────────────────────────
// Per UGSOT request 2026-05-25: super_admin should be able to reclassify any
// lead from the leads table via a per-row dropdown. We:
//   1. Verify the actor is super_admin (server-side, can't be spoofed)
//   2. Look up which table the lead lives in (active vs archived)
//   3. UPDATE lead_stage
//   4. Write an audit row to dashboard_lead_stage_changes
//   5. Revalidate the pages that show stage counts

export const VALID_LEAD_STAGES = [
  'AI Bot Qualified - High Intent',
  'AI Bot Qualified - Warm',
  'AI Bot Qualified - Low Interest',
  'AI Bot Called - Not Interested',
  'AI Bot Called - Not Eligible',
  'AI Bot Reached - DNP',
  'AI Bot Reached - CB Later',
  'AI Bot Sent - Payment Link',
  'AI Bot Sent - Brochure'
] as const;

export type LeadStageValue = (typeof VALID_LEAD_STAGES)[number];

export type StageUpdateResult =
  | { ok: true; previousStage: string | null; newStage: LeadStageValue }
  | { ok: false; error: string };

export async function updateLeadStageManually(
  leadId: string,
  newStage: LeadStageValue,
  reason?: string
): Promise<StageUpdateResult> {
  let user;
  try {
    user = await requireSuperAdmin();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Forbidden' };
  }

  if (!VALID_LEAD_STAGES.includes(newStage)) {
    return { ok: false, error: `Invalid stage: ${newStage}` };
  }
  if (!leadId || typeof leadId !== 'string') {
    return { ok: false, error: 'Missing leadId' };
  }

  const sb = await createSupabaseServerClient();

  // Find which table the lead lives in + capture the current stage
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: active } = await (sb as any)
    .from('upgrad_active_leads')
    .select('id, lead_stage, ls_prospect_id')
    .eq('id', leadId)
    .maybeSingle();

  let table: 'upgrad_active_leads' | 'upgrad_archived_leads' = 'upgrad_active_leads';
  let previousStage: string | null = active?.lead_stage ?? null;
  let lsProspectId: string | null = active?.ls_prospect_id ?? null;
  let isArchived = false;

  if (!active) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: archived } = await (sb as any)
      .from('upgrad_archived_leads')
      .select('id, lead_stage, ls_prospect_id')
      .eq('id', leadId)
      .maybeSingle();
    if (!archived) return { ok: false, error: 'Lead not found' };
    table = 'upgrad_archived_leads';
    previousStage = archived.lead_stage ?? null;
    lsProspectId = archived.ls_prospect_id ?? null;
    isArchived = true;
  }

  if (previousStage === newStage) {
    // No-op — return success without writing anything
    return { ok: true, previousStage, newStage };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateErr } = await (sb as any)
    .from(table)
    .update({ lead_stage: newStage })
    .eq('id', leadId);

  if (updateErr) {
    return { ok: false, error: updateErr.message };
  }

  // Audit log — fire and forget; don't fail the user-visible action if it errors
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (sb as any).from('dashboard_lead_stage_changes').insert({
    lead_id: leadId,
    ls_prospect_id: lsProspectId,
    is_archived: isArchived,
    previous_stage: previousStage,
    new_stage: newStage,
    changed_by: user.id,
    changed_by_email: user.email ?? null,
    reason: reason ?? null
  });

  // Revalidate pages whose counts depend on lead_stage
  revalidatePath('/dashboard');
  revalidatePath('/dashboard/dispositions');
  revalidatePath('/dashboard/leads');
  revalidatePath('/dashboard/connectivity');
  // Drill-down paths use dynamic segments; revalidate the layout-level path
  revalidatePath('/dashboard/dispositions/[stage]', 'page');

  return { ok: true, previousStage, newStage };
}
