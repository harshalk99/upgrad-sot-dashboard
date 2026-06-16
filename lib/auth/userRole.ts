// Role utilities. SPEC.md §2 — exact role names matter (lowercase, underscore).
// digital_partner is a flavour of client — same client UI, scoped to a subset
// of data_source_name values via dashboard_user_source_scopes.
export type UserRole = 'client' | 'digital_partner' | 'admin' | 'super_admin';

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  client: 1,
  digital_partner: 1,
  admin: 2,
  super_admin: 3
};

export function roleHasAtLeast(role: UserRole | null, min: UserRole): boolean {
  if (!role) return false;
  return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[min];
}

export function defaultLandingForRole(role: UserRole): string {
  switch (role) {
    case 'super_admin':
      return '/super';
    case 'admin':
      return '/admin';
    case 'client':
    case 'digital_partner':
    default:
      return '/dashboard';
  }
}
