import type { SupabaseClient } from '@supabase/supabase-js';
import { ApiError } from '../domain/errors';

export interface AuthUser { id: string; email: string | undefined }

function bearer(request: Request): string | null {
  const h = request.headers.get('authorization');
  const m = h?.match(/^Bearer\s+(.+)$/i);
  return m ? m[1]!.trim() : null;
}

/** Optional auth: returns null for guests or invalid tokens. */
export async function getOptionalUser(request: Request, db: SupabaseClient): Promise<AuthUser | null> {
  const token = bearer(request);
  if (!token) return null;
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email };
}

/** Server-side authorization: verified identity AND admin role in profiles. */
export async function requireAdmin(request: Request, db: SupabaseClient): Promise<AuthUser> {
  const token = bearer(request);
  if (!token) throw new ApiError(401, 'unauthenticated', 'Authentication required');
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) throw new ApiError(401, 'unauthenticated', 'Invalid or expired token');
  const { data: profile, error: pErr } = await db
    .from('profiles').select('role').eq('id', data.user.id).maybeSingle();
  if (pErr) throw pErr;
  if (profile?.role !== 'admin') throw new ApiError(403, 'forbidden', 'Admin access required');
  return { id: data.user.id, email: data.user.email };
}
