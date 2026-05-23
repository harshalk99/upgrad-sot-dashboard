// Server-side Supabase client for Server Components / Route Handlers / Server Actions.
// Reads & writes auth cookies via Next.js `cookies()` (async in Next 16).
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/supabase';

export async function createSupabaseServerClient() {
  // NOTE (Next 16 deviation from SPEC.md §6): `cookies()` is async.
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // In Server Components you cannot set cookies; suppress the error.
          // The Proxy (formerly middleware) refreshes the session for us.
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // ignore in pure Server Component context
          }
        }
      }
    }
  );
}
