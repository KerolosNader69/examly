'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';

function ResetPasswordContent() {
  const router = useRouter();
  const [form, setForm] = useState({
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loadingSession, setLoadingSession] = useState(true);
  const [hasValidToken, setHasValidToken] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Password strength checks (identical to Signup)
  const passwordChecks = [
    { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
    { label: 'An uppercase letter (A-Z)', test: (p: string) => /[A-Z]/.test(p) },
    { label: 'A lowercase letter (a-z)', test: (p: string) => /[a-z]/.test(p) },
    { label: 'A number (0-9)', test: (p: string) => /[0-9]/.test(p) },
    { label: 'A special character (!@#$...)', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
  ];

  const metChecks = passwordChecks.filter((check) => check.test(form.password)).length;
  const strength =
    metChecks <= 1
      ? { label: 'Weak', color: 'text-rose-500', bar: 'bg-rose-500', width: '20%' }
      : metChecks <= 3
      ? { label: 'Fair', color: 'text-amber-500', bar: 'bg-amber-500', width: '50%' }
      : metChecks <= 4
      ? { label: 'Good', color: 'text-emerald-500', bar: 'bg-emerald-500', width: '75%' }
      : { label: 'Strong', color: 'text-emerald-600', bar: 'bg-primary-teal', width: '100%' };

  useEffect(() => {
    let isMounted = true;

    // Listen to Supabase auth state changes (captures PASSWORD_RECOVERY event from hash token)
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      if (event === 'PASSWORD_RECOVERY' || session) {
        setHasValidToken(true);
        setLoadingSession(false);
      }
    });

    // Also check current session immediately
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted) return;
      if (session) {
        setHasValidToken(true);
      }
      setLoadingSession(false);
    });

    return () => {
      isMounted = false;
      authListener?.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.password) {
      setError('Please enter a new password.');
      return;
    }

    if (metChecks < 5) {
      setError('Please meet all password requirements before continuing.');
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: form.password,
      });

      if (updateError) {
        throw new Error(updateError.message || 'Failed to update password.');
      }

      // Successfully updated password
      setSuccess(true);
      await supabase.auth.signOut();
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred while updating your password.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingSession) {
    return (
      <div className="bg-white dark:bg-dark-surface rounded-2xl p-10 shadow-2xl border border-gray-100 dark:border-light-mint/10 text-center">
        <div className="animate-pulse space-y-4">
          <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto" />
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mx-auto" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mx-auto" />
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="bg-white dark:bg-dark-surface rounded-2xl p-8 shadow-2xl border border-gray-100 dark:border-light-mint/10 text-center space-y-6">
        <div className="w-16 h-16 mx-auto rounded-full bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 flex items-center justify-center">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <div>
          <h1 className="text-2xl font-bold font-poppins text-deep-teal dark:text-white mb-2">
            Password Reset Complete
          </h1>
          <p className="text-sm text-text-dark/60 dark:text-light-mint/70 leading-relaxed">
            Your password has been updated successfully. You can now log in with your new password.
          </p>
        </div>

        <div className="pt-2">
          <Link
            href="/login"
            className="inline-block w-full py-3.5 rounded-card bg-primary-teal text-white font-semibold text-sm hover:bg-light-mint hover:text-deep-teal transition-colors shadow-md text-center"
          >
            Sign In Now
          </Link>
        </div>
      </div>
    );
  }

  if (!hasValidToken) {
    return (
      <div className="bg-white dark:bg-dark-surface rounded-2xl p-8 shadow-2xl border border-gray-100 dark:border-light-mint/10 text-center space-y-6">
        <div className="w-16 h-16 mx-auto rounded-full bg-amber-50 dark:bg-amber-500/20 text-amber-600 flex items-center justify-center">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>

        <div>
          <h1 className="text-2xl font-bold font-poppins text-deep-teal dark:text-white mb-2">
            Invalid or Expired Reset Link
          </h1>
          <p className="text-sm text-text-dark/60 dark:text-light-mint/70 leading-relaxed">
            This password reset link is invalid, has expired, or has already been used. Please request a new link to reset your password.
          </p>
        </div>

        <div className="pt-2 space-y-3">
          <Link
            href="/forgot-password"
            className="inline-block w-full py-3.5 rounded-card bg-primary-teal text-white font-semibold text-sm hover:bg-light-mint hover:text-deep-teal transition-colors shadow-md text-center"
          >
            Request New Reset Link
          </Link>
          <div>
            <Link href="/login" className="text-xs font-semibold text-primary-teal hover:underline">
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-dark-surface rounded-2xl p-8 shadow-2xl border border-gray-100 dark:border-light-mint/10">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold font-poppins text-deep-teal dark:text-white mb-1">
          Set New Password
        </h1>
        <p className="text-sm text-text-dark/60 dark:text-light-mint/70">
          Please enter your new password below.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {error && (
          <div className="p-3.5 rounded-card bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-start gap-2">
            <svg className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <div>
          <Input
            name="password"
            type={showPassword ? 'text' : 'password'}
            label="New Password"
            placeholder="Enter new strong password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 00-2 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            }
          />

          {form.password && (
            <div className="mt-3 p-3.5 rounded-card bg-bg-light dark:bg-dark-elevated border border-gray-200 dark:border-light-mint/15">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-text-dark/60 dark:text-light-mint/60">Password strength</span>
                <span className={`text-xs font-bold ${strength.color}`}>{strength.label}</span>
              </div>
              <div className="h-1.5 bg-gray-200 dark:bg-light-mint/15 rounded-full overflow-hidden mb-2.5">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${strength.bar}`}
                  style={{ width: strength.width }}
                />
              </div>
              <ul className="grid grid-cols-1 gap-1 text-xs">
                {passwordChecks.map((check, i) => {
                  const met = check.test(form.password);
                  return (
                    <li key={i} className={`flex items-center gap-1.5 ${met ? 'text-emerald-600 dark:text-emerald-400' : 'text-text-dark/50 dark:text-light-mint/50'}`}>
                      {met ? (
                        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      )}
                      {check.label}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>

        <Input
          name="confirmPassword"
          type={showPassword ? 'text' : 'password'}
          label="Confirm New Password"
          placeholder="Re-enter your new password"
          value={form.confirmPassword}
          onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          }
        />

        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            className="text-xs text-primary-teal hover:text-deep-teal dark:hover:text-light-mint transition-colors"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? 'Hide password' : 'Show password'}
          </button>
        </div>

        <Button type="submit" className="w-full text-base py-3.5 mt-4" disabled={submitting}>
          {submitting ? 'Updating Password...' : 'Update Password'}
        </Button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-[#F7F8FA] dark:bg-deep-teal flex items-center justify-center p-6">
      <div className="w-full max-w-md my-auto">
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

        <Suspense fallback={
          <div className="bg-white dark:bg-dark-surface rounded-2xl p-10 shadow-2xl border border-gray-100 dark:border-light-mint/10 text-center">
            <div className="animate-pulse space-y-4">
              <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto" />
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mx-auto" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mx-auto" />
            </div>
          </div>
        }>
          <ResetPasswordContent />
        </Suspense>
      </div>
    </div>
  );
}
