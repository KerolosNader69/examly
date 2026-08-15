'use client';

import React, { useState, Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { supabase } from '@/lib/supabase';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || '';

  const [resending, setResending] = useState(false);
  const [resendStatus, setResendStatus] = useState<{ success?: string; error?: string }>({});

  const handleResendEmail = async () => {
    if (!email) {
      setResendStatus({ error: 'Email address is missing. Please try logging in or signing up again.' });
      return;
    }

    setResending(true);
    setResendStatus({});

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: 'https://examly.site/auth/confirmed',
        },
      });

      if (error) {
        setResendStatus({ error: error.message });
      } else {
        setResendStatus({ success: `Verification link has been resent to ${email}!` });
      }
    } catch (err: any) {
      setResendStatus({ error: err.message || 'Failed to resend verification email.' });
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto w-full bg-white dark:bg-dark-surface p-8 sm:p-10 rounded-card-lg border border-primary-teal/10 shadow-2xl text-center relative overflow-hidden">
      {/* Background Accent */}
      <div className="absolute -top-12 -right-12 w-32 h-32 bg-primary-teal/10 rounded-full blur-2xl pointer-events-none"></div>

      {/* Mascot Image */}
      <div className="relative w-32 h-32 mx-auto mb-4">
        <Image
          src="/assets/mascot/ChatGPT Image Aug 11, 2026, 03_05_50 AM.png"
          alt="Examly Mascot Verification"
          fill
          className="object-contain drop-shadow-md"
          priority
        />
      </div>

      {/* Icon Badge */}
      <div className="w-14 h-14 mx-auto rounded-full bg-primary-teal/15 text-primary-teal flex items-center justify-center mb-5 shadow-sm">
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        </svg>
      </div>

      {/* Title & Subtitle */}
      <h1 className="text-2xl sm:text-3xl font-bold font-poppins text-deep-teal dark:text-white mb-2">
        Check your email
      </h1>
      <p className="text-sm sm:text-base text-text-dark/70 dark:text-light-mint/70 mb-6 leading-relaxed">
        We sent a verification link to{' '}
        <span className="font-semibold text-deep-teal dark:text-white break-all">
          {email || 'your email address'}
        </span>
        . Please verify your account to unlock your Examly teacher dashboard.
      </p>

      {/* Status Messages */}
      {resendStatus.success && (
        <div className="mb-6 p-3.5 rounded-card bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center justify-center gap-2">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
          <span>{resendStatus.success}</span>
        </div>
      )}

      {resendStatus.error && (
        <div className="mb-6 p-3.5 rounded-card bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center justify-center gap-2">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{resendStatus.error}</span>
        </div>
      )}

      {/* Verification Instructions List */}
      <div className="bg-bg-light dark:bg-deep-teal/40 rounded-card p-4 text-left text-xs space-y-2 mb-6 border border-primary-teal/10">
        <div className="flex items-start gap-2 text-text-dark/80 dark:text-light-mint/80">
          <span className="font-bold text-primary-teal">1.</span>
          <span>Open your email client and check inbox / spam folder.</span>
        </div>
        <div className="flex items-start gap-2 text-text-dark/80 dark:text-light-mint/80">
          <span className="font-bold text-primary-teal">2.</span>
          <span>Click on the <strong>Verify Email Address</strong> link inside the email.</span>
        </div>
        <div className="flex items-start gap-2 text-text-dark/80 dark:text-light-mint/80">
          <span className="font-bold text-primary-teal">3.</span>
          <span>Return here and log in to access your teacher portal!</span>
        </div>
      </div>

      {/* Buttons */}
      <div className="space-y-3">
        <Link
          href="/login"
          className="inline-flex items-center justify-center w-full py-3.5 px-6 rounded-card bg-primary-teal text-white font-semibold text-base hover:bg-light-mint hover:text-deep-teal transition-all duration-200 shadow-md"
        >
          I&apos;ve Verified — Go to Sign In
        </Link>

        {email && (
          <button
            type="button"
            onClick={handleResendEmail}
            disabled={resending}
            className="w-full py-2.5 px-4 text-xs font-semibold text-text-dark/60 dark:text-light-mint/70 hover:text-primary-teal dark:hover:text-light-mint transition-colors disabled:opacity-50"
          >
            {resending ? 'Resending verification email...' : "Didn't receive an email? Resend verification link"}
          </button>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <>
      <Header />
      <main className="bg-bg-light dark:bg-deep-teal min-h-[calc(100vh-140px)] flex items-center justify-center py-16 px-4 sm:px-6 lg:px-8">
        <Suspense
          fallback={
            <div className="max-w-lg mx-auto w-full bg-white dark:bg-dark-surface p-10 rounded-card-lg border border-primary-teal/10 shadow-xl text-center">
              <div className="animate-pulse space-y-4">
                <div className="w-20 h-20 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto" />
                <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mx-auto" />
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mx-auto" />
              </div>
            </div>
          }
        >
          <VerifyEmailContent />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
