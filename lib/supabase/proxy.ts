// Supabase client for use inside the root proxy.ts (Next 16's renamed middleware).
// Refreshes auth tokens on every request and exposes cookie write hooks.
//
// NOTE (Next 16 deviation from SPEC.md §6):
//   - File at root is now `proxy.ts`, not `middleware.ts`.
//   - Runtime is nodejs only (no edge).
//   - The helper module name is also `proxy.ts` for parity with the root file.
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/types/supabase';

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        }
      }
    }
  );

  // IMPORTANT: getUser() refreshes the session and returns the authenticated user.
  // Do not modify code between createServerClient() and getUser().
  const {
    data: { user }
  } = await supabase.auth.getUser();

  return { supabase, response, user };
}
