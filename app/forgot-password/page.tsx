'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import AuthLayout from '@/components/auth/AuthLayout';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { forgotPasswordSchema } from '@/lib/schemas';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = forgotPasswordSchema.safeParse({ email });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setSent(true);
  };

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter your email and we'll send you a reset link."
    >
      {sent ? (
        <div className="text-center py-8">
          <div className="w-20 h-20 mx-auto rounded-full bg-emerald-50 dark:bg-emerald-500/15 flex items-center justify-center mb-6">
            <svg className="w-10 h-10 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold font-poppins text-deep-teal dark:text-white mb-2">Check your inbox</h2>
          <p className="text-text-dark/60 dark:text-light-mint/70 mb-6">
            We&apos;ve sent a password reset link to <span className="font-semibold text-deep-teal dark:text-light-mint">{email}</span>.
          </p>
          <Link
            href="/login"
            className="inline-block px-6 py-3 rounded-card bg-primary-teal text-white font-semibold hover:bg-light-mint transition-colors"
          >
            Back to Login
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
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
          <Button type="submit" className="w-full text-lg py-3.5">
            Send Reset Link
          </Button>
          <p className="text-center text-text-dark/60 dark:text-light-mint/60">
            Remembered it?{' '}
            <Link href="/login" className="text-primary-teal font-semibold hover:text-deep-teal dark:hover:text-light-mint transition-colors">
              Back to login
            </Link>
          </p>
        </form>
      )}
    </AuthLayout>
  );
}
