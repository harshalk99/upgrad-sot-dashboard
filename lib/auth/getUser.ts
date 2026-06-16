// Resolve current user + role + scopes from the server-side Supabase session.
// Use inside Server Components and Route Handlers.
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { UserRole } from '@/lib/auth/userRole';

export type CurrentUser = {
  id: string;
  email: string | null;
  role: UserRole;
  displayName: string | null;
  organization: string | null;
  /** Campaign IDs this user can see. Undefined for super_admin = all non-excluded. */
  campaignScope?: string[];
  /** data_source_name allowlist for digital_partner. Undefined = no source restriction. */
  sourceScope?: string[];
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const [{ data: roleRow }, { data: campaignRows }, { data: scopeRow }] = await Promise.all([
    sb
      .from('dashboard_user_roles')
      .select('role, display_name, organization')
      .eq('user_id', user.id)
      .single(),
    sb
      .from('dashboard_user_campaigns')
      .select('campaign_id')
      .eq('user_id', user.id),
    sb
      .from('dashboard_user_source_scopes')
      .select('allowed_data_source_names')
      .eq('user_id', user.id)
      .maybeSingle()
  ]);

  if (!roleRow) return null;

  const campaignScope =
    Array.isArray(campaignRows) && campaignRows.length > 0
      ? (campaignRows as { campaign_id: string }[]).map((r) => r.campaign_id)
      : undefined;

  const sourceScope =
    scopeRow && Array.isArray(scopeRow.allowed_data_source_names)
      ? (scopeRow.allowed_data_source_names as string[])
      : undefined;

  return {
    id: user.id,
    email: user.email ?? null,
    role: roleRow.role as UserRole,
    displayName: roleRow.display_name,
    organization: roleRow.organization,
    campaignScope,
    sourceScope
  };
}
