import React from 'react';
import Link from 'next/link';

interface TeacherNotFoundStateProps {
  subdomain: string;
}

export default function TeacherNotFoundState({ subdomain }: TeacherNotFoundStateProps) {
  return (
    <div className="min-h-screen bg-[#F7F8FA] dark:bg-deep-teal flex items-center justify-center p-6">
      <div className="text-center max-w-lg bg-white dark:bg-dark-surface p-8 sm:p-10 rounded-2xl border border-amber-500/20 shadow-2xl space-y-6 relative overflow-hidden">
        {/* Visual Badge Accent Bar */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-amber-500 via-primary-teal to-accent-mint" />

        {/* Icon & Subdomain Tag */}
        <div className="space-y-3">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <span className="inline-block px-3 py-1 text-xs font-semibold rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 font-mono">
            {subdomain ? `${subdomain}.examly.site` : 'Invalid Subdomain'}
          </span>
        </div>

        {/* Text Details */}
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold font-poppins text-deep-teal dark:text-white">
            This teacher page doesn&apos;t exist
          </h1>
          <p className="text-sm text-text-dark/70 dark:text-light-mint/80 leading-relaxed max-w-md mx-auto">
            We couldn&apos;t find an active teacher portal registered at{' '}
            <strong className="font-mono text-primary-teal">{subdomain}.examly.site</strong> (or{' '}
            <span className="font-mono">{subdomain}.lvh.me</span>). Please check the link for typos or ask your instructor for their updated portal URL.
          </p>
        </div>

        {/* Informational banner distinguishing from site-wide outage */}
        <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs text-left flex items-start gap-2.5">
          <svg className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>
            <strong>Examly is up and running:</strong> This issue is specific to this teacher link, not the main platform.
          </span>
        </div>

        {/* Action Button */}
        <div className="pt-2">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 w-full py-3.5 px-6 rounded-card bg-primary-teal text-white font-semibold text-sm hover:bg-light-mint transition-all shadow-md"
          >
            <span>Return to Examly Homepage</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
}
