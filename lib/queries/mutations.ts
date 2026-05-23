// Server actions for admin mutations. SPEC.md "All database queries go through
// lib/queries/{client,admin,super,mutations}.ts — never inline in pages".
//
// These are tagged with 'use server' so they can be invoked from client components
// via <form action={...}> or from server components via direct call.
'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/requireRole';

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
