// Recording proxy — streams call audio from ElevenLabs back to the browser
// without ever exposing the API key. SPEC.md §8.2.2 "RecordingPlayer using
// recording_url or 11Labs API proxy" + "Admin+ only".
//
// Flow:
//   1. Browser asks GET /api/admin/recording/<call_id>
//   2. We auth-gate to admin+, look up the call row, and either
//      (a) redirect to a stored recording_url, OR
//      (b) fetch from 11Labs /v1/convai/conversations/<id>/audio with our API key
//   3. Stream the bytes back, forwarding Range/Content-Type headers so HTMLMediaElement
//      can seek.

import { type NextRequest, NextResponse } from 'next/server';
import { requireAdmin, AuthError } from '@/lib/auth/requireRole';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
// Cache-bust per call — recordings don't change but we don't want Next prerendering.
export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ call_id: string }> }
) {
  try {
    await requireAdmin();
  } catch (e) {
    if (e instanceof AuthError) {
      // User-facing copy — "Requires admin role" leaks internal vocabulary.
      const msg =
        e.status === 403
          ? 'Recording playback is restricted to authorised users.'
          : e.message;
      return NextResponse.json({ error: msg }, { status: e.status });
    }
    throw e;
  }

  const { call_id } = await params;
  if (!call_id) {
    return NextResponse.json({ error: 'Missing call_id' }, { status: 400 });
  }

  const sb = await createSupabaseServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: row } = await (sb as any)
    .from('upgrad_call_logs')
    .select('call_id, recording_url, platform')
    .eq('call_id', call_id)
    .maybeSingle();

  if (!row) {
    return NextResponse.json({ error: 'Call not found' }, { status: 404 });
  }

  // (a) If we already have a direct recording URL stored, redirect (presigned URL etc.)
  if (row.recording_url) {
    return NextResponse.redirect(row.recording_url as string, 302);
  }

  // (b) Otherwise fall back to the ElevenLabs Conversational AI audio endpoint.
  // The call_id matches the 11Labs conversation_id for 11labs-platform calls.
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
      // Forward Range so the audio element can seek.
      ...(req.headers.get('range') ? { Range: req.headers.get('range')! } : {})
    },
    // Don't let Next cache audio responses.
    cache: 'no-store'
  });

  if (!upstream.ok || !upstream.body) {
    return NextResponse.json(
      { error: `Upstream returned ${upstream.status}` },
      { status: upstream.status === 404 ? 404 : 502 }
    );
  }

  // Forward useful headers
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
  // Force a strict no-cache so a flagged call's audio isn't held in a CDN.
  headers.set('cache-control', 'private, no-store');

  return new NextResponse(upstream.body, {
    status: upstream.status, // 200 or 206
    headers
  });
}
