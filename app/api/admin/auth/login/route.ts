import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '127.0.0.1';
  let emailAttempt = 'unknown';

  try {
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

    // 1. Authenticate with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
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

      return NextResponse.json(
        { error: 'Invalid email or password.' },
        { status: 401 }
      );
    }

    const user = authData.user;
    const role = user.app_metadata?.role;

    // 2. Check if account has admin privileges
    if (role !== 'admin') {
      // Immediately sign out non-admin user
      await supabase.auth.signOut();

      // Log failed login attempt for non-admin user
      await supabaseAdmin.from('audit_logs').insert({
        actor: emailAttempt,
        action: 'admin_login_failed',
        target: 'not_authorized_admin',
        ip_address: clientIp,
      });

      return NextResponse.json(
        { error: 'Access denied: Account is not an authorized administrator.' },
        { status: 403 }
      );
    }

    // Log successful admin login
    await supabaseAdmin.from('audit_logs').insert({
      actor: user.email || emailAttempt,
      action: 'admin_login_success',
      target: 'admin_portal',
      ip_address: clientIp,
    });

    // 3. Create response and set secure HTTP-only admin session cookie
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.user_metadata?.name || 'Sys Admin',
      },
    });

    const sessionData = JSON.stringify({
      uid: user.id,
      email: user.email,
      role: 'admin',
      ts: Date.now(),
    });

    // Encode payload for cookie
    const token = Buffer.from(sessionData).toString('base64');

    response.cookies.set('examly_admin_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24, // 24 hours
    });

    return response;
  } catch (error: any) {
    console.error('Error during admin login:', error);

    await supabaseAdmin.from('audit_logs').insert({
      actor: emailAttempt,
      action: 'admin_login_failed',
      target: 'server_error',
      ip_address: clientIp,
    });

    return NextResponse.json(
      { error: error.message || 'Internal server authentication error' },
      { status: 500 }
    );
  }
}
