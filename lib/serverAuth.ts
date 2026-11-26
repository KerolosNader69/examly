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

/**
 * Like getUserFromRequest, but also requires an existing, non-suspended teacher row.
 * Use for teacher-only routes (AI generation, previews, recordings).
 */
export async function getTeacherFromRequest(request: Request): Promise<{ user: User; teacherId: string } | null> {
  const user = await getUserFromRequest(request);
  if (!user) return null;
  const { data: teacher } = await supabaseAdmin.from('teachers').select('id, status').eq('id', user.id).maybeSingle();
  if (!teacher || teacher.status === 'suspended') return null;
  return { user, teacherId: teacher.id };
}
