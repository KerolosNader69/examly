'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Badge from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';

// TODO: Update with finalized plan prices before production launch.
// Current placeholder pricing: free = $0, basic = $15, pro = $29 per month.

interface FinancialData {
  totalTeachers: number;
  activePaidCount: number;
  mrr: number;
  mrrLabel: string;
  arr: number;
  arpu: number;
  aiOperatingCost: {
    totalCompletedSessions: number;
    costPerSession: number;
    estimatedTotalCost: number;
    label: string;
  };
  netMetrics: {
    netMonthlyProfit: number;
    profitMarginPct: number;
  };
  tierBreakdown: {
    pro: { count: number; percentage: number; monthlyRevenue: number };
    basic: { count: number; percentage: number; monthlyRevenue: number };
    free: { count: number; percentage: number; monthlyRevenue: number };
  };
}

export default function AdminFinancialReportsPage() {
  const toast = useToast();
  const [data, setData] = useState<FinancialData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFinancials = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/admin/financial-reports');
      if (!res.ok) {
        throw new Error(`Failed to load financial reports (${res.status})`);
      }
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      console.error('Error loading financials:', err);
      setError(err.message || 'Failed to fetch financial metrics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFinancials();
  }, [fetchFinancials]);

  const handleDownloadReport = () => {
    toast('Financial metrics summary export initiated.', 'info');
  };

  const formatUSD = (val: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(val || 0);

  return (
    <div className="space-y-8 pb-12 font-inter">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-poppins text-deep-teal dark:text-white flex items-center gap-2.5">
            Financial Performance & AI Operating Costs
          </h1>
          <p className="text-xs text-text-dark/60 dark:text-light-mint/70 mt-1">
            Real subscriber counts from Supabase <code className="font-mono text-[11px] text-primary-teal">teachers</code> table and AI session operating costs.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchFinancials}
            disabled={loading}
            className="px-3 py-2 rounded-card border border-gray-300 dark:border-white/10 bg-white dark:bg-deep-teal text-text-dark dark:text-light-mint hover:bg-gray-50 text-xs font-semibold transition flex items-center gap-1.5"
            title="Refresh database subscriber counts"
          >
            <svg className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>

          <button
            onClick={handleDownloadReport}
            className="px-4 py-2 rounded-card bg-deep-teal dark:bg-primary-teal hover:bg-deep-teal/90 text-white font-bold text-xs shadow-md transition flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Download Summary
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-card bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center justify-between">
          <span>⚠️ {error}</span>
          <button onClick={fetchFinancials} className="underline text-xs">Retry</button>
        </div>
      )}

      {/* Prominent Disclaimer Banner */}
      <div className="p-4 rounded-card-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <span className="text-base">🏷️</span>
          <div>
            <span className="font-bold">Estimated Financial Metrics (Pricing Not Finalized):</span> Revenue projections are calculated using temporary tier defaults (Free = $0, Basic = $15/mo, Pro = $29/mo) applied to real Supabase subscriber counts. AI costs are estimated at ~$0.42 per completed oral session.
          </div>
        </div>
        <span className="px-2.5 py-1 rounded bg-amber-100 dark:bg-amber-900/60 font-mono text-[10px] font-bold uppercase whitespace-nowrap">
          ESTIMATED
        </span>
      </div>

      {/* Financial Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Gross MRR */}
        <div className="bg-white dark:bg-dark-surface rounded-card-lg border border-gray-200 dark:border-white/10 shadow-sm p-5 space-y-2 relative overflow-hidden">
          <span className="text-xs font-semibold text-text-dark/50 dark:text-light-mint/50 uppercase tracking-wider">
            Gross Monthly Revenue (MRR)
          </span>
          <p className="text-3xl font-extrabold font-poppins text-deep-teal dark:text-white">
            {loading ? '...' : formatUSD(data?.mrr || 0)}
          </p>
          <div className="flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400">
            <span>🏷️ {data?.mrrLabel || 'Estimated (pricing not finalized)'}</span>
          </div>
        </div>

        {/* AI Operating Cost */}
        <div className="bg-white dark:bg-dark-surface rounded-card-lg border border-gray-200 dark:border-white/10 shadow-sm p-5 space-y-2">
          <span className="text-xs font-semibold text-text-dark/50 dark:text-light-mint/50 uppercase tracking-wider">
            Estimated AI Operating Cost
          </span>
          <p className="text-3xl font-extrabold font-poppins text-deep-teal dark:text-white">
            {loading ? '...' : formatUSD(data?.aiOperatingCost?.estimatedTotalCost || 0)}
          </p>
          <p className="text-[11px] text-text-dark/60 dark:text-light-mint/60 font-mono">
            {data?.aiOperatingCost?.totalCompletedSessions || 0} completed oral sessions ($0.42/sess)
          </p>
        </div>

        {/* Net Profit Margin */}
        <div className="bg-white dark:bg-dark-surface rounded-card-lg border border-gray-200 dark:border-white/10 shadow-sm p-5 space-y-2">
          <span className="text-xs font-semibold text-text-dark/50 dark:text-light-mint/50 uppercase tracking-wider">
            Net Monthly Operating Profit
          </span>
          <p className="text-3xl font-extrabold font-poppins text-emerald-600 dark:text-emerald-400">
            {loading ? '...' : formatUSD(data?.netMetrics?.netMonthlyProfit || 0)}
          </p>
          <p className="text-[11px] text-emerald-700 dark:text-emerald-300 font-mono font-semibold">
            {data?.netMetrics?.profitMarginPct || 0}% estimated gross margin
          </p>
        </div>

        {/* ARPU */}
        <div className="bg-white dark:bg-dark-surface rounded-card-lg border border-gray-200 dark:border-white/10 shadow-sm p-5 space-y-2">
          <span className="text-xs font-semibold text-text-dark/50 dark:text-light-mint/50 uppercase tracking-wider">
            ARPU (Avg Revenue / User)
          </span>
          <p className="text-3xl font-extrabold font-poppins text-deep-teal dark:text-white">
            {loading ? '...' : formatUSD(data?.arpu || 0)}
          </p>
          <p className="text-[11px] text-text-dark/60 dark:text-light-mint/60 font-mono">
            Across {data?.totalTeachers || 0} total registered teachers
          </p>
        </div>
      </div>

      {/* Grid: Subscriber Tier Breakdown & Cost Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Subscribers by Tier Breakdown */}
        <div className="bg-white dark:bg-dark-surface rounded-card-lg border border-gray-200 dark:border-white/10 shadow-sm p-6 sm:p-8 space-y-6">
          <div className="border-b border-gray-100 dark:border-white/10 pb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold font-poppins text-deep-teal dark:text-white">
                Subscribers & Revenue by Tier
              </h2>
              <p className="text-xs text-text-dark/60 dark:text-light-mint/70 mt-0.5">
                Real count of teachers from Supabase database grouped by plan.
              </p>
            </div>
            <span className="px-2.5 py-0.5 text-[10px] font-bold font-mono uppercase rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300">
              PRICING NOT FINALIZED
            </span>
          </div>

          {loading ? (
            <div className="py-12 text-center text-xs text-text-dark/40 dark:text-light-mint/40 animate-pulse">
              Calculating subscriber tier metrics...
            </div>
          ) : (
            <div className="space-y-6">
              {/* Pro Tier */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-deep-teal dark:text-white flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-gold-accent inline-block"></span>
                    Pro Plan ($29/month placeholder)
                  </span>
                  <span className="font-mono font-bold text-deep-teal dark:text-white">
                    {data?.tierBreakdown?.pro?.count || 0} teachers • <span className="text-gold-accent">{formatUSD(data?.tierBreakdown?.pro?.monthlyRevenue || 0)} MRR</span>
                  </span>
                </div>
                <div className="h-3 bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gold-accent rounded-full transition-all duration-500"
                    style={{ width: `${data?.tierBreakdown?.pro?.percentage || 0}%` }}
                  ></div>
                </div>
                <div className="flex justify-between text-[11px] text-text-dark/50 dark:text-light-mint/50 font-mono">
                  <span>{data?.tierBreakdown?.pro?.percentage || 0}% of subscriber base</span>
                  <span>Highest tier contribution</span>
                </div>
              </div>

              {/* Basic Tier */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-deep-teal dark:text-white flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-primary-teal inline-block"></span>
                    Basic Plan ($15/month placeholder)
                  </span>
                  <span className="font-mono font-bold text-deep-teal dark:text-white">
                    {data?.tierBreakdown?.basic?.count || 0} teachers • <span className="text-primary-teal">{formatUSD(data?.tierBreakdown?.basic?.monthlyRevenue || 0)} MRR</span>
                  </span>
                </div>
                <div className="h-3 bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary-teal rounded-full transition-all duration-500"
                    style={{ width: `${data?.tierBreakdown?.basic?.percentage || 0}%` }}
                  ></div>
                </div>
                <div className="flex justify-between text-[11px] text-text-dark/50 dark:text-light-mint/50 font-mono">
                  <span>{data?.tierBreakdown?.basic?.percentage || 0}% of subscriber base</span>
                  <span>Standard tier contribution</span>
                </div>
              </div>

              {/* Free Tier */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-deep-teal dark:text-white flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-gray-400 inline-block"></span>
                    Free Tier ($0/month)
                  </span>
                  <span className="font-mono font-bold text-deep-teal dark:text-white">
                    {data?.tierBreakdown?.free?.count || 0} teachers • <span className="text-gray-400">$0.00 MRR</span>
                  </span>
                </div>
                <div className="h-3 bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gray-400 rounded-full transition-all duration-500"
                    style={{ width: `${data?.tierBreakdown?.free?.percentage || 0}%` }}
                  ></div>
                </div>
                <div className="flex justify-between text-[11px] text-text-dark/50 dark:text-light-mint/50 font-mono">
                  <span>{data?.tierBreakdown?.free?.percentage || 0}% of subscriber base</span>
                  <span>Trial / Free user pool</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Chart 2: AI Operating Cost vs Revenue Comparison */}
        <div className="bg-white dark:bg-dark-surface rounded-card-lg border border-gray-200 dark:border-white/10 shadow-sm p-6 sm:p-8 space-y-6">
          <div className="border-b border-gray-100 dark:border-white/10 pb-4">
            <h2 className="text-lg font-bold font-poppins text-deep-teal dark:text-white">
              AI Infrastructure Cost vs Revenue
            </h2>
            <p className="text-xs text-text-dark/60 dark:text-light-mint/70 mt-0.5">
              Subscriber revenue estimate vs AI STT & LLM evaluation costs ($0.42 / session).
            </p>
          </div>

          <div className="space-y-4 text-xs">
            <div className="p-4 rounded-card bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 flex items-center justify-between">
              <div>
                <p className="font-bold text-deep-teal dark:text-white">Estimated Gross MRR</p>
                <p className="text-[11px] text-text-dark/50 dark:text-light-mint/50 mt-0.5">Sum of active paid plan pricing</p>
              </div>
              <span className="font-mono font-bold text-deep-teal dark:text-white text-sm">
                {formatUSD(data?.mrr || 0)}
              </span>
            </div>

            <div className="p-4 rounded-card bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 flex items-center justify-between text-rose-900 dark:text-rose-200">
              <div>
                <p className="font-bold">Deepgram & Gemini AI Operating Cost</p>
                <p className="text-[11px] text-rose-700 dark:text-rose-300 mt-0.5 font-mono">
                  {data?.aiOperatingCost?.totalCompletedSessions || 0} completed oral sessions × $0.42
                </p>
              </div>
              <span className="font-mono font-bold text-rose-600 dark:text-rose-400 text-sm">
                - {formatUSD(data?.aiOperatingCost?.estimatedTotalCost || 0)}
              </span>
            </div>

            <div className="p-4 rounded-card bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between text-emerald-900 dark:text-emerald-100">
              <div>
                <p className="font-bold">Net Gross Profit</p>
                <p className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-0.5">Retained earnings after AI costs</p>
              </div>
              <span className="font-mono font-extrabold text-base text-emerald-600 dark:text-emerald-400">
                {formatUSD(data?.netMetrics?.netMonthlyProfit || 0)}
              </span>
            </div>

            <div className="p-3 rounded-card bg-amber-50/50 dark:bg-amber-950/30 border border-dashed border-amber-200 dark:border-amber-800/50 text-[11px] text-amber-800 dark:text-amber-300 font-mono text-center">
              ⚠️ {data?.aiOperatingCost?.label || 'Estimated AI cost ($0.42/session), not exact billing'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
