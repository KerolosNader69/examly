import type { User } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * Resolves the logged-in Supabase user for a server route from the
 * `Authorization: Bearer <access_token>` header.
 *
 * The dashboard keeps its Supabase session in localStorage (not cookies), so
 * browser calls to teacher-only routes must send the access token explicitly
 * (see lib/authedFetch.ts). The token is validated by Supabase Auth itself
 * (signature + expiry), never just decoded. Returns null when missing/invalid.
 */
export async function getUserFromRequest(request: Request): Promise<User | null> {
  const header = request.headers.get('authorization') || '';
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  if (!match) return null;

  try {
    const { data, error } = await supabaseAdmin.auth.getUser(match[1]);
    if (error || !data?.user) return null;
    return data.user;
  } catch {
    return null;
  }
}
