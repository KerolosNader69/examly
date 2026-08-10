'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AuthLayout from '@/components/auth/AuthLayout';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { setUser } from '@/lib/auth';
import { loginSchema } from '@/lib/schemas';

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const validate = () => {
    const next: { email?: string; password?: string } = {};
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setTimeout(() => {
      setUser({ name: 'Alex Morgan', email: form.email, role: 'teacher' });
      router.push('/dashboard');
    }, 600);
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Log in to manage your exams and student results."
    >
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
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
            <span className="bg-bg-light dark:bg-dark-surface px-4 text-sm text-text-dark/50 dark:text-light-mint/50">or</span>
          </div>
        </div>

        <button
          type="button"
          className="w-full flex items-center justify-center gap-3 px-6 py-3 rounded-card bg-white dark:bg-dark-surface border border-gray-200 dark:border-light-mint/15 text-text-dark dark:text-light-mint font-medium hover:border-primary-teal/50 hover:shadow-md transition-all duration-200"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
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
    </AuthLayout>
  );
}
