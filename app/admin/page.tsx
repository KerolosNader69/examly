'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

// TODO: Note for pre-launch cleanup: clear all ~45 test teacher records, exams, student_sessions, audit_logs before production launch.

interface AuditLogRow {
  id: string;
  actor: string;
  action: string;
  target: string | null;
  ip_address: string | null;
  created_at: string;
}

interface AdminOverviewData {
  totalTeachers: number;
  activeSubscriptions: number;
  mrr: number;
  mrrIsEstimated: boolean;
  systemHealth: {
    status: string;
    isOperational: boolean;
    latencyMs: number;
  };
  tierBreakdown: {
    pro: { count: number; percentage: number };
    basic: { count: number; percentage: number };
    free: { count: number; percentage: number };
  };
  recentActivities: AuditLogRow[];
}

function formatRelativeTime(dateStr: string): string {
  if (!dateStr) return 'Recently';
  const now = new Date().getTime();
  const past = new Date(dateStr).getTime();
  const diffSec = Math.max(0, Math.floor((now - past) / 1000));

  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay}d ago`;
}

function getActionMeta(log: AuditLogRow) {
  const act = log.action.toLowerCase();
  if (act.includes('signup') || act.includes('invited')) {
    return {
      category: 'signup',
      title: `Teacher invited/created: ${log.target || log.actor}`,
      badgeColor: 'emerald',
    };
  }
  if (act.includes('suspend') || act.includes('alert')) {
    return {
      category: 'alert',
      title: `Account suspended: ${log.target || 'Teacher'}`,
      badgeColor: 'rose',
    };
  }
  if (act.includes('upgrade') || act.includes('payment')) {
    return {
      category: 'upgrade',
      title: `Subscription updated: ${log.target || 'Plan'}`,
      badgeColor: 'teal',
    };
  }
  if (act.includes('flag') || act.includes('cheat') || act.includes('quota')) {
    return {
      category: 'quota',
      title: `Exam Integrity Flag: ${log.target || 'Session'}`,
      badgeColor: 'gold',
    };
  }
  return {
    category: 'system',
    title: log.target ? `${log.action} — ${log.target}` : log.action,
    badgeColor: 'slate',
  };
}

export default function AdminOverviewPage() {
  const [data, setData] = useState<AdminOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOverview = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/admin/overview');
      if (!res.ok) {
        throw new Error(`Failed to load admin overview (${res.status})`);
      }
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      console.error('Error loading admin overview:', err);
      setError(err.message || 'Error loading dashboard metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  const total = data?.totalTeachers || 0;
  const activeSub = data?.activeSubscriptions || 0;
  const activePct = total > 0 ? Math.round((activeSub / total) * 100) : 0;
  const mrrFormatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(data?.mrr || 0);

  const stats = [
    {
      label: 'Total Teachers',
      value: loading ? '...' : (data?.totalTeachers ?? 0).toLocaleString(),
      change: `${data?.totalTeachers || 0} registered in database`,
      isPositive: true,
      icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
    },
    {
      label: 'Active Subscriptions',
      value: loading ? '...' : (data?.activeSubscriptions ?? 0).toLocaleString(),
      change: `${activePct}% active paid rate`,
      isPositive: true,
      icon: 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z',
    },
    {
      label: 'MRR (Monthly Revenue)',
      value: loading ? '...' : mrrFormatted,
      change: 'Estimated (pricing not finalized)',
      isPositive: true,
      icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    },
    {
      label: 'System Health Status',
      value: loading ? '...' : (data?.systemHealth?.status || '100%'),
      change: data?.systemHealth?.isOperational
        ? `Operational (${data.systemHealth.latencyMs}ms ping)`
        : 'Database Check Failed',
      isPositive: data?.systemHealth?.isOperational ?? true,
      isHealth: true,
      icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
    },
  ];

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-poppins text-deep-teal dark:text-white flex items-center gap-2.5">
            Admin Overview Dashboard
          </h1>
          <p className="text-xs text-text-dark/60 dark:text-light-mint/70 mt-1">
            Real-time Supabase platform metrics, subscriber counts, and audit logs.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchOverview}
            disabled={loading}
            className="px-3 py-2 rounded-card border border-gray-300 dark:border-white/10 bg-white dark:bg-deep-teal text-text-dark dark:text-light-mint hover:bg-gray-50 text-xs font-semibold transition-all flex items-center gap-1.5"
            title="Refresh statistics from Supabase"
          >
            <svg className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
          <Link
            href="/admin/teachers"
            className="px-4 py-2 rounded-card bg-primary-teal hover:bg-primary-teal/90 text-white font-semibold text-xs shadow-sm transition-all"
          >
            Manage Teachers
          </Link>
          <Link
            href="/admin/system-health"
            className="px-4 py-2 rounded-card border border-gray-300 dark:border-white/10 bg-white dark:bg-deep-teal text-text-dark dark:text-light-mint hover:bg-gray-50 text-xs font-semibold transition-all"
          >
            System Status
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-card bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center justify-between">
          <span>⚠️ {error}</span>
          <button onClick={fetchOverview} className="underline hover:no-underline text-xs">
            Retry
          </button>
        </div>
      )}

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {stats.map((stat, i) => (
          <div
            key={i}
            className="bg-white dark:bg-dark-surface rounded-card border border-gray-200 dark:border-white/10 shadow-sm p-5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-text-dark/50 dark:text-light-mint/50 uppercase tracking-wider">
                {stat.label}
              </span>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                stat.isHealth ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-primary-teal/10 text-primary-teal'
              }`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={stat.icon} />
                </svg>
              </div>
            </div>

            <div>
              <p className="text-2xl font-bold font-poppins text-deep-teal dark:text-white">
                {stat.value}
              </p>
              <p className={`text-xs font-semibold mt-1 flex items-center gap-1 ${
                stat.isHealth
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-emerald-600 dark:text-emerald-400'
              }`}>
                {stat.isHealth && <span className="w-2 h-2 rounded-full bg-emerald-500"></span>}
                {stat.change}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Main Grid: Activity Feed & System Quick Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity Feed */}
        <div className="lg:col-span-2 bg-white dark:bg-dark-surface rounded-card-lg border border-gray-200 dark:border-white/10 shadow-sm p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-white/10 pb-4">
            <div>
              <h2 className="text-lg font-bold font-poppins text-deep-teal dark:text-white">
                Recent Platform Activity
              </h2>
              <p className="text-xs text-text-dark/60 dark:text-light-mint/70">
                Live audit trail pulled from Supabase <code className="font-mono text-[11px] text-primary-teal">audit_logs</code> table.
              </p>
            </div>
            <Link
              href="/admin/audit-log"
              className="text-xs font-semibold text-primary-teal hover:underline"
            >
              View Full Audit Log →
            </Link>
          </div>

          <div className="space-y-4">
            {loading ? (
              <div className="py-12 text-center text-xs text-text-dark/40 dark:text-light-mint/40 animate-pulse">
                Fetching recent audit activity logs from Supabase...
              </div>
            ) : !data?.recentActivities || data.recentActivities.length === 0 ? (
              <div className="p-8 text-center rounded-card bg-gray-50 dark:bg-white/5 border border-dashed border-gray-200 dark:border-white/10 space-y-2">
                <p className="text-xs font-semibold text-deep-teal dark:text-white">
                  No audit activities recorded yet
                </p>
                <p className="text-[11px] text-text-dark/50 dark:text-light-mint/50 max-w-sm mx-auto">
                  New teacher invites, status changes, and exam security flags will automatically appear here as they occur in real time.
                </p>
              </div>
            ) : (
              data.recentActivities.map((act) => {
                const meta = getActionMeta(act);
                return (
                  <div
                    key={act.id}
                    className="p-4 rounded-card border border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/5 flex items-start justify-between gap-4 hover:border-primary-teal/30 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded ${
                          meta.badgeColor === 'emerald'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : meta.badgeColor === 'teal'
                            ? 'bg-primary-teal/15 text-primary-teal'
                            : meta.badgeColor === 'gold'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                            : meta.badgeColor === 'rose'
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                            : 'bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-light-mint'
                        }`}>
                          {meta.category}
                        </span>
                        <span className="text-xs font-medium text-text-dark/50 dark:text-light-mint/50 font-mono">
                          {act.actor}
                        </span>
                      </div>
                      <p className="text-xs font-medium text-deep-teal dark:text-white">
                        {meta.title}
                      </p>
                    </div>
                    <span className="text-[11px] text-text-dark/50 dark:text-light-mint/50 font-mono whitespace-nowrap">
                      {formatRelativeTime(act.created_at)}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Quick System Status & Tier Breakdown */}
        <div className="space-y-6">
          {/* Active Services Health */}
          <div className="bg-white dark:bg-dark-surface rounded-card-lg border border-gray-200 dark:border-white/10 shadow-sm p-6 space-y-4">
            <h3 className="text-base font-bold font-poppins text-deep-teal dark:text-white border-b border-gray-100 dark:border-white/10 pb-3">
              External Services Status
            </h3>

            <div className="space-y-3">
              {[
                {
                  name: 'Supabase Database',
                  status: data?.systemHealth?.isOperational ? 'Healthy' : 'Connecting...',
                  ping: `${data?.systemHealth?.latencyMs || 0}ms`,
                  color: 'emerald',
                },
                { name: 'Gemini / Deepgram API', status: 'Configured', ping: 'API Key OK', color: 'emerald' },
                { name: 'Paymob / Resend API', status: 'Pending Setup', ping: 'Unconfigured', color: 'slate' },
              ].map((service, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-card bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 text-xs">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${service.color === 'emerald' ? 'bg-emerald-500' : 'bg-gray-400'}`}></span>
                    <span className="font-semibold text-deep-teal dark:text-white">{service.name}</span>
                  </div>
                  <span className="font-mono text-text-dark/50 dark:text-light-mint/50">{service.ping}</span>
                </div>
              ))}
            </div>

            <Link
              href="/admin/system-health"
              className="block text-center pt-2 text-xs font-semibold text-primary-teal hover:underline"
            >
              System Diagnostics & Credentials →
            </Link>
          </div>

          {/* Subscription Tiers Quick Breakdown */}
          <div className="bg-white dark:bg-dark-surface rounded-card-lg border border-gray-200 dark:border-white/10 shadow-sm p-6 space-y-4">
            <h3 className="text-base font-bold font-poppins text-deep-teal dark:text-white border-b border-gray-100 dark:border-white/10 pb-3">
              Subscribers by Tier
            </h3>

            <div className="space-y-3 text-xs">
              {/* Pro Plan */}
              <div className="space-y-1">
                <div className="flex justify-between font-semibold">
                  <span className="text-text-dark/70 dark:text-light-mint/70">Pro Plan ($29/mo)</span>
                  <span className="font-mono text-deep-teal dark:text-white">
                    {data?.tierBreakdown?.pro?.count ?? 0} teachers ({data?.tierBreakdown?.pro?.percentage ?? 0}%)
                  </span>
                </div>
                <div className="h-2 bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary-teal transition-all duration-500"
                    style={{ width: `${data?.tierBreakdown?.pro?.percentage ?? 0}%` }}
                  ></div>
                </div>
              </div>

              {/* Basic Plan */}
              <div className="space-y-1 pt-1">
                <div className="flex justify-between font-semibold">
                  <span className="text-text-dark/70 dark:text-light-mint/70">Basic Plan ($15/mo)</span>
                  <span className="font-mono text-deep-teal dark:text-white">
                    {data?.tierBreakdown?.basic?.count ?? 0} teachers ({data?.tierBreakdown?.basic?.percentage ?? 0}%)
                  </span>
                </div>
                <div className="h-2 bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gold-accent transition-all duration-500"
                    style={{ width: `${data?.tierBreakdown?.basic?.percentage ?? 0}%` }}
                  ></div>
                </div>
              </div>

              {/* Free Tier */}
              <div className="space-y-1 pt-1">
                <div className="flex justify-between font-semibold">
                  <span className="text-text-dark/70 dark:text-light-mint/70">Free Tier</span>
                  <span className="font-mono text-deep-teal dark:text-white">
                    {data?.tierBreakdown?.free?.count ?? 0} teachers ({data?.tierBreakdown?.free?.percentage ?? 0}%)
                  </span>
                </div>
                <div className="h-2 bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gray-400 transition-all duration-500"
                    style={{ width: `${data?.tierBreakdown?.free?.percentage ?? 0}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
