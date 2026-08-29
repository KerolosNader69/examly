import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, email, name, subdomain } = body;

    if (!userId || !email) {
      return NextResponse.json(
        { error: 'Missing required parameters: userId and email' },
        { status: 400 }
      );
    }

    // Check if teacher profile already exists
    const { data: existingTeacher } = await supabaseAdmin
      .from('teachers')
      .select('id, name, subdomain, email')
      .eq('id', userId)
      .maybeSingle();

    if (existingTeacher) {
      return NextResponse.json({
        success: true,
        teacher: existingTeacher,
        alreadyExisted: true,
      });
    }

    // Generate unique subdomain if not provided or collision occurs
    let finalSubdomain = (subdomain || email.split('@')[0])
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
    
    if (finalSubdomain.length < 3) finalSubdomain = `teacher-${finalSubdomain}`;

    const { data: subCheck } = await supabaseAdmin
      .from('teachers')
      .select('id')
      .eq('subdomain', finalSubdomain)
      .maybeSingle();

    if (subCheck) {
      finalSubdomain = `${finalSubdomain}-${Date.now().toString(36)}`;
    }

    // Insert teacher profile using service role (bypasses RLS)
    const { data: newTeacher, error: insertError } = await supabaseAdmin
      .from('teachers')
      .upsert([
        {
          id: userId,
          name: name || email.split('@')[0] || 'Teacher',
          email: email.trim(),
          subdomain: finalSubdomain,
          plan: 'free',
          status: 'active',
        },
      ])
      .select()
      .single();

    if (insertError) {
      console.error('[Provision Teacher API] Failed to create teacher profile:', insertError);
      return NextResponse.json(
        { error: `Failed to create teacher profile: ${insertError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      teacher: newTeacher,
      alreadyExisted: false,
    });
  } catch (err: any) {
    console.error('[Provision Teacher API] Unexpected error:', err);
    return NextResponse.json(
      { error: err.message || 'An unexpected error occurred.' },
      { status: 500 }
    );
  }
}
