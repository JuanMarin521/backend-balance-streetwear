import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getServerEnv } from '../env';

let client: SupabaseClient | undefined;

/** Service-role client. Server-only: never import from browser code. */
export function getServiceClient(): SupabaseClient {
  if (!client) {
    const env = getServerEnv();
    client = createClient(env.PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
