// Recording proxy. SPEC.md §8.2.2 + §10.2.
//
// Two delivery paths depending on call age:
//
//   (a) Calls on/after RECORDING_CLIENT_CUTOFF (IST) — redirect to the Azure
//       blob container. Every authenticated user (client + admin) can play.
//       From 2026-06-07 the platform writes a copy of every conversation to
//       upgradsotm5037 → campaign-recordings/<call_id>, so we just hand the
//       browser the public URL and let it stream directly.
//
//   (b) Older calls — admin/super_admin only. Falls back to a stored
//       `recording_url` on the call row (presigned), or to the ElevenLabs
//       Conversational AI audio endpoint when the call_id matches an 11labs
//       conversation_id.

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
    .select('call_id, call_start, recording_url, platform')
    .eq('call_id', call_id)
    .maybeSingle();

  if (!row) {
    return NextResponse.json({ error: 'Call not found' }, { status: 404 });
  }

  const callStart = row.call_start ? new Date(row.call_start as string) : null;
  const isPostCutoff =
    callStart !== null && callStart.getTime() >= RECORDING_CLIENT_CUTOFF_UTC.getTime();

  // (a) New calls — Azure-hosted recording, accessible to any authenticated
  // user. We return the URL as JSON (not a 302) so the browser can wire it
  // straight into an <audio> element; that avoids streaming the bytes back
  // through the dashboard and dodges any CORS issues on a fetch-then-blob path.
  if (isPostCutoff) {
    return NextResponse.json(
      { url: `${AZURE_BLOB_BASE}/${encodeURIComponent(call_id)}` },
      { status: 200, headers: { 'cache-control': 'private, no-store' } }
    );
  }

  // (b) Older calls — admin+ only. Clients see a friendly access message.
  if (!roleHasAtLeast(user.role, 'admin')) {
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
