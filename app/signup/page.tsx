'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AuthLayout from '@/components/auth/AuthLayout';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { setUser } from '@/lib/auth';
import { signupSchema } from '@/lib/schemas';

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', dob: '', gender: '', password: '', confirmPassword: '', role: 'teacher' });
  const [errors, setErrors] = useState<{ name?: string; email?: string; dob?: string; gender?: string; password?: string; confirmPassword?: string }>({});
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const passwordChecks = [
    { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
    { label: 'An uppercase letter (A-Z)', test: (p: string) => /[A-Z]/.test(p) },
    { label: 'A lowercase letter (a-z)', test: (p: string) => /[a-z]/.test(p) },
    { label: 'A number (0-9)', test: (p: string) => /[0-9]/.test(p) },
    { label: 'A special character (!@#$...)', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
  ];

  const metChecks = passwordChecks.filter((check) => check.test(form.password)).length;
  const strength =
    metChecks <= 1 ? { label: 'Weak', color: 'text-error', bar: 'bg-error', width: '20%' } :
    metChecks <= 3 ? { label: 'Fair', color: 'text-gold-accent', bar: 'bg-gold-accent', width: '50%' } :
    metChecks <= 4 ? { label: 'Good', color: 'text-emerald-500', bar: 'bg-emerald-500', width: '75%' } :
    { label: 'Strong', color: 'text-emerald-600', bar: 'bg-primary-teal', width: '100%' };

  const validate = () => {
    const next: { name?: string; email?: string; dob?: string; gender?: string; password?: string; confirmPassword?: string } = {};
    const parsed = signupSchema.safeParse(form);
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
      setUser({ name: form.name, email: form.email, role: form.role as 'teacher' | 'student' });
      router.push('/dashboard');
    }, 600);
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Start building AI-graded oral exams in minutes."
    >
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <Input
          name="name"
          type="text"
          label="Full name"
          placeholder="Alex Morgan"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          error={errors.name}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          }
        />

        <Input
          name="email"
          type="email"
          label="Work email"
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label htmlFor="dob" className="block text-sm font-medium text-deep-teal dark:text-light-mint mb-1.5">
              Date of birth
            </label>
            <input
              id="dob"
              name="dob"
              type="date"
              value={form.dob}
              max={new Date().toISOString().split('T')[0]}
              onChange={(e) => setForm({ ...form, dob: e.target.value })}
              className={`w-full px-4 py-3 rounded-card border bg-white dark:bg-dark-surface text-text-dark dark:text-light-mint outline-none transition-all duration-200 focus:ring-2 focus:ring-primary-teal/30 ${
                errors.dob ? 'border-error' : 'border-gray-200 dark:border-light-mint/15 hover:border-primary-teal/40'
              }`}
            />
            {errors.dob && <p className="mt-1.5 text-sm text-error">{errors.dob}</p>}
          </div>

          <div>
            <p className="block text-sm font-medium text-deep-teal dark:text-light-mint mb-1.5">Gender</p>
            <div className="grid grid-cols-2 gap-2">
              {['Female', 'Male'].map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setForm({ ...form, gender: g })}
                  className={`px-2 py-3 rounded-card border-2 transition-all duration-200 text-sm font-medium ${
                    form.gender === g
                      ? 'border-primary-teal bg-primary-teal/5 text-primary-teal'
                      : 'border-gray-200 dark:border-light-mint/15 bg-white dark:bg-dark-surface text-text-dark/70 dark:text-light-mint/70 hover:border-primary-teal/40'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
            {errors.gender && <p className="mt-1.5 text-sm text-error">{errors.gender}</p>}
          </div>
        </div>

        <div>
          <Input
            name="password"
            type={showPassword ? 'text' : 'password'}
            label="Password"
            placeholder="Create a strong password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            error={errors.password}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            }
          />

          {form.password && (
            <div className="mt-3 p-4 rounded-card bg-bg-light dark:bg-dark-elevated border border-gray-200 dark:border-light-mint/15">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-text-dark/60 dark:text-light-mint/60">Password strength</span>
                <span className={`text-xs font-bold ${strength.color}`}>{strength.label}</span>
              </div>
              <div className="h-1.5 bg-gray-200 dark:bg-light-mint/15 rounded-full overflow-hidden mb-3">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${strength.bar}`}
                  style={{ width: strength.width }}
                ></div>
              </div>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {passwordChecks.map((check, i) => {
                  const met = check.test(form.password);
                  return (
                    <li key={i} className={`flex items-center gap-1.5 text-xs ${met ? 'text-emerald-600 dark:text-emerald-400' : 'text-text-dark/50 dark:text-light-mint/50'}`}>
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

          <div className="flex items-center justify-between mt-2">
            <button
              type="button"
              className="text-sm text-primary-teal hover:text-deep-teal dark:hover:text-light-mint transition-colors"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? 'Hide password' : 'Show password'}
            </button>
          </div>
        </div>

        <Input
          name="confirmPassword"
          type={showPassword ? 'text' : 'password'}
          label="Confirm password"
          placeholder="Re-enter your password"
          value={form.confirmPassword}
          onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
          error={errors.confirmPassword}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          }
        />

        <div>
          <p className="block text-sm font-medium text-deep-teal dark:text-light-mint mb-1.5">I am a</p>
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                { value: 'teacher', label: 'Teacher', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
                { value: 'student', label: 'Student', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
              ] as const
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setForm({ ...form, role: option.value })}
                className={`flex items-center gap-2 px-4 py-3 rounded-card border-2 transition-all duration-200 text-sm font-medium ${
                  form.role === option.value
                    ? 'border-primary-teal bg-primary-teal/5 text-primary-teal'
                    : 'border-gray-200 dark:border-light-mint/15 bg-white dark:bg-dark-surface text-text-dark/70 dark:text-light-mint/70 hover:border-primary-teal/40'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={option.icon} />
                </svg>
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <Button type="submit" className="w-full text-lg py-3.5" disabled={submitting}>
          {submitting ? 'Creating account...' : 'Create Free Account'}
        </Button>

        <p className="text-sm text-text-dark/60 dark:text-light-mint/60 text-center">
          By signing up you agree to our{' '}
          <Link href="/terms" className="text-primary-teal hover:text-deep-teal dark:hover:text-light-mint transition-colors">
            Terms
          </Link>{' '}
          and{' '}
          <Link href="/privacy" className="text-primary-teal hover:text-deep-teal dark:hover:text-light-mint transition-colors">
            Privacy Policy
          </Link>
          .
        </p>

        <p className="text-center text-text-dark/60 dark:text-light-mint/60">
          Already have an account?{' '}
          <Link href="/login" className="text-primary-teal font-semibold hover:text-deep-teal dark:hover:text-light-mint transition-colors">
            Log in
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
