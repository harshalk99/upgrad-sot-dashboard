'use client';

// AutoRefresh — calls router.refresh() on an interval to revalidate Server Component
// data without a full reload. Used on /admin (30s) for real-time health.
//
// Why a client wrapper: Next.js Server Components don't have setInterval. This is the
// minimal client island that nudges the server to re-fetch. Cheaper than streaming
// or React Query — we already have the data on the server.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pause, Play, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Props = {
  /** Interval in milliseconds. Default 30s per SPEC §8.2.1. */
  intervalMs?: number;
  /** Label shown to user (e.g. "Auto-refresh every 30s"). */
  label?: string;
};

export function AutoRefresh({ intervalMs = 30_000, label }: Props) {
  const router = useRouter();
  const [paused, setPaused] = useState(false);
  const [lastTick, setLastTick] = useState<Date>(new Date());

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      router.refresh();
      setLastTick(new Date());
    }, intervalMs);
    return () => clearInterval(id);
  }, [paused, intervalMs, router]);

  const seconds = Math.round(intervalMs / 1000);
  const lbl = label ?? `Auto-refresh every ${seconds}s`;

  return (
    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <span
          className={cn(
            'size-1.5 rounded-full',
            paused ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse'
          )}
        />
        {paused ? 'Paused' : lbl}
      </span>
      <Button
        size="sm"
        variant="ghost"
        className="h-7 gap-1.5 px-2"
        onClick={() => {
          router.refresh();
          setLastTick(new Date());
        }}
        title="Refresh now"
      >
        <RefreshCw className="size-3.5" />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="h-7 gap-1.5 px-2"
        onClick={() => setPaused((p) => !p)}
        title={paused ? 'Resume auto-refresh' : 'Pause auto-refresh'}
      >
        {paused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
      </Button>
      <span className="hidden text-[10px] tabular-nums md:inline">
        Last: {lastTick.toLocaleTimeString('en-IN', { hour12: false })}
      </span>
    </div>
  );
}
