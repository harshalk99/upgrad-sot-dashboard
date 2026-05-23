'use client';

// TranscriptViewer — renders transcripts in two modes:
//   1. JSON array of turns (11Labs format: [{role, message, time_in_call_secs}…])
//   2. Plain text block (sarvam / fallback)
// Collapsible; first 6 turns visible by default.
//
// SPEC.md §8.2.2 "TranscriptViewer (collapsible turns)".

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type Turn = { role: string; message: string; time_in_call_secs?: number | null };

function parseTranscript(raw: string | null | undefined): Turn[] | string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed) && parsed.length > 0 && 'role' in parsed[0]) {
        return parsed as Turn[];
      }
      if (Array.isArray(parsed?.turns)) return parsed.turns as Turn[];
      // JSON but not the shape we want — fall through to plain
    } catch {
      // not JSON; treat as plain text
    }
  }
  return trimmed;
}

function fmtTime(s?: number | null): string {
  if (s == null) return '';
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, '0')}`;
}

export function TranscriptViewer({ transcript }: { transcript: string | null | undefined }) {
  const parsed = useMemo(() => parseTranscript(transcript), [transcript]);
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!parsed) {
    return <div className="text-xs text-muted-foreground">No transcript captured.</div>;
  }

  function copyAll() {
    const text =
      typeof parsed === 'string'
        ? parsed
        : (parsed as Turn[])
            .map((t) => `[${fmtTime(t.time_in_call_secs)}] ${t.role}: ${t.message}`)
            .join('\n');
    navigator.clipboard.writeText(text).then(
      () => {
        setCopied(true);
        toast.success('Transcript copied');
        setTimeout(() => setCopied(false), 1200);
      },
      () => toast.error('Could not copy')
    );
  }

  if (typeof parsed === 'string') {
    const truncated = !expanded && parsed.length > 800;
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={copyAll}
            className="inline-flex items-center gap-1 rounded p-1 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Copy full transcript"
          >
            {copied ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
            Copy
          </button>
        </div>
        <p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-foreground/90">
          {truncated ? `${parsed.slice(0, 800)}…` : parsed}
        </p>
        {parsed.length > 800 && (
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="inline-flex items-center gap-1 text-[10px] text-sky-600 hover:underline"
          >
            {expanded ? (
              <>
                <ChevronUp className="size-3" /> Show less
              </>
            ) : (
              <>
                <ChevronDown className="size-3" /> Show full transcript ({parsed.length} chars)
              </>
            )}
          </button>
        )}
      </div>
    );
  }

  const turns = parsed as Turn[];
  const visible = expanded ? turns : turns.slice(0, 6);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
          {turns.length} turns
        </div>
        <button
          type="button"
          onClick={copyAll}
          className="inline-flex items-center gap-1 rounded p-1 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
          title="Copy full transcript"
        >
          {copied ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
          Copy
        </button>
      </div>
      <ol className="space-y-2">
        {visible.map((t, i) => {
          const isAgent = /agent|bot|assistant|ai/i.test(t.role);
          return (
            <li
              key={i}
              className={cn(
                'rounded-md border p-2.5',
                isAgent
                  ? 'border-sky-200 bg-sky-50/50 dark:border-sky-900 dark:bg-sky-950/30'
                  : 'border-border/60 bg-background'
              )}
            >
              <div className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
                <span className={cn(isAgent && 'text-sky-700 dark:text-sky-300')}>
                  {t.role}
                </span>
                {t.time_in_call_secs != null && (
                  <span className="font-mono">{fmtTime(t.time_in_call_secs)}</span>
                )}
              </div>
              <p className="break-words text-xs leading-relaxed">{t.message}</p>
            </li>
          );
        })}
      </ol>
      {turns.length > 6 && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="inline-flex items-center gap-1 text-[10px] text-sky-600 hover:underline"
        >
          {expanded ? (
            <>
              <ChevronUp className="size-3" /> Collapse
            </>
          ) : (
            <>
              <ChevronDown className="size-3" /> Show all {turns.length} turns
            </>
          )}
        </button>
      )}
    </div>
  );
}
