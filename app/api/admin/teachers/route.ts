import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

// Helper to check admin authorization
async function verifyAdminSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get('examly_admin_session')?.value;
  if (!token) return null;

  try {
    const payloadText = Buffer.from(token, 'base64').toString('utf8');
    const session = JSON.parse(payloadText);
    if (session?.role === 'admin' && session?.email) {
      return session;
    }
  } catch {
    return null;
  }
  return null;
}

// GET /api/admin/teachers — Fetch all teachers from Supabase
export async function GET(request: Request) {
  try {
    const session = await verifyAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const plan = searchParams.get('plan') || 'all';
    const status = searchParams.get('status') || 'all';

    let query = supabaseAdmin
      .from('teachers')
      .select('*')
      .order('created_at', { ascending: false });

    if (search.trim()) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,subdomain.ilike.%${search}%`);
    }

    if (plan !== 'all') {
      query = query.eq('plan', plan.toLowerCase());
    }

    if (status !== 'all') {
      query = query.eq('status', status.toLowerCase());
    }

    const { data: teachers, error } = await query;
    if (error) throw error;

    return NextResponse.json({ teachers: teachers || [] }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (error: any) {
    console.error('Error fetching teachers:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch teachers' }, { status: 500 });
  }
}

// POST /api/admin/teachers — Invite new teacher
export async function POST(request: Request) {
  try {
    const session = await verifyAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, email, plan } = body;

    if (!name || !email) {
      return NextResponse.json({ error: 'Name and email are required.' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();
    const selectedPlan = (plan || 'free').toLowerCase();

    // Generate unique subdomain from teacher name
    const baseSubdomain = cleanName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const subdomain = `${baseSubdomain || 'teacher'}-${Date.now().toString().slice(-6)}`;

    // Create Supabase Auth user record
    const tempPassword = `InvitePass!${Math.random().toString(36).slice(-8)}`;
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: cleanEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { name: cleanName },
      app_metadata: { role: 'teacher' },
    });

    if (authError) {
      // If user already exists in auth, return error
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    const teacherId = authUser.user.id;

    // Insert into teachers table with status: 'invited'
    const { data: teacher, error: insertError } = await supabaseAdmin
      .from('teachers')
      .insert({
        id: teacherId,
        name: cleanName,
        email: cleanEmail,
        subdomain,
        plan: selectedPlan,
        status: 'invited',
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Log to audit_logs
    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '127.0.0.1';
    await supabaseAdmin.from('audit_logs').insert({
      actor: session.email,
      action: 'teacher_invited',
      target: cleanEmail,
      ip_address: clientIp,
    });

    return NextResponse.json({
      success: true,
      teacher,
      note: 'Teacher record created with status "invited". Email invitation flow will send automatically once Resend integration is active.',
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error inviting teacher:', error);
    return NextResponse.json({ error: error.message || 'Failed to invite teacher' }, { status: 500 });
  }
}

// PATCH /api/admin/teachers — Suspend / Reactivate teacher or change plan
export async function PATCH(request: Request) {
  try {
    const session = await verifyAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, status, plan } = body;

    if (!id) {
      return NextResponse.json({ error: 'Teacher ID is required.' }, { status: 400 });
    }

    // Get current teacher email for audit log
    const { data: currentTeacher, error: fetchErr } = await supabaseAdmin
      .from('teachers')
      .select('email, status, plan')
      .eq('id', id)
      .single();

    if (fetchErr || !currentTeacher) {
      return NextResponse.json({ error: 'Teacher not found.' }, { status: 404 });
    }

    const updates: Record<string, any> = {};
    let auditAction = '';

    if (status && status !== currentTeacher.status) {
      updates.status = status;
      auditAction = status === 'suspended' ? 'teacher_suspended' : 'teacher_reactivated';
    }

    if (plan && plan !== currentTeacher.plan) {
      updates.plan = plan.toLowerCase();
      if (!auditAction) {
        auditAction = `teacher_plan_changed_to_${plan.toLowerCase()}`;
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ message: 'No updates provided.' });
    }

    const { data: updatedTeacher, error: updateError } = await supabaseAdmin
      .from('teachers')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    // Log action to audit_logs
    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '127.0.0.1';
    await supabaseAdmin.from('audit_logs').insert({
      actor: session.email,
      action: auditAction || 'teacher_updated',
      target: currentTeacher.email,
      ip_address: clientIp,
    });

    return NextResponse.json({ success: true, teacher: updatedTeacher });
  } catch (error: any) {
    console.error('Error updating teacher:', error);
    return NextResponse.json({ error: error.message || 'Failed to update teacher' }, { status: 500 });
  }
}
