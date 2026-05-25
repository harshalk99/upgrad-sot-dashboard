'use client';

// LeadStageDropdown — per-row manual override of a lead's lead_stage.
// Only super_admin sees this; everyone else sees the stage as a static badge.
//
// Calls the `updateLeadStageManually` server action which enforces role-check
// server-side and writes an audit row to dashboard_lead_stage_changes.
//
// UX: optimistic update on select, spinner while saving, rollback + toast on error.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { updateLeadStageManually } from '@/lib/queries/mutations';
import { VALID_LEAD_STAGES, type LeadStageValue } from '@/lib/lead-stage-constants';

type Props = {
  leadId: string;
  currentStage: string;
  /** Tailwind classes applied to the static badge OR the select. Keep parity with
   *  the read-only stage badge so the row layout doesn't shift. */
  className?: string;
};

export function LeadStageDropdown({ leadId, currentStage, className }: Props) {
  const router = useRouter();
  const [stage, setStage] = useState<string>(currentStage);
  const [pending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    e.stopPropagation();
    const next = e.target.value as LeadStageValue;
    if (next === stage) return;
    const prev = stage;
    setStage(next); // optimistic
    startTransition(async () => {
      const result = await updateLeadStageManually(leadId, next);
      if (!result.ok) {
        setStage(prev); // rollback
        toast.error(result.error);
        return;
      }
      toast.success(
        `Moved to "${next.replace(/^AI Bot /, '')}"${
          result.previousStage ? ` from "${result.previousStage.replace(/^AI Bot /, '')}"` : ''
        }`
      );
      // The server action already revalidated the relevant paths; refresh to
      // pull the new disposition counts into this page.
      router.refresh();
    });
  }

  return (
    <span
      className={cn('inline-flex items-center gap-1.5', className)}
      onClick={(e) => e.stopPropagation()}
    >
      <select
        value={stage}
        onChange={handleChange}
        disabled={pending}
        className={cn(
          'h-7 max-w-full rounded-md border border-input bg-background px-1.5 py-0.5 text-[11px]',
          'truncate font-medium hover:bg-muted/50',
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          pending && 'opacity-60 cursor-wait'
        )}
        title={`Change stage (current: ${stage})`}
      >
        {VALID_LEAD_STAGES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
        {/* If the lead's current stage isn't in the canonical list (e.g. "Not Yet
            Called"), show it as a disabled option so the dropdown still reflects
            reality before any change. */}
        {!(VALID_LEAD_STAGES as readonly string[]).includes(stage) && (
          <option value={stage} disabled>
            {stage} (legacy)
          </option>
        )}
      </select>
      {pending && <Loader2 className="size-3 animate-spin text-muted-foreground" />}
    </span>
  );
}
