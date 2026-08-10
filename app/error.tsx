'use client';

import React from 'react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-[70vh] bg-bg-light dark:bg-deep-teal flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 mx-auto rounded-full bg-error/10 flex items-center justify-center mb-6">
          <svg className="w-10 h-10 text-error" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold font-poppins text-deep-teal dark:text-white mb-3">Something went wrong</h1>
        <p className="text-text-dark/60 dark:text-light-mint/70 mb-2">
          An unexpected error occurred. Please try again.
        </p>
        {error.message && (
          <p className="text-sm text-text-dark/40 dark:text-light-mint/50 mb-8 font-mono break-all">{error.message}</p>
        )}
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-card bg-primary-teal text-white font-medium hover:bg-light-mint transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Try again
        </button>
      </div>
    </div>
  );
}
