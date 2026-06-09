// Recording proxy. SPEC.md §8.2.2 + §10.2.
//
// Access rules:
//
//   Admin / super_admin   can play any recording on any call.
//   Client                can play a recording only if BOTH:
//                           1. the call's lead is Hot, Warm, or CB Later
//                              (AI Bot Qualified - High Intent | - Warm |
//                               AI Bot Reached - CB Later), AND
//                           2. the call is on/after RECORDING_CLIENT_CUTOFF
//                              (2026-06-07 IST — when the platform started
//                              writing copies to the Azure blob container).
//
// Delivery paths:
//
//   (a) Calls on/after the cutoff — return the Azure blob URL as JSON; the
//       browser plays it directly via <audio>. Skips the dashboard for bytes
//       and avoids CORS on a fetch-then-blob path.
//   (b) Pre-cutoff calls (admin only) — fall back to a stored recording_url
//       on the call row (presigned), or proxy the ElevenLabs Conversational
//       AI audio endpoint when the call_id matches an 11labs conversation_id.

import { type NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/getUser';
import { roleHasAtLeast } from '@/lib/auth/userRole';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Cutoff at 2026-06-07 00:00 IST. Stored as UTC for direct comparison with
// timestamptz columns (Asia/Kolkata = UTC+05:30, so 06-07 00:00 IST = 06-06 18:30 UTC).
const RECORDING_CLIENT_CUTOFF_UTC = new Date('2026-06-06T18:30:00Z');

const AZURE_BLOB_BASE =
  'https://upgradsotm5037.blob.core.windows.net/campaign-recordings';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ call_id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { call_id } = await params;
  if (!call_id) {
    return NextResponse.json({ error: 'Missing call_id' }, { status: 400 });
  }

  const sb = await createSupabaseServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: row } = await (sb as any)
    .from('upgrad_call_logs')
    .select('call_id, call_start, recording_url, platform, lead_id')
    .eq('call_id', call_id)
    .maybeSingle();

  if (!row) {
    return NextResponse.json({ error: 'Call not found' }, { status: 404 });
  }

  const isAdmin = roleHasAtLeast(user.role, 'admin');

  // For clients, recording playback is gated to high-intent leads (Hot/Warm)
  // only — we don't surface call audio for DNP / Not Interested / etc. Admins
  // bypass this restriction.
  if (!isAdmin) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sbAny = sb as any;
    const [activeRes, archivedRes] = await Promise.all([
      sbAny
        .from('upgrad_active_leads')
        .select('lead_stage')
        .eq('ls_prospect_id', row.lead_id)
        .maybeSingle(),
      sbAny
        .from('upgrad_archived_leads')
        .select('lead_stage')
        .eq('ls_prospect_id', row.lead_id)
        .maybeSingle()
    ]);
    const leadStage: string | null =
      activeRes?.data?.lead_stage ?? archivedRes?.data?.lead_stage ?? null;
    const ALLOWED = new Set([
      'AI Bot Qualified - High Intent',
      'AI Bot Qualified - Warm',
      'AI Bot Reached - CB Later'
    ]);
    if (!leadStage || !ALLOWED.has(leadStage)) {
      return NextResponse.json(
        { error: 'Recording playback is restricted to authorised users.' },
        { status: 403 }
      );
    }
  }

  const callStart = row.call_start ? new Date(row.call_start as string) : null;
  const isPostCutoff =
    callStart !== null && callStart.getTime() >= RECORDING_CLIENT_CUTOFF_UTC.getTime();

  // (a) New calls — Azure-hosted recording. The Azure container's network
  // rules allow the END USER's office static IP (the dashboard's App Service
  // IP is NOT allowlisted), so the browser must fetch the blob directly —
  // we just hand it the URL. JSON instead of a 302 so the frontend can
  // surface our friendly toast on the auth gate above before wiring audio.
  if (isPostCutoff) {
    return NextResponse.json(
      { url: `${AZURE_BLOB_BASE}/${encodeURIComponent(call_id)}` },
      { status: 200, headers: { 'cache-control': 'private, no-store' } }
    );
  }

  // (b) Older calls — admin+ only on the streaming/proxy path. Clients on
  // pre-cutoff Hot/Warm calls still 403 here because the Azure copy doesn't
  // exist for them; nothing to play.
  if (!isAdmin) {
    return NextResponse.json(
      { error: 'Recording playback is restricted to authorised users.' },
      { status: 403 }
    );
  }

  // Admin path — stored URL takes precedence, else proxy via ElevenLabs.
  if (row.recording_url) {
    return NextResponse.redirect(row.recording_url as string, 302);
  }

  if (row.platform && String(row.platform).toLowerCase() !== '11labs') {
    return NextResponse.json(
      { error: `No recording available for platform ${row.platform}` },
      { status: 404 }
    );
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'ELEVENLABS_API_KEY not configured' },
      { status: 500 }
    );
  }

  const upstreamUrl = `https://api.elevenlabs.io/v1/convai/conversations/${encodeURIComponent(
    call_id
  )}/audio`;

  const upstream = await fetch(upstreamUrl, {
    headers: {
      'xi-api-key': apiKey,
      ...(req.headers.get('range') ? { Range: req.headers.get('range')! } : {})
    },
    cache: 'no-store'
  });

  if (!upstream.ok || !upstream.body) {
    return NextResponse.json(
      { error: `Upstream returned ${upstream.status}` },
      { status: upstream.status === 404 ? 404 : 502 }
    );
  }

  const headers = new Headers();
  const passthrough = [
    'content-type',
    'content-length',
    'content-range',
    'accept-ranges',
    'cache-control'
  ];
  for (const h of passthrough) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }
  if (!headers.has('content-type')) headers.set('content-type', 'audio/mpeg');
  if (!headers.has('accept-ranges')) headers.set('accept-ranges', 'bytes');
  headers.set('cache-control', 'private, no-store');

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers
  });
}
