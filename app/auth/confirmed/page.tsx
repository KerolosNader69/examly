'use client';

import React, { Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

function ConfirmedContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  const isError = Boolean(error || errorDescription);

  return (
    <div className="max-w-lg mx-auto w-full bg-white dark:bg-dark-surface p-8 sm:p-10 rounded-card-lg border border-primary-teal/10 shadow-xl text-center">
      {isError ? (
        /* Error or Direct Visit Edge Case */
        <div className="space-y-6">
          <div className="w-16 h-16 mx-auto rounded-full bg-amber-50 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold font-poppins text-deep-teal dark:text-white mb-2">
              Verification Link Required
            </h1>
            <p className="text-sm text-text-dark/70 dark:text-light-mint/70">
              {errorDescription || 'This page is used after verifying your email address. If you already confirmed your account, you can sign in directly.'}
            </p>
          </div>
          <div className="pt-2">
            <Link
              href="/login"
              className="inline-flex items-center justify-center w-full py-3.5 px-6 rounded-card bg-primary-teal text-white font-semibold text-base hover:bg-light-mint hover:text-deep-teal transition-all duration-200 shadow-md"
            >
              Go to Sign In
            </Link>
          </div>
        </div>
      ) : (
        /* Success State */
        <div className="space-y-6">
          {/* Mascot in Celebrating Pose */}
          <div className="relative w-36 h-36 mx-auto mb-2">
            <Image
              src="/assets/mascot/ChatGPT Image Aug 11, 2026, 03_05_50 AM.png"
              alt="Celebrating Mascot"
              fill
              className="object-contain drop-shadow-md"
              priority
            />
          </div>

          {/* Checkmark Badge */}
          <div className="w-14 h-14 mx-auto rounded-full bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-sm">
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <div>
            <h1 className="text-2xl sm:text-3xl font-bold font-poppins text-deep-teal dark:text-white mb-2">
              Your email is confirmed!
            </h1>
            <p className="text-sm sm:text-base text-text-dark/70 dark:text-light-mint/70 max-w-sm mx-auto">
              You can now sign in to your Examly account and start creating exams.
            </p>
          </div>

          <div className="pt-2">
            <Link
              href="/login"
              className="inline-flex items-center justify-center w-full py-3.5 px-6 rounded-card bg-primary-teal text-white font-semibold text-base hover:bg-light-mint hover:text-deep-teal transition-all duration-200 shadow-md"
            >
              Sign In Now
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AuthConfirmedPage() {
  return (
    <>
      <Header />
      <main className="bg-bg-light dark:bg-deep-teal min-h-[calc(100vh-140px)] flex items-center justify-center py-16 px-4 sm:px-6 lg:px-8">
        <Suspense fallback={
          <div className="max-w-lg mx-auto w-full bg-white dark:bg-dark-surface p-10 rounded-card-lg border border-primary-teal/10 shadow-xl text-center">
            <div className="animate-pulse space-y-4">
              <div className="w-24 h-24 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto" />
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mx-auto" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mx-auto" />
            </div>
          </div>
        }>
          <ConfirmedContent />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
