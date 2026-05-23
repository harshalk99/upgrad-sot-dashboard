'use client';

// Manual page-data refresh. Calls router.refresh() which re-runs all Server
// Components for the current route, pulling fresh data from Supabase without
// a full browser reload. No auto-polling — only fires when the user clicks.
import { useState, useTransition } from 'react';
import { RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function RefreshButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [spin, setSpin] = useState(false);

  function handleRefresh() {
    setSpin(true);
    startTransition(() => {
      router.refresh();
    });
    // Keep icon spinning for at least 600 ms so the click feels acknowledged
    setTimeout(() => setSpin(false), 600);
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleRefresh}
      disabled={isPending}
      className="gap-1.5 text-xs"
      title="Refresh data"
    >
      <RefreshCw
        className={cn('size-3.5', (isPending || spin) && 'animate-spin')}
      />
      Refresh
    </Button>
  );
}
