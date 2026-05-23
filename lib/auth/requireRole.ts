// Guard helpers for Route Handlers. Throw 401/403 NextResponse if the
// current session does not satisfy the required role.
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/getUser';
import { roleHasAtLeast, type UserRole } from '@/lib/auth/userRole';

export class AuthError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function requireRole(min: UserRole) {
  const user = await getCurrentUser();
  if (!user) {
    throw new AuthError(401, 'Not authenticated');
  }
  if (!roleHasAtLeast(user.role, min)) {
    throw new AuthError(403, `Requires ${min} role`);
  }
  return user;
}

export const requireAdmin = () => requireRole('admin');
export const requireSuperAdmin = () => requireRole('super_admin');

/** Wrap a Route Handler body to convert AuthError → JSON response. */
export function withAuthError<T extends (...a: unknown[]) => Promise<Response>>(fn: T) {
  return async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof AuthError) {
        return NextResponse.json({ error: e.message }, { status: e.status });
      }
      throw e;
    }
  };
}
