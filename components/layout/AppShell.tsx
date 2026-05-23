// AppShell — composes Sidebar + main content area + MaintenanceBanner.
// Used by each role group's layout.tsx (client/admin/super).
import type { ReactNode } from 'react';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Sidebar } from './Sidebar';
import { MaintenanceBanner } from '@/components/dashboard/MaintenanceBanner';
import type { UserRole } from '@/lib/auth/userRole';

type Props = {
  role: UserRole;
  children: ReactNode;
};

export async function AppShell({ role, children }: Props) {
  const supabase = await createSupabaseServerClient();

  // dashboard_modules is RLS-filtered to the user's role, so we just read it.
  const { data: modules } = await supabase
    .from('dashboard_modules')
    .select('module_key')
    .order('display_order');

  const enabledModules = new Set((modules ?? []).map((m) => m.module_key));

  return (
    <div className="flex min-h-dvh">
      <Sidebar role={role} enabledModules={enabledModules} />
      <div className="flex-1 flex-col">
        <MaintenanceBanner />
        {children}
      </div>
    </div>
  );
}
