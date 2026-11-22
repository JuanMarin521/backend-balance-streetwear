import { createClient } from '@supabase/supabase-js';

/** Browser-safe client: public URL + anon key only. RLS is the authority. */
export function createBrowserClient() {
  return createClient(import.meta.env.PUBLIC_SUPABASE_URL, import.meta.env.PUBLIC_SUPABASE_ANON_KEY);
}
