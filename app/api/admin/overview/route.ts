import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase-admin';

// TODO: Before production launch, run a cleanup script to clear all test data
// (teachers, exams, student_sessions, audit_logs).

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 0. Verify Admin Authorization Cookie
    const cookieStore = await cookies();
    const token = cookieStore.get('examly_admin_session')?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized: Admin session required.' },
        { status: 401, headers: { 'Cache-Control': 'no-store, max-age=0' } }
      );
    }

    try {
      const payloadText = Buffer.from(token, 'base64').toString('utf8');
      const session = JSON.parse(payloadText);
      if (session?.role !== 'admin' || !session?.uid) {
        return NextResponse.json(
          { error: 'Unauthorized: Invalid admin credentials.' },
          { status: 401, headers: { 'Cache-Control': 'no-store, max-age=0' } }
        );
      }
    } catch {
      return NextResponse.json(
        { error: 'Unauthorized: Malformed admin token.' },
        { status: 401, headers: { 'Cache-Control': 'no-store, max-age=0' } }
      );
    }

    // 1. Total Teachers count
    const { count: totalTeachers, error: teachersErr } = await supabaseAdmin
      .from('teachers')
      .select('*', { count: 'exact', head: true });

    if (teachersErr) throw teachersErr;

    // 2. Active Subscriptions (status = 'active' AND plan != 'free')
    const { count: activeSubscriptions, error: activeErr } = await supabaseAdmin
      .from('teachers')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')
      .neq('plan', 'free');

    if (activeErr) throw activeErr;

    // 3. Count by Tier for MRR calculation & Tier breakdown chart
    // TODO: Replace placeholder pricing values (free=0, basic=15, pro=29) with real finalized pricing before launch
    const PLAN_PRICES: Record<string, number> = {
      free: 0,
      basic: 15,
      pro: 29,
    };

    const { data: teacherPlans, error: plansErr } = await supabaseAdmin
      .from('teachers')
      .select('plan, status');

    if (plansErr) throw plansErr;

    let proCount = 0;
    let basicCount = 0;
    let freeCount = 0;
    let calculatedMrr = 0;

    (teacherPlans || []).forEach((t) => {
      const planKey = (t.plan || 'free').toLowerCase();
      if (planKey === 'pro') proCount++;
      else if (planKey === 'basic') basicCount++;
      else freeCount++;

      // Sum MRR for active paid subscriptions
      if (t.status === 'active' && PLAN_PRICES[planKey]) {
        calculatedMrr += PLAN_PRICES[planKey];
      }
    });

    const total = totalTeachers || 0;
    const proPct = total > 0 ? Math.round((proCount / total) * 100) : 0;
    const basicPct = total > 0 ? Math.round((basicCount / total) * 100) : 0;
    const freePct = total > 0 ? Math.max(0, 100 - proPct - basicPct) : 0;

    // 4. System Health simple check (lightweight query to Supabase)
    const startTime = Date.now();
    const { error: healthErr } = await supabaseAdmin.from('teachers').select('id').limit(1);
    const latency = Date.now() - startTime;
    const isDbConnected = !healthErr;

    // 5. Recent Activity Feed (pull most recent 10 rows from audit_logs)
    const { data: auditLogs, error: auditErr } = await supabaseAdmin
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (auditErr) throw auditErr;

    return NextResponse.json(
      {
        totalTeachers: total,
        activeSubscriptions: activeSubscriptions || 0,
        mrr: calculatedMrr,
        mrrIsEstimated: true,
        systemHealth: {
          status: isDbConnected ? '100%' : 'Degraded',
          isOperational: isDbConnected,
          latencyMs: latency,
        },
        tierBreakdown: {
          pro: { count: proCount, percentage: proPct },
          basic: { count: basicCount, percentage: basicPct },
          free: { count: freeCount, percentage: freePct },
        },
        recentActivities: auditLogs || [],
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    );
  } catch (error: any) {
    console.error('Error fetching admin overview:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch admin overview metrics' },
      { status: 500 }
    );
  }
}
