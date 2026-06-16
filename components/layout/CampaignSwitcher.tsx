'use client';

// CampaignSwitcher — dropdown in the header bar that controls which
// campaign's data the dashboard renders. URL-driven via `?c=<campaign_id>`
// so the choice survives route changes and refreshes.
//
// Visibility/options come from the server (page passes `allowedCampaigns`
// resolved from the user's scope) — this client component is purely UI.

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';

export type CampaignOption = { campaign_id: string; display_name: string };

type Props = {
  /** Currently active campaign_id from the URL (`?c=`), or null for "All campaigns". */
  current: string | null;
  /** Options visible to this user. Empty list means there's nothing to switch — render nothing. */
  options: CampaignOption[];
  /** True for super_admin — show an "All campaigns" aggregate option. */
  allowAggregate: boolean;
};

const ALL_VALUE = '__all__';

export function CampaignSwitcher({ current, options, allowAggregate }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Nothing to switch.
  if (!allowAggregate && options.length <= 1) {
    const only = options[0];
    if (!only) return null;
    return (
      <div className="hidden items-center gap-1 rounded-md border border-border/60 px-3 py-1.5 text-xs text-muted-foreground sm:inline-flex">
        <span className="font-mono uppercase tracking-widest text-[10px]">Campaign</span>
        <span className="font-medium text-foreground">{only.display_name}</span>
      </div>
    );
  }

  const activeKey = current ?? (allowAggregate ? ALL_VALUE : options[0]?.campaign_id);
  const activeLabel = useMemo(() => {
    if (current) {
      return options.find((o) => o.campaign_id === current)?.display_name ?? current;
    }
    if (allowAggregate) return 'All campaigns';
    return options[0]?.display_name ?? '—';
  }, [current, options, allowAggregate]);

  function selectCampaign(value: string) {
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    if (value === ALL_VALUE) {
      params.delete('c');
    } else {
      params.set('c', value);
    }
    const qs = params.toString();
    router.push(`${pathname}${qs ? `?${qs}` : ''}`);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-2 px-3 text-xs font-medium"
            aria-label="Switch campaign"
          />
        }
      >
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Campaign
        </span>
        <span className="truncate max-w-[180px]">{activeLabel}</span>
        <ChevronDown className="size-3 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[220px]">
        {allowAggregate && (
          <>
            <DropdownMenuItem
              onClick={() => selectCampaign(ALL_VALUE)}
              className="flex items-center justify-between gap-2"
            >
              <span>All campaigns</span>
              {activeKey === ALL_VALUE && <Check className="size-3.5 text-foreground" />}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        {options.map((o) => (
          <DropdownMenuItem
            key={o.campaign_id}
            onClick={() => selectCampaign(o.campaign_id)}
            className="flex items-center justify-between gap-2"
          >
            <span className="truncate">{o.display_name}</span>
            {activeKey === o.campaign_id && <Check className="size-3.5 text-foreground" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
