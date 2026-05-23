// Browser-side Supabase client (anon key).
// Used in client components & client-side hooks. NEVER expose service role here.
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/supabase';

export function createSupabaseBrowserClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
