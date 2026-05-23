// Resolve current user + role from the server-side Supabase session.
// Use inside Server Components and Route Handlers.
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { UserRole } from '@/lib/auth/userRole';

export type CurrentUser = {
  id: string;
  email: string | null;
  role: UserRole;
  displayName: string | null;
  organization: string | null;
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: roleRow } = await supabase
    .from('dashboard_user_roles')
    .select('role, display_name, organization')
    .eq('user_id', user.id)
    .single();

  if (!roleRow) return null;

  return {
    id: user.id,
    email: user.email ?? null,
    role: roleRow.role as UserRole,
    displayName: roleRow.display_name,
    organization: roleRow.organization
  };
}
