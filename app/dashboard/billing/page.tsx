'use client';

import React, { useState } from 'react';
import Badge from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';

type PlanTier = 'Free' | 'Basic' | 'Pro';

interface Invoice {
  id: string;
  date: string;
  description: string;
  amount: string;
  status: 'paid' | 'failed';
  invoiceUrl: string;
}

const mockInvoices: Invoice[] = [
  {
    id: 'INV-2026-005',
    date: 'Aug 01, 2026',
    description: 'Pro Plan - Monthly Subscription',
    amount: '$29.00',
    status: 'paid',
    invoiceUrl: '#',
  },
  {
    id: 'INV-2026-004',
    date: 'Jul 01, 2026',
    description: 'Pro Plan - Monthly Subscription',
    amount: '$29.00',
    status: 'paid',
    invoiceUrl: '#',
  },
  {
    id: 'INV-2026-003',
    date: 'Jun 01, 2026',
    description: 'Pro Plan - Monthly Subscription',
    amount: '$29.00',
    status: 'paid',
    invoiceUrl: '#',
  },
  {
    id: 'INV-2026-002',
    date: 'May 01, 2026',
    description: 'Basic Plan - Monthly Subscription (Failed Retry)',
    amount: '$15.00',
    status: 'failed',
    invoiceUrl: '#',
  },
  {
    id: 'INV-2026-001',
    date: 'Apr 01, 2026',
    description: 'Basic Plan - Monthly Subscription',
    amount: '$15.00',
    status: 'paid',
    invoiceUrl: '#',
  },
];

export default function TeacherBillingPage() {
  const toast = useToast();
  const [currentPlan, setCurrentPlan] = useState<PlanTier>('Free');
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  // Usage mock metrics
  const usageData = {
    Free: {
      studentsUsed: 42,
      studentsLimit: 50,
      examsUsed: 4,
      examsLimit: 5,
      price: '$0',
      period: 'Forever Free',
      renewalDate: 'N/A',
    },
    Basic: {
      studentsUsed: 180,
      studentsLimit: 250,
      examsUsed: 18,
      examsLimit: 20,
      price: '$15',
      period: 'per month',
      renewalDate: 'Sep 11, 2026',
    },
    Pro: {
      studentsUsed: 412,
      studentsLimit: 1000,
      examsUsed: 34,
      examsLimit: 100,
      price: '$29',
      period: 'per month',
      renewalDate: 'Sep 11, 2026',
    },
  };

  const activeUsage = usageData[currentPlan];

  const studentPercent = Math.min(100, Math.round((activeUsage.studentsUsed / activeUsage.studentsLimit) * 100));
  const examPercent = Math.min(100, Math.round((activeUsage.examsUsed / activeUsage.examsLimit) * 100));

  const handleDownloadInvoice = (invoiceId: string) => {
    toast(`Downloading invoice ${invoiceId}...`, 'info');
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-poppins text-deep-teal dark:text-white flex items-center gap-3">
            <span className="p-2 rounded-xl bg-primary-teal/10 text-primary-teal">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </span>
            Billing & Subscriptions
          </h1>
          <p className="text-text-dark/60 dark:text-light-mint/70 mt-1">
            Manage your subscription plan, view resource usage limits, and access invoice history.
          </p>
        </div>

        {/* Demo Plan Switcher Badge */}
        <div className="flex items-center gap-2 bg-white dark:bg-dark-surface p-1.5 rounded-card border border-primary-teal/20 shadow-sm text-xs font-semibold">
          <span className="text-text-dark/50 dark:text-light-mint/50 px-2">Demo Plan:</span>
          {(['Free', 'Basic', 'Pro'] as PlanTier[]).map((plan) => (
            <button
              key={plan}
              onClick={() => {
                setCurrentPlan(plan);
                toast(`Switched view to ${plan} Plan`, 'info');
              }}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                currentPlan === plan
                  ? 'bg-primary-teal text-white shadow-sm'
                  : 'text-text-dark/70 dark:text-light-mint/70 hover:bg-gray-100 dark:hover:bg-white/10'
              }`}
            >
              {plan}
            </button>
          ))}
        </div>
      </div>

      {/* 5. Upgrade Prompt Banner (Shown when on Free plan) */}
      {currentPlan === 'Free' && (
        <div className="bg-gradient-to-r from-deep-teal via-primary-teal to-teal-700 rounded-card-lg p-6 text-white shadow-lg relative overflow-hidden flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 border border-light-mint/20">
          <div className="space-y-2 z-10 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gold-accent/20 border border-gold-accent/40 text-gold-accent text-xs font-bold uppercase tracking-wider">
              ⚡ Free Plan Warning
            </div>
            <h3 className="text-xl font-bold font-poppins text-white">
              You are currently on the Free Plan
            </h3>
            <p className="text-sm text-light-mint/90">
              Upgrade to <span className="font-semibold text-white">Pro</span> to unlock unlimited AI oral exams, custom audio grading parameters, and priority student capacity.
            </p>
          </div>
          <button
            onClick={() => setIsUpgradeModalOpen(true)}
            className="z-10 px-6 py-3 rounded-card bg-gold-accent hover:bg-amber-400 text-deep-teal font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center gap-2 whitespace-nowrap"
          >
            <svg className="w-5 h-5 text-deep-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Upgrade Now
          </button>
          {/* Subtle background overlay effect */}
          <div className="absolute -right-12 -bottom-12 w-48 h-48 rounded-full bg-white/5 pointer-events-none"></div>
        </div>
      )}

      {/* Top Grid: Plan Overview + Usage Meters */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 1. Current Plan Card */}
        <div className="lg:col-span-1 bg-white dark:bg-dark-surface rounded-card-lg border border-primary-teal/10 shadow-sm p-6 flex flex-col justify-between space-y-6">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-text-dark/50 dark:text-light-mint/50">
                Current Plan
              </span>
              <span
                className={`px-3 py-1 text-xs font-bold rounded-full ${
                  currentPlan === 'Pro'
                    ? 'bg-gold-accent/15 text-gold-accent border border-gold-accent/30'
                    : currentPlan === 'Basic'
                    ? 'bg-primary-teal/15 text-primary-teal border border-primary-teal/30'
                    : 'bg-gray-100 dark:bg-white/10 text-text-dark dark:text-light-mint'
                }`}
              >
                {currentPlan} Tier
              </span>
            </div>

            <div className="space-y-1 mb-4">
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-extrabold font-poppins text-deep-teal dark:text-white">
                  {activeUsage.price}
                </span>
                <span className="text-sm text-text-dark/60 dark:text-light-mint/70">
                  /{activeUsage.period}
                </span>
              </div>
              {currentPlan !== 'Free' && (
                <p className="text-xs text-text-dark/60 dark:text-light-mint/60">
                  Renews on <span className="font-semibold text-deep-teal dark:text-light-mint">{activeUsage.renewalDate}</span>
                </p>
              )}
            </div>

            <p className="text-xs text-text-dark/70 dark:text-light-mint/70 leading-relaxed border-t border-gray-100 dark:border-white/10 pt-4">
              {currentPlan === 'Free' && 'Includes up to 50 active students and 5 oral exams per month.'}
              {currentPlan === 'Basic' && 'Includes up to 250 active students and 20 oral exams per month.'}
              {currentPlan === 'Pro' && 'Includes up to 1,000 active students and 100 oral exams per month with priority AI processing.'}
            </p>
          </div>

          <div className="space-y-2 pt-2">
            <button
              onClick={() => setIsUpgradeModalOpen(true)}
              className="w-full py-2.5 rounded-card bg-primary-teal hover:bg-primary-teal/90 text-white font-semibold text-sm shadow-sm transition-all"
            >
              {currentPlan === 'Free' ? 'Upgrade Plan' : 'Change / Upgrade Plan'}
            </button>
            {currentPlan !== 'Free' && (
              <button
                onClick={() => {
                  setCurrentPlan('Free');
                  toast('Downgraded plan to Free', 'info');
                }}
                className="w-full py-2 text-xs font-semibold text-text-dark/50 dark:text-light-mint/50 hover:text-rose-500 transition-colors"
              >
                Downgrade to Free
              </button>
            )}
          </div>
        </div>

        {/* 2. Usage Meters Card */}
        <div className="lg:col-span-2 bg-white dark:bg-dark-surface rounded-card-lg border border-primary-teal/10 shadow-sm p-6 space-y-6 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-white/10 pb-4">
            <div>
              <h2 className="text-lg font-bold font-poppins text-deep-teal dark:text-white">Resource Usage Limits</h2>
              <p className="text-xs text-text-dark/60 dark:text-light-mint/70">
                Monthly quota reset takes place on the 1st of every month.
              </p>
            </div>
            <span className="text-xs font-semibold text-primary-teal bg-primary-teal/10 px-2.5 py-1 rounded">
              Active Billing Cycle
            </span>
          </div>

          <div className="space-y-6">
            {/* Meter 1: Students Used */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-deep-teal dark:text-light-mint flex items-center gap-2">
                  <svg className="w-4 h-4 text-primary-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  Students Enrolled
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-deep-teal dark:text-white">
                    {activeUsage.studentsUsed} / {activeUsage.studentsLimit}
                  </span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                    studentPercent >= 80 ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' : 'bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-light-mint'
                  }`}>
                    {studentPercent}%
                  </span>
                </div>
              </div>

              {/* Bar */}
              <div className="h-3 bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden p-0.5 border border-gray-200/50 dark:border-white/5">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    studentPercent >= 80 ? 'bg-gradient-to-r from-amber-400 to-amber-500' : 'bg-gradient-to-r from-primary-teal to-emerald-400'
                  }`}
                  style={{ width: `${studentPercent}%` }}
                ></div>
              </div>
              {studentPercent >= 80 && (
                <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                  ⚠️ Approaching student capacity limit ({studentPercent}% used)
                </p>
              )}
            </div>

            {/* Meter 2: Exams Created */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-deep-teal dark:text-light-mint flex items-center gap-2">
                  <svg className="w-4 h-4 text-primary-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Exams Created (This Month)
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-deep-teal dark:text-white">
                    {activeUsage.examsUsed} / {activeUsage.examsLimit}
                  </span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                    examPercent >= 80 ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' : 'bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-light-mint'
                  }`}>
                    {examPercent}%
                  </span>
                </div>
              </div>

              {/* Bar */}
              <div className="h-3 bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden p-0.5 border border-gray-200/50 dark:border-white/5">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    examPercent >= 80 ? 'bg-gradient-to-r from-amber-400 to-amber-500' : 'bg-gradient-to-r from-primary-teal to-emerald-400'
                  }`}
                  style={{ width: `${examPercent}%` }}
                ></div>
              </div>
              {examPercent >= 80 && (
                <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                  ⚠️ Almost out of monthly exam creation credits ({examPercent}% used)
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Payment Method Section */}
      <div className="bg-white dark:bg-dark-surface rounded-card-lg border border-primary-teal/10 shadow-sm p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-white/10 pb-4">
          <div>
            <h2 className="text-xl font-bold font-poppins text-deep-teal dark:text-white">Payment Method</h2>
            <p className="text-sm text-text-dark/60 dark:text-light-mint/70">
              Manage your default payment card for recurring plan renewals.
            </p>
          </div>
          <span className="text-xs font-medium text-text-dark/50 dark:text-light-mint/50 bg-gray-100 dark:bg-white/5 px-3 py-1 rounded-full">
            Paymob Ready
          </span>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 p-5 rounded-card border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/5">
          <div className="flex items-center gap-4">
            {/* Card Brand Mock Icon */}
            <div className="w-14 h-10 rounded-lg bg-deep-teal text-white font-bold text-xs flex items-center justify-center shadow-md flex-shrink-0 tracking-wider">
              VISA
            </div>
            <div>
              <p className="text-sm font-semibold text-deep-teal dark:text-white flex items-center gap-2">
                <span className="font-mono text-base tracking-widest">•••• •••• •••• 4242</span>
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                  Primary
                </span>
              </p>
              <p className="text-xs text-text-dark/60 dark:text-light-mint/70 mt-0.5">
                Expires 12 / 2028 • Visa Debit
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsPaymentModalOpen(true)}
            className="px-5 py-2 rounded-card border border-primary-teal text-primary-teal hover:bg-primary-teal hover:text-white font-semibold text-sm transition-colors whitespace-nowrap"
          >
            Update Payment Method
          </button>
        </div>
      </div>

      {/* 4. Invoice History Table */}
      <div className="bg-white dark:bg-dark-surface rounded-card-lg border border-primary-teal/10 shadow-sm p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-white/10 pb-4">
          <div>
            <h2 className="text-xl font-bold font-poppins text-deep-teal dark:text-white">Invoice History</h2>
            <p className="text-sm text-text-dark/60 dark:text-light-mint/70">
              Download past billing statements and receipts.
            </p>
          </div>
          <span className="text-xs text-text-dark/50 dark:text-light-mint/50">
            {mockInvoices.length} invoices found
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-200 dark:border-white/10 text-xs font-semibold text-text-dark/60 dark:text-light-mint/60 uppercase tracking-wider">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5 font-medium">
              {mockInvoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors">
                  <td className="py-3.5 px-4 text-deep-teal dark:text-white font-mono text-xs">
                    {inv.date}
                  </td>
                  <td className="py-3.5 px-4 text-text-dark/80 dark:text-light-mint">
                    {inv.description}
                  </td>
                  <td className="py-3.5 px-4 font-bold text-deep-teal dark:text-white font-mono">
                    {inv.amount}
                  </td>
                  <td className="py-3.5 px-4">
                    {inv.status === 'paid' ? (
                      <Badge color="green">Paid</Badge>
                    ) : (
                      <Badge color="red">Failed</Badge>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => handleDownloadInvoice(inv.id)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-teal hover:text-deep-teal dark:hover:text-white transition-colors"
                      title="Download PDF Invoice"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      PDF
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Upgrade Plan Modal */}
      {isUpgradeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-dark-surface max-w-xl w-full rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xl border border-primary-teal/20 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-white/10 pb-4">
              <h3 className="text-xl font-bold font-poppins text-deep-teal dark:text-white">
                Choose Plan Upgrade
              </h3>
              <button
                onClick={() => setIsUpgradeModalOpen(false)}
                className="text-text-dark/40 hover:text-text-dark dark:text-light-mint/40 dark:hover:text-light-mint"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Basic Plan option */}
              <div
                onClick={() => {
                  setCurrentPlan('Basic');
                  setIsUpgradeModalOpen(false);
                  toast('Upgraded to Basic Plan!', 'success');
                }}
                className="p-5 rounded-card border-2 border-gray-200 dark:border-white/10 hover:border-primary-teal cursor-pointer space-y-3 transition-all hover:shadow-md"
              >
                <div className="flex justify-between items-center">
                  <span className="font-bold font-poppins text-deep-teal dark:text-white">Basic Plan</span>
                  <span className="text-sm font-bold text-primary-teal">$15/mo</span>
                </div>
                <p className="text-xs text-text-dark/60 dark:text-light-mint/70">
                  Great for individual teachers running regular class exams.
                </p>
                <ul className="text-xs space-y-1 text-text-dark/80 dark:text-light-mint">
                  <li>✓ Up to 250 active students</li>
                  <li>✓ 20 oral exams / month</li>
                </ul>
              </div>

              {/* Pro Plan option */}
              <div
                onClick={() => {
                  setCurrentPlan('Pro');
                  setIsUpgradeModalOpen(false);
                  toast('Upgraded to Pro Plan!', 'success');
                }}
                className="p-5 rounded-card border-2 border-primary-teal bg-primary-teal/5 cursor-pointer space-y-3 transition-all hover:shadow-md relative"
              >
                <span className="absolute -top-3 right-4 px-2 py-0.5 rounded-full bg-primary-teal text-white text-[10px] font-bold uppercase">
                  Popular
                </span>
                <div className="flex justify-between items-center">
                  <span className="font-bold font-poppins text-deep-teal dark:text-white">Pro Plan</span>
                  <span className="text-sm font-bold text-primary-teal">$29/mo</span>
                </div>
                <p className="text-xs text-text-dark/60 dark:text-light-mint/70">
                  For department heads & schools requiring high capacity.
                </p>
                <ul className="text-xs space-y-1 text-text-dark/80 dark:text-light-mint">
                  <li>✓ Up to 1,000 active students</li>
                  <li>✓ 100 oral exams / month</li>
                  <li>✓ Priority AI grading queue</li>
                </ul>
              </div>
            </div>

            <div className="pt-2 text-right">
              <button
                onClick={() => setIsUpgradeModalOpen(false)}
                className="px-5 py-2 rounded-card text-xs font-semibold text-text-dark/60 dark:text-light-mint/60 hover:text-text-dark"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Update Modal Placeholder */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-dark-surface max-w-md w-full rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xl border border-primary-teal/20 animate-fadeIn text-center">
            <div className="w-12 h-12 rounded-full bg-primary-teal/10 text-primary-teal flex items-center justify-center mx-auto">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h3 className="text-xl font-bold font-poppins text-deep-teal dark:text-white">
                Paymob Integration
              </h3>
              <p className="text-xs text-text-dark/60 dark:text-light-mint/70 mt-2">
                Payment gateway integration via Paymob is queued for production setup. In production, this modal opens the secure Paymob card entry iframe.
              </p>
            </div>
            <button
              onClick={() => {
                setIsPaymentModalOpen(false);
                toast('Payment method updated mock state!', 'success');
              }}
              className="w-full py-2.5 rounded-card bg-primary-teal text-white font-semibold text-sm shadow-md"
            >
              Simulate Card Update
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
