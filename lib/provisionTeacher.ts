import type { User } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase-admin';

export interface ProvisionedTeacher {
  id: string;
  name: string;
  email: string;
  subdomain: string;
}

/**
 * The ONLY code path that creates rows in public.teachers (service role).
 * Used by POST /api/auth/provision-teacher (after verifying the caller's access
 * token) and by the OAuth callback (after exchanging the auth code).
 *
 * plan and status are always set here ('free' / 'active'); callers cannot
 * influence them. The row id and email always come from the verified auth user.
 * (Admin-invited teachers are created by the admin API, which is out of scope.)
 */
export async function provisionTeacherRow(
  user: Pick<User, 'id' | 'email' | 'user_metadata'>,
  requested: { name?: unknown; subdomain?: unknown } = {}
): Promise<{ teacher: ProvisionedTeacher; alreadyExisted: boolean }> {
  const email = (user.email || '').trim();
  if (!user.id || !email) throw new Error('Authenticated user has no id or email.');

  const existing = await findTeacher(user.id);
  if (existing) return { teacher: existing, alreadyExisted: true };

  const requestedName = typeof requested.name === 'string' ? requested.name.trim().slice(0, 100) : '';
  const name =
    requestedName ||
    (typeof user.user_metadata?.full_name === 'string' && user.user_metadata.full_name) ||
    (typeof user.user_metadata?.name === 'string' && user.user_metadata.name) ||
    email.split('@')[0] ||
    'Teacher';

  // Same subdomain normalisation as before: lowercase alphanumerics only.
  const requestedSubdomain = typeof requested.subdomain === 'string' ? requested.subdomain : '';
  let subdomain = (requestedSubdomain || email.split('@')[0]).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 30);
  if (subdomain.length < 3) subdomain = `teacher-${subdomain}`;

  const { data: taken } = await supabaseAdmin.from('teachers').select('id').eq('subdomain', subdomain).maybeSingle();
  if (taken) subdomain = `${subdomain}-${Date.now().toString(36)}`;

  const { data: inserted, error } = await supabaseAdmin
    .from('teachers')
    .insert({
      id: user.id,
      name,
      email,
      subdomain,
      plan: 'free',
      status: 'active',
    })
    .select('id, name, email, subdomain')
    .single();

  if (error) {
    // Unique violation: a concurrent request created the row first. Return it.
    if (error.code === '23505') {
      const raced = await findTeacher(user.id);
      if (raced) return { teacher: raced, alreadyExisted: true };
    }
    throw new Error(`Failed to create teacher profile: ${error.message}`);
  }

  return { teacher: inserted as ProvisionedTeacher, alreadyExisted: false };
}

async function findTeacher(id: string): Promise<ProvisionedTeacher | null> {
  const { data } = await supabaseAdmin
    .from('teachers')
    .select('id, name, email, subdomain')
    .eq('id', id)
    .maybeSingle();
  return (data as ProvisionedTeacher | null) ?? null;
}
