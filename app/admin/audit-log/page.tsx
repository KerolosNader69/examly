'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Badge from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';

// TODO: Note for pre-launch cleanup: clear test audit_logs entries before production launch.

interface AuditLogRow {
  id: string;
  actor: string;
  action: string;
  target: string | null;
  ip_address: string | null;
  created_at: string;
  category: 'security' | 'teacher' | 'exam' | 'billing' | 'system' | string;
  status: 'success' | 'failed' | 'warning' | string;
}

export default function AdminAuditLogPage() {
  const toast = useToast();
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [timeRange, setTimeRange] = useState('all');
  const [showGapAnalysis, setShowGapAnalysis] = useState(true);

  const fetchAuditLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (categoryFilter !== 'all') params.set('category', categoryFilter);
      if (timeRange !== 'all') params.set('range', timeRange);

      const res = await fetch(`/api/admin/audit-log?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`Failed to load audit logs (${res.status})`);
      }
      const data = await res.json();
      setLogs(data.logs || []);
    } catch (err: any) {
      console.error('Error fetching audit logs:', err);
      setError(err.message || 'Failed to fetch audit logs from database');
    } finally {
      setLoading(false);
    }
  }, [search, categoryFilter, timeRange]);

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  const handleExportCSV = () => {
    if (logs.length === 0) {
      toast('No log records available to export.', 'error');
      return;
    }
    const headers = ['ID', 'Timestamp', 'Actor', 'Action', 'Target', 'IP Address'];
    const rows = logs.map((l) => [
      l.id,
      new Date(l.created_at).toISOString(),
      `"${l.actor.replace(/"/g, '""')}"`,
      `"${l.action.replace(/"/g, '""')}"`,
      `"${(l.target || '').replace(/"/g, '""')}"`,
      l.ip_address || 'N/A',
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `examly_audit_log_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast(`Exported ${logs.length} audit log entries to CSV.`, 'success');
  };

  const formatTimestamp = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  return (
    <div className="space-y-6 pb-12 font-inter">
      {/* Header & Export Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-poppins text-deep-teal dark:text-white flex items-center gap-2.5">
            System Audit Log & Security Events
          </h1>
          <p className="text-xs text-text-dark/60 dark:text-light-mint/70 mt-1">
            Live audit logs queried from Supabase <code className="font-mono text-[11px] text-primary-teal">audit_logs</code> table.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          <button
            onClick={fetchAuditLogs}
            disabled={loading}
            className="px-3 py-2.5 rounded-card border border-gray-300 dark:border-white/10 bg-white dark:bg-deep-teal text-text-dark dark:text-light-mint hover:bg-gray-50 text-xs font-semibold transition flex items-center gap-1.5"
            title="Refresh database audit records"
          >
            <svg className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
          <button
            onClick={handleExportCSV}
            className="px-4 py-2.5 rounded-card bg-deep-teal dark:bg-primary-teal hover:bg-deep-teal/90 text-white font-bold text-xs shadow-md transition flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export CSV Log
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-card bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center justify-between">
          <span>⚠️ {error}</span>
          <button onClick={fetchAuditLogs} className="underline text-xs">Retry</button>
        </div>
      )}

      {/* Coverage Gap Analysis Banner */}
      {showGapAnalysis && (
        <div className="p-5 rounded-card-lg bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-300 flex items-center gap-2">
              <span>📋 Audit Log Coverage Analysis & Missing Event Gaps</span>
            </h3>
            <button
              onClick={() => setShowGapAnalysis(false)}
              className="text-amber-700 dark:text-amber-400 hover:underline text-[11px] font-semibold"
            >
              Dismiss
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-3 rounded-card bg-white/70 dark:bg-black/30 border border-amber-200/60 dark:border-amber-900/50 space-y-1.5">
              <span className="font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                ✅ Currently Logged Actions in DB:
              </span>
              <ul className="list-disc list-inside text-text-dark/80 dark:text-light-mint/80 space-y-1 text-[11px] font-mono">
                <li><code className="bg-amber-100 dark:bg-amber-900/50 px-1 rounded">teacher_invited</code> — Admin invites teacher</li>
                <li><code className="bg-amber-100 dark:bg-amber-900/50 px-1 rounded">teacher_suspended</code> — Admin suspends teacher</li>
                <li><code className="bg-amber-100 dark:bg-amber-900/50 px-1 rounded">teacher_reactivated</code> — Admin reactivates teacher</li>
              </ul>
            </div>

            <div className="p-3 rounded-card bg-white/70 dark:bg-black/30 border border-amber-200/60 dark:border-amber-900/50 space-y-1.5">
              <span className="font-bold text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                ⚠️ Identified Audit Logging Coverage Gaps (Missing):
              </span>
              <ul className="list-disc list-inside text-text-dark/80 dark:text-light-mint/80 space-y-1 text-[11px] font-mono">
                <li><code className="bg-rose-100 dark:bg-rose-950/60 px-1 rounded">teacher_signup</code> — Self-registration on signup page</li>
                <li><code className="bg-rose-100 dark:bg-rose-950/60 px-1 rounded">exam_created</code> — New oral/MCQ exam created by teacher</li>
                <li><code className="bg-rose-100 dark:bg-rose-950/60 px-1 rounded">anti_cheating_flagged</code> — Student tab switch / violation</li>
                <li><code className="bg-rose-100 dark:bg-rose-950/60 px-1 rounded">ai_insights_generated</code> — AI exam analytics completed</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Filter Controls Bar */}
      <div className="bg-white dark:bg-dark-surface rounded-card-lg border border-gray-200 dark:border-white/10 shadow-sm p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search actor, action, target, or IP..."
            className="w-full pl-9 pr-4 py-2 rounded-card border border-gray-300 dark:border-white/10 bg-white dark:bg-deep-teal text-text-dark dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-primary-teal transition font-mono"
          />
          <svg className="w-4 h-4 absolute left-3 top-2.5 text-text-dark/40 dark:text-light-mint/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end text-xs">
          {/* Category Dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="text-text-dark/50 dark:text-light-mint/50 font-semibold">Category:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 rounded-card border border-gray-300 dark:border-white/10 bg-white dark:bg-deep-teal text-text-dark dark:text-white font-medium focus:outline-none"
            >
              <option value="all">All Categories</option>
              <option value="teacher">Teacher Admin</option>
              <option value="security">Auth & Security</option>
              <option value="exam">Exam Operations</option>
              <option value="billing">Billing Events</option>
              <option value="system">System Audit</option>
            </select>
          </div>

          {/* Date Range Picker Quick Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-text-dark/50 dark:text-light-mint/50 font-semibold">Range:</span>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="px-3 py-2 rounded-card border border-gray-300 dark:border-white/10 bg-white dark:bg-deep-teal text-text-dark dark:text-white font-medium focus:outline-none"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
            </select>
          </div>
        </div>
      </div>

      {/* Audit Log Data Table */}
      <div className="bg-white dark:bg-dark-surface rounded-card-lg border border-gray-200 dark:border-white/10 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 dark:border-white/10 flex items-center justify-between text-xs text-text-dark/60 dark:text-light-mint/60">
          <span>Showing <strong className="text-deep-teal dark:text-white">{logs.length}</strong> real audit log entries</span>
          <span className="font-mono text-[11px]">Audit Table: public.audit_logs</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/5 font-semibold text-text-dark/60 dark:text-light-mint/60 uppercase tracking-wider">
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Action Event</th>
                <th className="py-3 px-4">Target Resource</th>
                <th className="py-3 px-4">IP Address</th>
                <th className="py-3 px-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-xs text-text-dark/40 dark:text-light-mint/40 animate-pulse">
                    Fetching live audit logs from Supabase audit_logs table...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-xs text-text-dark/40 dark:text-light-mint/40">
                    No audit log entries matching search and filter criteria.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors font-mono">
                    {/* Timestamp */}
                    <td className="py-3.5 px-4 text-text-dark/60 dark:text-light-mint/60 whitespace-nowrap text-[11px]">
                      {formatTimestamp(log.created_at)}
                    </td>

                    {/* Actor */}
                    <td className="py-3.5 px-4 font-bold text-deep-teal dark:text-white">
                      {log.actor}
                    </td>

                    {/* Action */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded ${
                          log.category === 'security'
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                            : log.category === 'teacher'
                            ? 'bg-primary-teal/15 text-primary-teal'
                            : log.category === 'exam'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : log.category === 'billing'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                            : 'bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-light-mint'
                        }`}>
                          {log.category}
                        </span>
                        <span className="text-text-dark dark:text-white font-inter text-xs font-semibold">
                          {log.action}
                        </span>
                      </div>
                    </td>

                    {/* Target Resource */}
                    <td className="py-3.5 px-4 text-text-dark/70 dark:text-light-mint/70 font-inter text-xs">
                      {log.target || 'N/A'}
                    </td>

                    {/* IP Address */}
                    <td className="py-3.5 px-4 text-text-dark/60 dark:text-light-mint/60 text-[11px]">
                      {log.ip_address || '::1'}
                    </td>

                    {/* Status Badge */}
                    <td className="py-3.5 px-4 text-right">
                      {log.status === 'success' ? (
                        <Badge color="green">SUCCESS</Badge>
                      ) : log.status === 'failed' ? (
                        <Badge color="red">FAILED</Badge>
                      ) : (
                        <Badge color="gold">WARNING</Badge>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
