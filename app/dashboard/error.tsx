'use client';

import React from 'react';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  void error;
  return (
    <div className="py-20 text-center max-w-md mx-auto">
      <div className="w-20 h-20 mx-auto rounded-full bg-error/10 flex items-center justify-center mb-6">
        <svg className="w-10 h-10 text-error" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <h1 className="text-2xl font-bold font-poppins text-deep-teal dark:text-white mb-2">Something went wrong</h1>
      <p className="text-text-dark/60 dark:text-light-mint/70 mb-6">An unexpected error occurred in the dashboard.</p>
      <button
        onClick={reset}
        className="inline-flex items-center gap-2 px-6 py-3 rounded-card bg-primary-teal text-white font-medium hover:bg-light-mint transition-colors"
      >
        Try again
      </button>
    </div>
  );
}
