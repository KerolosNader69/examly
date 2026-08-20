'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { forgotPasswordSchema } from '@/lib/schemas';
import { supabase } from '@/lib/supabase';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const sendResetEmail = async (targetEmail: string) => {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : 'https://examly.site');
    const redirectTo = `${appUrl}/auth/reset-password`;

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(targetEmail, {
      redirectTo,
    });

    if (resetError) {
      throw new Error(resetError.message || 'Failed to send password reset email.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = forgotPasswordSchema.safeParse({ email });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setError('');
    setSubmitting(true);

    try {
      await sendResetEmail(email);
      setSent(true);
      setCooldown(30);
    } catch (err: any) {
      setError(err.message || 'Unable to send password reset email. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || submitting) return;
    setError('');
    setSubmitting(true);
    try {
      await sendResetEmail(email);
      setCooldown(30);
    } catch (err: any) {
      setError(err.message || 'Failed to resend reset email.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F8FA] dark:bg-deep-teal flex items-center justify-center p-6">
      <div className="w-full max-w-md my-auto">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Link href="/" className="inline-flex items-center">
            <Image
              src="/assets/logo/ChatGPT Image Aug 11, 2026, 03_55_47 AM.png"
              alt="Examly Logo"
              width={140}
              height={56}
              className="object-contain"
              priority
            />
          </Link>
        </div>

        {/* Centered Card */}
        <div className="bg-white dark:bg-dark-surface rounded-2xl p-8 shadow-2xl border border-gray-100 dark:border-light-mint/10 text-center">
          {sent ? (
            /* Success State */
            <div className="space-y-6">
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 flex items-center justify-center">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>

              <div>
                <h1 className="text-2xl font-bold font-poppins text-deep-teal dark:text-white mb-2">
                  Check your inbox
                </h1>
                <p className="text-sm text-text-dark/60 dark:text-light-mint/70 leading-relaxed">
                  We&apos;ve sent a password reset link to{' '}
                  <span className="font-semibold text-deep-teal dark:text-light-mint">{email}</span>.
                </p>
              </div>

              {error && (
                <div className="p-3 rounded-card bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs text-left">
                  {error}
                </div>
              )}

              <div className="pt-2 space-y-3">
                <button
                  onClick={handleResend}
                  disabled={cooldown > 0 || submitting}
                  className={`text-xs font-semibold ${
                    cooldown > 0 || submitting ? 'text-text-dark/40 dark:text-light-mint/40 cursor-not-allowed' : 'text-primary-teal hover:underline'
                  }`}
                >
                  {submitting ? 'Sending...' : cooldown > 0 ? `Resend link in ${cooldown}s` : 'Resend link'}
                </button>

                <div>
                  <Link
                    href="/login"
                    className="inline-block w-full py-3 rounded-card bg-primary-teal text-white font-semibold text-sm hover:bg-light-mint hover:text-deep-teal transition-colors shadow-md text-center"
                  >
                    Back to Login
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            /* Form State */
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold font-poppins text-deep-teal dark:text-white mb-1">
                  Reset your password
                </h1>
                <p className="text-sm text-text-dark/60 dark:text-light-mint/70">
                  Enter your email address and we&apos;ll send you a password reset link.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5 text-left" noValidate>
                {error && (
                  <div className="p-3.5 rounded-card bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-start gap-2">
                    <svg className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{error}</span>
                  </div>
                )}

                <Input
                  name="email"
                  type="email"
                  label="Email address"
                  placeholder="you@school.edu"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError('');
                  }}
                  error={error}
                  icon={
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  }
                />

                <Button type="submit" className="w-full text-base py-3.5" disabled={submitting}>
                  {submitting ? 'Sending Link...' : 'Send Reset Link'}
                </Button>

                <div className="text-center pt-2">
                  <Link href="/login" className="text-sm font-semibold text-primary-teal hover:text-deep-teal dark:hover:text-light-mint transition-colors">
                    Back to Login
                  </Link>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
