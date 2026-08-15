'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { setUser } from '@/lib/auth';
import { loginSchema } from '@/lib/schemas';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({});
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const validate = () => {
    const next: { email?: string; password?: string; general?: string } = {};
    const parsed = loginSchema.safeParse(form);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as string;
        if (!next[key as keyof typeof next]) next[key as keyof typeof next] = issue.message;
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    if (!validate()) return;
    setSubmitting(true);

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.password,
      });

      if (signInError) {
        const msg = signInError.message;
        if (msg.toLowerCase().includes('email') || msg.toLowerCase().includes('user not found')) {
          setErrors({ email: msg });
        } else if (msg.toLowerCase().includes('password') || msg.toLowerCase().includes('invalid login credentials')) {
          setErrors({ general: 'Invalid email or password. Please check your credentials and try again.' });
        } else {
          setErrors({ general: msg });
        }
        setSubmitting(false);
        return;
      }

      if (data.user) {
        const { data: teacherProfile } = await supabase
          .from('teachers')
          .select('name')
          .eq('id', data.user.id)
          .single();

        const name = teacherProfile?.name || data.user.user_metadata?.name || data.user.email?.split('@')[0] || 'Teacher';
        setUser({ name, email: data.user.email || form.email, role: 'teacher' });
      }

      router.push('/dashboard');
    } catch (err: any) {
      console.error('Login error:', err);
      setErrors({ general: err.message || 'An unexpected error occurred during login.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrors({});
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) {
        setErrors({ general: error.message });
      }
    } catch (err: any) {
      setErrors({ general: err.message || 'Failed to initiate Google sign in.' });
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* LEFT PANEL - Dark Teal */}
      <div className="hidden lg:flex lg:w-[45%] bg-deep-teal flex-col justify-start p-12 relative overflow-hidden">
        {/* Logo */}
        <div className="relative z-10">
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

        {/* Content */}
        <div className="relative z-10 max-w-md mt-16">
          <h1 className="text-4xl md:text-5xl font-bold font-poppins text-white mb-6 leading-tight">
            The future of oral assessments is here.
          </h1>
          <p className="text-lg text-light-mint/80 leading-relaxed mb-8">
            Create AI-evaluated spoken exams in minutes. Automated proctoring, deep analytics, and instant feedback.
          </p>

          <div className="flex items-center gap-4 text-light-mint/60 text-sm font-medium">
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-primary-teal" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              AI Voice Proctoring
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-primary-teal" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Instant Insights
            </span>
          </div>
        </div>

        {/* Mascot - anchored to bottom edge */}
        <div className="absolute bottom-0 right-12 z-10">
          <Image
            src="/assets/mascot/ChatGPT Image Aug 11, 2026, 04_32_59 AM.png"
            alt="Examly Mascot"
            width={280}
            height={280}
            className="object-contain object-bottom"
            priority
          />
        </div>

        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary-teal/10 to-transparent pointer-events-none"></div>
      </div>

      {/* RIGHT PANEL - Form */}
      <div className="flex-1 bg-bg-light dark:bg-dark-surface flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden mb-8 text-center">
            <Link href="/" className="inline-block">
              <Image
                src="/assets/logo/ChatGPT Image Aug 11, 2026, 03_55_47 AM.png"
                alt="Examly Logo"
                width={120}
                height={48}
                className="object-contain"
                priority
              />
            </Link>
          </div>

          <div className="bg-white dark:bg-deep-teal/40 p-8 sm:p-10 rounded-card-lg border border-primary-teal/10 shadow-lg">
            <h2 className="text-2xl sm:text-3xl font-bold font-poppins text-deep-teal dark:text-white mb-2">
              Welcome back
            </h2>
            <p className="text-sm text-text-dark/60 dark:text-light-mint/70 mb-8">
              Log in to manage your exams and view student performance.
            </p>

            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              {errors.general && (
                <div className="p-3.5 rounded-card bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-start gap-2">
                  <svg className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{errors.general}</span>
                </div>
              )}

              <Input
                name="email"
                type="email"
                label="Email address"
                placeholder="you@school.edu"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                error={errors.email}
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                }
              />

              <div>
                <Input
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  label="Password"
                  placeholder="Enter your password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  error={errors.password}
                  icon={
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  }
                />
                <div className="flex items-center justify-between mt-2">
                  <button
                    type="button"
                    className="text-sm text-primary-teal hover:text-deep-teal dark:hover:text-light-mint transition-colors"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? 'Hide password' : 'Show password'}
                  </button>
                  <Link href="/forgot-password" className="text-sm text-primary-teal hover:text-deep-teal dark:hover:text-light-mint transition-colors">
                    Forgot password?
                  </Link>
                </div>
              </div>

              <Button type="submit" className="w-full text-lg py-3.5" disabled={submitting}>
                {submitting ? 'Logging in...' : 'Log In'}
              </Button>

              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200 dark:border-light-mint/15"></div>
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-white dark:bg-dark-surface px-4 text-sm text-text-dark/50 dark:text-light-mint/50">or</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleGoogleSignIn}
                className="w-full flex items-center justify-center gap-3 px-6 py-3 rounded-card bg-white dark:bg-dark-surface border border-gray-200 dark:border-light-mint/15 text-text-dark dark:text-light-mint font-medium hover:border-primary-teal/50 hover:shadow-md transition-all duration-200"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.10z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.97 10.97 0 001 12c0 1.77.43 3.45 1.18 4.93l3.66-2.84z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Continue with Google
              </button>

              <p className="text-center text-text-dark/60 dark:text-light-mint/60 mt-4">
                Don&apos;t have an account?{' '}
                <Link href="/signup" className="text-primary-teal font-semibold hover:text-deep-teal dark:hover:text-light-mint transition-colors">
                  Sign up free
                </Link>
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
