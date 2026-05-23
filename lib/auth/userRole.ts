// Role utilities. SPEC.md §2 — exact role names matter (lowercase, underscore).
export type UserRole = 'client' | 'admin' | 'super_admin';

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  client: 1,
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
    default:
      return '/dashboard';
  }
}
