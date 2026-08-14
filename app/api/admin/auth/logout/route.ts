import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    await supabase.auth.signOut();

    const response = NextResponse.json({ success: true });
    response.cookies.set('examly_admin_session', '', {
      httpOnly: true,
      path: '/',
      maxAge: 0,
    });

    return response;
  } catch (error: any) {
    return NextResponse.json({ error: 'Logout failed' }, { status: 500 });
  }
}
