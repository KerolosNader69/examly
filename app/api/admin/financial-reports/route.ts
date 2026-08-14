import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase-admin';

// TODO: Update with finalized plan prices before production launch.
// Current placeholder pricing: free = $0, basic = $15, pro = $29 per month.

export const dynamic = 'force-dynamic';

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

export async function GET() {
  try {
    const session = await verifyAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Query real subscriber counts grouped by plan from teachers table
    const { data: teachers, error: teachersErr } = await supabaseAdmin
      .from('teachers')
      .select('plan, status');

    if (teachersErr) throw teachersErr;

    const PLAN_PRICES: Record<string, number> = {
      free: 0,
      basic: 15,
      pro: 29,
    };

    let proCount = 0;
    let basicCount = 0;
    let freeCount = 0;
    let activePaidCount = 0;
    let estimatedMrr = 0;

    (teachers || []).forEach((t) => {
      const planKey = (t.plan || 'free').toLowerCase();
      if (planKey === 'pro') proCount++;
      else if (planKey === 'basic') basicCount++;
      else freeCount++;

      if (t.status === 'active' && PLAN_PRICES[planKey]) {
        activePaidCount++;
        estimatedMrr += PLAN_PRICES[planKey];
      }
    });

    const totalTeachers = (teachers || []).length;
    const proPct = totalTeachers > 0 ? Math.round((proCount / totalTeachers) * 100) : 0;
    const basicPct = totalTeachers > 0 ? Math.round((basicCount / totalTeachers) * 100) : 0;
    const freePct = totalTeachers > 0 ? Math.max(0, 100 - proPct - basicPct) : 0;

    const proRevenue = proCount * PLAN_PRICES.pro;
    const basicRevenue = basicCount * PLAN_PRICES.basic;
    const freeRevenue = 0;

    // 2. Query completed student_sessions to estimate AI operating cost
    // Baseline AI cost per oral exam session (Deepgram STT + Gemini Evaluation) = ~$0.42
    const { count: completedSessionsCount, error: sessionErr } = await supabaseAdmin
      .from('student_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed');

    if (sessionErr) throw sessionErr;

    const totalCompleted = completedSessionsCount || 0;
    const AI_COST_PER_SESSION = 0.42;
    const estimatedAiCost = Math.round(totalCompleted * AI_COST_PER_SESSION * 100) / 100;
    const netProfit = Math.round((estimatedMrr - estimatedAiCost) * 100) / 100;
    const profitMarginPct = estimatedMrr > 0 ? Math.round((netProfit / estimatedMrr) * 100) : 0;
    const arpu = totalTeachers > 0 ? Math.round((estimatedMrr / totalTeachers) * 100) / 100 : 0;

    return NextResponse.json(
      {
        totalTeachers,
        activePaidCount,
        mrr: estimatedMrr,
        mrrLabel: 'Estimated (pricing not finalized)',
        arr: estimatedMrr * 12,
        arpu,
        aiOperatingCost: {
          totalCompletedSessions: totalCompleted,
          costPerSession: AI_COST_PER_SESSION,
          estimatedTotalCost: estimatedAiCost,
          label: 'Estimated AI cost ($0.42/session), not exact billing',
        },
        netMetrics: {
          netMonthlyProfit: netProfit,
          profitMarginPct,
        },
        tierBreakdown: {
          pro: { count: proCount, percentage: proPct, monthlyRevenue: proRevenue },
          basic: { count: basicCount, percentage: basicPct, monthlyRevenue: basicRevenue },
          free: { count: freeCount, percentage: freePct, monthlyRevenue: freeRevenue },
        },
      },
      {
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      }
    );
  } catch (error: any) {
    console.error('Error calculating financial metrics:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch financial metrics' }, { status: 500 });
  }
}
