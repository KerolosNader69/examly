import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { ilikeAnyFilter } from '@/lib/postgrestFilter';
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from '@/lib/adminSession';

export const dynamic = 'force-dynamic';

async function getAdminSession() {
  const cookieStore = await cookies();
  return verifyAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
}

export async function GET(request: Request) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const category = searchParams.get('category') || 'all';
    const range = searchParams.get('range') || 'all';

    let query = supabaseAdmin
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false });

    // Search filter across actor, action, target, ip_address
    // Sanitised + quoted so search text can't inject PostgREST filter syntax.
    const searchFilter = ilikeAnyFilter(['actor', 'action', 'target', 'ip_address'], search);
    if (searchFilter) {
      query = query.or(searchFilter);
    }

    // Date range filter
    if (range !== 'all') {
      const now = new Date();
      let startDate = new Date();
      if (range === 'today') {
        startDate.setHours(0, 0, 0, 0);
      } else if (range === '7days') {
        startDate.setDate(now.getDate() - 7);
      } else if (range === '30days') {
        startDate.setDate(now.getDate() - 30);
      }
      query = query.gte('created_at', startDate.toISOString());
    }

    const { data: rawLogs, error } = await query;
    if (error) throw error;

    // Map logs to category and status
    const logs = (rawLogs || []).map((item) => {
      const act = item.action.toLowerCase();
      let itemCategory = 'system';
      let itemStatus = 'success';

      if (act.includes('teacher') || act.includes('invite') || act.includes('suspend')) {
        itemCategory = 'teacher';
        if (act.includes('suspend')) itemStatus = 'warning';
      } else if (act.includes('auth') || act.includes('login') || act.includes('security')) {
        itemCategory = 'security';
        if (act.includes('failed') || act.includes('denied')) itemStatus = 'failed';
      } else if (act.includes('exam') || act.includes('question') || act.includes('flag')) {
        itemCategory = 'exam';
        if (act.includes('flag') || act.includes('cheat')) itemStatus = 'warning';
      } else if (act.includes('payment') || act.includes('plan') || act.includes('billing')) {
        itemCategory = 'billing';
      }

      return {
        ...item,
        category: itemCategory,
        status: itemStatus,
      };
    });

    // Category filter in memory if specified
    const filteredLogs = category === 'all'
      ? logs
      : logs.filter((l) => l.category === category);

    return NextResponse.json({ logs: filteredLogs }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (error: any) {
    console.error('Error fetching audit logs:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch audit logs' }, { status: 500 });
  }
}
