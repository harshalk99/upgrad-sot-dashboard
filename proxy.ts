// Root proxy.ts — Next 16's renamed middleware (see version-16.md §"middleware to proxy").
// Function name MUST be `proxy`. Runtime is nodejs (no edge).
//
// Responsibilities (SPEC.md §6):
//   - Refresh Supabase auth session via @supabase/ssr.
//   - Redirect unauthenticated users to /login (except public routes).
//   - Enforce role-gated path prefixes:
//       /super     → super_admin only
//       /admin     → admin or super_admin
//       /dashboard → any authenticated role
//
// NOTE (Next 16 deviation from SPEC.md):
//   SPEC.md §6 refers to `middleware.ts`; renamed to `proxy.ts` per Next 16 upgrade docs.

import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/proxy';

const PUBLIC_PATHS = new Set(['/login', '/api/health']);

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (pathname.startsWith('/_next/')) return true;
  if (pathname === '/favicon.ico') return true;
  return false;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const { supabase, response, user } = await updateSession(request);

  if (isPublic(pathname)) return response;

  // Auth required for all other routes
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(url);
  }

  // Role gate — query the role
  const { data: roleRow } = await supabase
    .from('dashboard_user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single();

  const role = (roleRow?.role ?? null) as 'client' | 'admin' | 'super_admin' | null;

  // No role assigned → forbid (UI also shows "Access pending" on login)
  if (!role) {
    if (pathname !== '/login') {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('error', 'access_pending');
      return NextResponse.redirect(url);
    }
    return response;
  }

  // /super → super_admin only; fall back to /admin if just admin, /dashboard if client.
  if (pathname.startsWith('/super') && role !== 'super_admin') {
    const url = request.nextUrl.clone();
    url.pathname = role === 'admin' ? '/admin' : '/dashboard';
    return NextResponse.redirect(url);
  }
  // /admin → admin or super_admin only.
  if (pathname.startsWith('/admin') && role === 'client') {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }
  // /dashboard is allowed for everyone authenticated (role inheritance).

  return response;
}

export const config = {
  // Run on everything EXCEPT static assets, favicon, and files in /public/
  // with common asset extensions. Without the extension exclusion, asset
  // requests like /predixion-logo-black.png get intercepted by the auth proxy
  // and redirected to /login when the user isn't signed in.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf|otf|css|js|map)$).*)']
};
