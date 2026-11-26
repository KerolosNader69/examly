import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { provisionTeacherRow } from '@/lib/provisionTeacher';
import { safeNextPath } from '@/lib/safeRedirect';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  // Only same-origin relative paths: blocks ?next=//evil.com, /\evil.com, https://evil.com, ...
  const next = safeNextPath(requestUrl.searchParams.get('next'));

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key',
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // Ignore cookie mutations from server component environment
            }
          },
        },
      }
    );

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data?.user) {
      // Create the teacher row (if missing) through the single server-side
      // provisioning path, which always sets plan='free' / status='active'.
      try {
        await provisionTeacherRow(data.user);
      } catch (provisionErr) {
        console.error(
          '[Auth Callback] Failed to provision teacher row:',
          provisionErr instanceof Error ? provisionErr.message : provisionErr
        );
      }

      return NextResponse.redirect(`${requestUrl.origin}${next}`);
    }
  }

  return NextResponse.redirect(`${requestUrl.origin}/login?error=oauth_failed`);
}
