'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('admin@examly.com');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Please enter both email and password.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || 'Authentication failed. Please check credentials.');
        setLoading(false);
        return;
      }

      // Successful login
      router.push('/admin');
      router.refresh();
    } catch (err: any) {
      console.error('Admin login error:', err);
      setError(err.message || 'An unexpected server error occurred.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-deep-teal flex items-center justify-center p-4 sm:p-6 relative overflow-hidden font-inter">
      {/* Subtle Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary-teal/10 rounded-full blur-3xl pointer-events-none"></div>

      {/* Centered Admin Card */}
      <div className="w-full max-w-md bg-white dark:bg-dark-surface rounded-2xl shadow-2xl border border-primary-teal/20 p-8 sm:p-10 relative z-10">
        {/* Logo Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <Link href="/" className="mb-6 inline-block">
            <Image
              src="/assets/logo/screen-removebg-preview.png"
              alt="Examly Logo"
              width={120}
              height={48}
              className="object-contain"
              priority
            />
          </Link>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-teal/10 text-primary-teal text-xs font-bold uppercase tracking-wider mb-2">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Internal System
          </div>
          <h1 className="text-2xl font-bold font-poppins text-deep-teal dark:text-white">
            Admin Access
          </h1>
          <p className="text-xs text-text-dark/50 dark:text-light-mint/60 mt-1">
            Restricted portal for Examly system administrators
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-3.5 rounded-card bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-300 text-xs font-medium flex items-center gap-2">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Admin Login Form */}
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-deep-teal dark:text-light-mint mb-2">
              Admin Email
            </label>
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="admin@examly.com"
                className="w-full pl-10 pr-4 py-3 rounded-card border border-gray-300 dark:border-white/10 bg-white dark:bg-deep-teal text-text-dark dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-teal transition font-mono"
              />
              <svg className="w-5 h-5 absolute left-3 top-3.5 text-text-dark/40 dark:text-light-mint/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-deep-teal dark:text-light-mint mb-2">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••••••"
                className="w-full pl-10 pr-10 py-3 rounded-card border border-gray-300 dark:border-white/10 bg-white dark:bg-deep-teal text-text-dark dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-teal transition"
              />
              <svg className="w-5 h-5 absolute left-3 top-3.5 text-text-dark/40 dark:text-light-mint/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3.5 text-text-dark/40 hover:text-text-dark dark:text-light-mint/40 dark:hover:text-light-mint transition"
              >
                {showPassword ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858-5.908a10.048 10.048 0 013.682-.763c4.478 0 8.268 2.943 9.542 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21M3 3l18 18" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-card bg-primary-teal hover:bg-primary-teal/90 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
          >
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Authenticating...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
                Sign In to Admin Portal
              </>
            )}
          </button>
        </form>

        {/* Security Warning Footer */}
        <div className="mt-8 pt-4 border-t border-gray-100 dark:border-white/10 text-center">
          <p className="text-[11px] text-text-dark/40 dark:text-light-mint/40 font-mono">
            IP Logged • Unauthorized access attempts are monitored & recorded.
          </p>
        </div>
      </div>
    </div>
  );
}
