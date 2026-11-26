import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase-admin';
import {
  ADMIN_SESSION_COOKIE,
  adminSessionCookieOptions,
  createAdminSession,
  isAdminSessionConfigured,
} from '@/lib/adminSession';

export const dynamic = 'force-dynamic';

const GENERIC_AUTH_ERROR = 'Invalid email or password.';

/**
 * Fresh Supabase client per request so no auth session is ever shared
 * between concurrent requests on the server.
 */
function createRequestAuthClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key',
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );
}

export async function POST(request: Request) {
  const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '127.0.0.1';
  let emailAttempt = 'unknown';

  try {
    // 0. Fail closed: no signing secret means no admin sessions can be issued.
    if (!isAdminSessionConfigured()) {
      console.error('Admin login rejected: ADMIN_SESSION_SECRET is missing or shorter than 32 characters.');
      return NextResponse.json(
        { error: 'Admin login is currently unavailable.' },
        { status: 503 }
      );
    }

    const body = await request.json();
    emailAttempt = (body.email || 'unknown').trim().toLowerCase();
    const { password } = body;

    if (!emailAttempt || !password) {
      // Log failed attempt for missing fields
      await supabaseAdmin.from('audit_logs').insert({
        actor: emailAttempt,
        action: 'admin_login_failed',
        target: 'missing_credentials',
        ip_address: clientIp,
      });

      return NextResponse.json(
        { error: 'Email and password are required.' },
        { status: 400 }
      );
    }

    // 1. Authenticate with Supabase Auth using a per-request client
    const authClient = createRequestAuthClient();
    const { data: authData, error: authError } = await authClient.auth.signInWithPassword({
      email: emailAttempt,
      password,
    });

    if (authError || !authData.user) {
      // Log failed login attempt (wrong password or unconfirmed user)
      await supabaseAdmin.from('audit_logs').insert({
        actor: emailAttempt,
        action: 'admin_login_failed',
        target: 'invalid_credentials',
        ip_address: clientIp,
      });

      return NextResponse.json({ error: GENERIC_AUTH_ERROR }, { status: 401 });
    }

    const user = authData.user;
    const role = user.app_metadata?.role;

    // 2. Check if account has admin privileges
    if (role !== 'admin' || !user.email) {
      // Revoke the Supabase session that was just created for this non-admin user
      await authClient.auth.signOut();

      // Log failed login attempt for non-admin user
      await supabaseAdmin.from('audit_logs').insert({
        actor: emailAttempt,
        action: 'admin_login_failed',
        target: 'not_authorized_admin',
        ip_address: clientIp,
      });

      // Same generic response as bad credentials: don't reveal that the account exists
      return NextResponse.json({ error: GENERIC_AUTH_ERROR }, { status: 401 });
    }

    // 3. Create signed admin session token
    const token = await createAdminSession({ uid: user.id, email: user.email });

    // Log successful admin login
    await supabaseAdmin.from('audit_logs').insert({
      actor: user.email,
      action: 'admin_login_success',
      target: 'admin_portal',
      ip_address: clientIp,
    });

    // 4. Create response and set secure HTTP-only admin session cookie
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.user_metadata?.name || 'Sys Admin',
      },
    });

    response.cookies.set(ADMIN_SESSION_COOKIE, token, adminSessionCookieOptions());

    return response;
  } catch (error) {
    console.error('Error during admin login:', error);

    await supabaseAdmin.from('audit_logs').insert({
      actor: emailAttempt,
      action: 'admin_login_failed',
      target: 'server_error',
      ip_address: clientIp,
    });

    return NextResponse.json(
      { error: 'Admin login failed. Please try again.' },
      { status: 500 }
    );
  }
}
