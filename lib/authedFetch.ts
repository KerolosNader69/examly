import { supabase } from '@/lib/supabase';

/**
 * Browser-side fetch that attaches the current Supabase access token as
 * `Authorization: Bearer ...` for teacher-only server routes
 * (verified server-side by lib/serverAuth.ts).
 */
export async function authedFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}
