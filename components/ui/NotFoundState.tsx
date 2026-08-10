import React from 'react';
import Link from 'next/link';

interface NotFoundStateProps {
  title?: string;
  message?: string;
  backHref?: string;
  backLabel?: string;
}

export default function NotFoundState({
  title = 'Page not found',
  message = "Sorry, we couldn't find the page you're looking for.",
  backHref = '/',
  backLabel = 'Back to home',
}: NotFoundStateProps) {
  return (
    <div className="min-h-[70vh] bg-bg-light dark:bg-deep-teal flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 mx-auto rounded-full bg-primary-teal/10 flex items-center justify-center mb-6">
          <svg className="w-10 h-10 text-primary-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-7xl font-bold font-poppins text-primary-teal/30 mb-4">404</p>
        <h1 className="text-2xl font-bold font-poppins text-deep-teal dark:text-white mb-3">{title}</h1>
        <p className="text-text-dark/60 dark:text-light-mint/70 mb-8">{message}</p>
        <Link
          href={backHref}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-card bg-primary-teal text-white font-medium hover:bg-light-mint transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          {backLabel}
        </Link>
      </div>
    </div>
  );
}
