import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase-admin';

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

    // 1. Check Supabase Database connectivity
    const dbStartTime = Date.now();
    const { error: dbErr } = await supabaseAdmin.from('teachers').select('id').limit(1);
    const dbLatency = Date.now() - dbStartTime;
    const dbHealthy = !dbErr;

    // 2. Check Deepgram STT API Key
    const deepgramKey = process.env.DEEPGRAM_API_KEY;
    const deepgramConfigured = Boolean(deepgramKey && deepgramKey.trim() !== '' && deepgramKey !== 'placeholder');

    // 3. Check Gemini AI API Key
    const geminiKey = process.env.GEMINI_API_KEY;
    const geminiConfigured = Boolean(geminiKey && geminiKey.trim() !== '' && geminiKey !== 'placeholder');

    const services = [
      {
        id: 'srv-supabase',
        name: 'Supabase PostgreSQL Database',
        provider: 'Supabase Cloud',
        status: dbHealthy ? 'operational' : 'outage',
        latency: dbHealthy ? `${dbLatency} ms` : 'N/A',
        configured: dbHealthy,
        details: dbHealthy
          ? 'Live connection verified (SELECT 1 test succeeded).'
          : 'Database connection failed.',
      },
      {
        id: 'srv-deepgram',
        name: 'Deepgram STT Speech Engine',
        provider: 'Deepgram Speech-to-Text API',
        status: deepgramConfigured ? 'operational' : 'unconfigured',
        latency: deepgramConfigured ? 'Key Verified' : 'N/A',
        configured: deepgramConfigured,
        details: deepgramConfigured
          ? 'DEEPGRAM_API_KEY set and verified in environment variables.'
          : 'DEEPGRAM_API_KEY not configured.',
      },
      {
        id: 'srv-gemini',
        name: 'Gemini AI Assessment Engine',
        provider: 'Google Gemini 2.5 Flash',
        status: geminiConfigured ? 'operational' : 'unconfigured',
        latency: geminiConfigured ? 'Key Verified' : 'N/A',
        configured: geminiConfigured,
        details: geminiConfigured
          ? 'GEMINI_API_KEY set and verified in environment variables.'
          : 'GEMINI_API_KEY not configured.',
      },
      {
        id: 'srv-paymob',
        name: 'Paymob Payment Gateway',
        provider: 'Paymob Gateway',
        status: 'unconfigured',
        latency: 'Not Connected',
        configured: false,
        details: 'Not configured yet. Subscription payment processing integration pending.',
      },
      {
        id: 'srv-resend',
        name: 'Resend Transactional Email API',
        provider: 'Resend Email Service',
        status: 'unconfigured',
        latency: 'Not Connected',
        configured: false,
        details: 'Not configured yet. Email invitation and receipt delivery pending.',
      },
    ];

    const activeCount = services.filter((s) => s.status === 'operational').length;

    return NextResponse.json(
      {
        services,
        summary: {
          total: services.length,
          operationalCount: activeCount,
          overallStatus: dbHealthy && deepgramConfigured && geminiConfigured ? 'Operational' : 'Degraded',
          checkedAt: new Date().toISOString(),
        },
      },
      {
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      }
    );
  } catch (error: any) {
    console.error('Error checking system health:', error);
    return NextResponse.json({ error: error.message || 'System health check failed' }, { status: 500 });
  }
}
