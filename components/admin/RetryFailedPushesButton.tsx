'use client';

import { useState, useTransition } from 'react';
import { Loader2, RotateCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { retryFailedLsPushes } from '@/lib/queries/mutations';

export function RetryFailedPushesButton() {
  const [pending, startTransition] = useTransition();
  const [lastResult, setLastResult] = useState<string | null>(null);

  function onClick() {
    startTransition(async () => {
      const r = await retryFailedLsPushes();
      setLastResult(r.message);
      if (r.ok) toast.success(r.message);
      else toast.error(r.message);
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Button size="sm" variant="outline" onClick={onClick} disabled={pending} className="gap-1.5">
        {pending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <RotateCw className="size-3.5" />
        )}
        Retry Failed Pushes
      </Button>
      {lastResult && (
        <span className="text-[10px] text-muted-foreground">{lastResult}</span>
      )}
    </div>
  );
}
