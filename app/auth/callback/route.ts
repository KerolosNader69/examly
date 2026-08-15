import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') || '/dashboard';

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
      const user = data.user;
      const userId = user.id;
      const userEmail = user.email || '';
      const userName =
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        userEmail.split('@')[0] ||
        'Teacher';

      // Check if teacher already exists in Supabase database
      const { data: existingTeacher } = await supabaseAdmin
        .from('teachers')
        .select('id, name, subdomain')
        .eq('id', userId)
        .maybeSingle();

      if (!existingTeacher) {
        // Generate a clean, unique subdomain for Google Auth user
        const baseSub =
          userEmail.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '') ||
          'teacher';
        const subdomain = `${baseSub}-${Date.now()}`;

        const { error: insertError } = await supabaseAdmin.from('teachers').upsert({
          id: userId,
          name: userName,
          email: userEmail,
          subdomain: subdomain,
          plan: 'free',
          status: 'active',
        });

        if (insertError) {
          console.error('[Auth Callback] Failed to insert teacher row:', insertError);
        } else {
          console.log(`[Auth Callback] Created new teacher record for ${userName} (${subdomain})`);
        }
      }

      return NextResponse.redirect(`${requestUrl.origin}${next}`);
    }
  }

  return NextResponse.redirect(`${requestUrl.origin}/login?error=oauth_failed`);
}
