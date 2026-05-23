// MaintenanceBanner — SPEC.md §9.2.
// Server component that reads the singleton `dashboard_maintenance_notice` row.
// Renders nothing if !is_active. Color by severity. Always visible to clients.
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { AlertTriangle, Info, OctagonAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

export async function MaintenanceBanner() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('dashboard_maintenance_notice')
    .select('is_active, message, severity')
    .eq('id', 1)
    .maybeSingle();

  if (!data?.is_active || !data.message) return null;

  const severity = (data.severity ?? 'info') as 'info' | 'warning' | 'critical';
  const Icon =
    severity === 'critical' ? OctagonAlert : severity === 'warning' ? AlertTriangle : Info;

  return (
    <div
      className={cn(
        'flex items-start gap-3 border-b px-6 py-3 text-sm',
        severity === 'info' &&
          'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100',
        severity === 'warning' &&
          'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100',
        severity === 'critical' &&
          'border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100'
      )}
      role="status"
      aria-live="polite"
    >
      <Icon className="mt-0.5 size-4 shrink-0" />
      <p className="flex-1">{data.message}</p>
    </div>
  );
}
