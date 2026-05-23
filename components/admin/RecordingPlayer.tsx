'use client';

// RecordingPlayer — streams audio from /api/admin/recording/[call_id].
// Native <audio> element so we get scrubbing, keyboard shortcuts, and Range
// requests for free. SPEC.md §8.2.2.

import { useState } from 'react';
import { AlertCircle, Headphones, Loader2 } from 'lucide-react';

export function RecordingPlayer({ callId }: { callId: string }) {
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const src = `/api/admin/recording/${encodeURIComponent(callId)}`;

  if (state === 'idle') {
    return (
      <button
        type="button"
        onClick={() => setState('loading')}
        className="inline-flex items-center gap-2 rounded-md border border-border/60 bg-background px-3 py-2 text-sm hover:bg-muted"
      >
        <Headphones className="size-4" />
        Load recording
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <audio
        controls
        src={src}
        preload="metadata"
        className="w-full"
        onLoadedMetadata={() => setState('ready')}
        onError={async () => {
          // Try to fetch the JSON error body so we can show a useful message.
          try {
            const r = await fetch(src);
            const j = await r.json().catch(() => null);
            setErrorMessage(j?.error ?? `Upstream returned ${r.status}`);
          } catch {
            setErrorMessage('Could not load recording');
          }
          setState('error');
        }}
      />
      {state === 'loading' && (
        <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="size-3 animate-spin" />
          Fetching audio…
        </div>
      )}
      {state === 'error' && (
        <div className="inline-flex items-center gap-1.5 rounded-md border border-red-500/40 bg-red-50 px-2 py-1 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
          <AlertCircle className="size-3" />
          {errorMessage ?? 'Recording unavailable'}
        </div>
      )}
    </div>
  );
}
