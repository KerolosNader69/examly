'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { setUser } from '@/lib/auth';
import { signupSchema } from '@/lib/schemas';
import { supabase } from '@/lib/supabase';

const TAKEN_SLUGS = ['admin', 'test', 'examly', 'support', 'ahmedhassan', 'alexmorgan', 'demo', 'api', 'root'];

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: '',
    email: '',
    subdomain: '',
    school: '',
    password: '',
    confirmPassword: '',
    agreeTerms: false,
  });

  const [isManuallyEdited, setIsManuallyEdited] = useState(false);
  const [subdomainStatus, setSubdomainStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [suggestedSlugNotice, setSuggestedSlugNotice] = useState<string | null>(null);

  const [errors, setErrors] = useState<{
    name?: string;
    email?: string;
    subdomain?: string;
    school?: string;
    password?: string;
    confirmPassword?: string;
    agreeTerms?: string;
    general?: string;
  }>({});
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const checkTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Helper to generate clean slug from full name
  const generateBaseSlug = (name: string): string => {
    let clean = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!clean) return '';
    // Ensure it starts with a letter
    if (!/^[a-z]/.test(clean)) {
      clean = 'edu' + clean;
    }
    return clean.slice(0, 30);
  };

  // Find an available slug if base is taken
  const findAvailableSlug = (base: string): { slug: string; isAlt: boolean } => {
    if (!TAKEN_SLUGS.includes(base)) {
      return { slug: base, isAlt: false };
    }
    // Try suffixes 2, 3, etc.
    let suffix = 2;
    while (suffix <= 99) {
      const candidate = `${base}${suffix}`.slice(0, 30);
      if (!TAKEN_SLUGS.includes(candidate)) {
        return { slug: candidate, isAlt: true };
      }
      suffix++;
    }
    return { slug: `${base}-edu`.slice(0, 30), isAlt: true };
  };

  // Check validation rules
  const validateSubdomainFormat = (slug: string): string | null => {
    if (!slug) return 'Subdomain is required';
    if (slug.length < 3) return 'Must be at least 3 characters';
    if (slug.length > 30) return 'Cannot exceed 30 characters';
    if (!/^[a-z]/.test(slug)) return 'Must start with a lowercase letter';
    if (!/^[a-z0-9-]+$/.test(slug)) return 'Only lowercase letters, numbers, & hyphens allowed';
    return null;
  };

  // Handle Full Name change -> Auto-generate subdomain if user hasn't edited manually
  const handleNameChange = (nameVal: string) => {
    const newForm = { ...form, name: nameVal };

    if (!isManuallyEdited) {
      const base = generateBaseSlug(nameVal);
      if (base.length >= 3) {
        const { slug, isAlt } = findAvailableSlug(base);
        newForm.subdomain = slug;
        setSubdomainStatus('available');
        setStatusMessage('Available');
        if (isAlt) {
          setSuggestedSlugNotice(`"${base}" is taken, auto-suggested "${slug}" for you`);
        } else {
          setSuggestedSlugNotice(null);
        }
      } else {
        newForm.subdomain = base;
        if (base) {
          setSubdomainStatus('invalid');
          setStatusMessage('Must be at least 3 characters');
        } else {
          setSubdomainStatus('idle');
          setStatusMessage('');
        }
        setSuggestedSlugNotice(null);
      }
    }

    setForm(newForm);
  };

  // Handle manual Subdomain change
  const handleSubdomainChange = (val: string) => {
    setIsManuallyEdited(true);
    setSuggestedSlugNotice(null);
    const cleaned = val.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 30);
    setForm((prev) => ({ ...prev, subdomain: cleaned }));

    const formatError = validateSubdomainFormat(cleaned);
    if (formatError) {
      setSubdomainStatus('invalid');
      setStatusMessage(formatError);
      return;
    }

    setSubdomainStatus('checking');
    setStatusMessage('Checking availability...');

    if (checkTimerRef.current) clearTimeout(checkTimerRef.current);

    checkTimerRef.current = setTimeout(() => {
      if (TAKEN_SLUGS.includes(cleaned)) {
        setSubdomainStatus('taken');
        setStatusMessage('Already taken, try another');
      } else {
        setSubdomainStatus('available');
        setStatusMessage('Available');
      }
    }, 400);
  };

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
      ? { label: 'Weak', color: 'text-error', bar: 'bg-error', width: '20%' }
      : metChecks <= 3
        ? { label: 'Fair', color: 'text-gold-accent', bar: 'bg-gold-accent', width: '50%' }
        : metChecks <= 4
          ? { label: 'Good', color: 'text-emerald-500', bar: 'bg-emerald-500', width: '75%' }
          : { label: 'Strong', color: 'text-emerald-600', bar: 'bg-primary-teal', width: '100%' };

  const validate = () => {
    const next: typeof errors = {};
    const parsed = signupSchema.safeParse(form);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof typeof errors;
        if (!next[key]) next[key] = issue.message;
      }
    }
    if (subdomainStatus === 'taken' || subdomainStatus === 'invalid') {
      next.subdomain = statusMessage || 'Please choose an available subdomain';
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
      // 1. Pre-check if email already exists in teachers table
      const { data: existingTeacher } = await supabase
        .from('teachers')
        .select('id, email')
        .eq('email', form.email.trim())
        .maybeSingle();

      if (existingTeacher) {
        setErrors({ email: 'This email is already registered. Please log in instead.' });
        setSubmitting(false);
        return;
      }

      // 2. Real Supabase Auth Signup
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || window.location.origin}/auth/confirmed`,
          data: {
            name: form.name,
            subdomain: form.subdomain,
            school: form.school,
          },
        },
      });

      if (signUpError) {
        const msg = signUpError.message;
        if (msg.toLowerCase().includes('email') || msg.toLowerCase().includes('registered') || msg.toLowerCase().includes('already')) {
          setErrors({ email: 'This email is already registered. Please log in instead.' });
        } else if (msg.toLowerCase().includes('password')) {
          setErrors({ password: msg });
        } else {
          setErrors({ general: msg });
        }
        setSubmitting(false);
        return;
      }

      // Standard Supabase indicator for already registered user when email confirmation is active
      if (data.user && data.user.identities && data.user.identities.length === 0) {
        setErrors({ email: 'This email is already registered. Please log in instead.' });
        setSubmitting(false);
        return;
      }

      if (data.user) {
        // Provision teacher row via server-side API (bypasses RLS issues for unauthenticated sessions)
        try {
          await fetch('/api/auth/provision-teacher', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: data.user.id,
              email: form.email,
              name: form.name,
              subdomain: form.subdomain,
            }),
          });
        } catch (provErr) {
          console.error('Error provisioning teacher profile:', provErr);
        }
      }

      // Sign out unverified session and redirect to verification panel page
      await supabase.auth.signOut();
      router.push(`/verify-email?email=${encodeURIComponent(form.email)}`);
    } catch (err: any) {
      console.error('Unexpected signup error:', err);
      setErrors({ general: err.message || 'An unexpected error occurred during signup.' });
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
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#F7F8FA] dark:bg-dark-surface">
      {/* LEFT PANEL - Dark Teal */}
      <div className="hidden lg:flex lg:w-[45%] bg-deep-teal flex-col justify-between p-12 relative overflow-hidden">
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

        <div className="relative z-10 max-w-md my-auto pt-8 pb-32">
          <h1 className="text-4xl md:text-5xl font-bold font-poppins text-white mb-6 leading-tight">
            Join thousands of educators transforming assessment
          </h1>

          <div className="space-y-4">
            {[
              'Custom portal subdomain included',
              'No credit card required',
              'Set up your first exam in minutes',
              '14-day full feature trial',
            ].map((point, index) => (
              <div key={index} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-primary-teal/20 border border-light-mint/30 flex items-center justify-center flex-shrink-0">
                  <svg className="w-3.5 h-3.5 text-light-mint" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-white/90 font-medium text-base">{point}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="absolute bottom-0 right-10 z-10 pointer-events-none">
          <Image
            src="/assets/mascot/ChatGPT Image Aug 11, 2026, 04_32_59 AM.png"
            alt="Examly Mascot"
            width={290}
            height={290}
            className="object-contain object-bottom"
            priority
          />
        </div>

        <div className="absolute inset-0 bg-gradient-to-br from-primary-teal/10 to-transparent pointer-events-none"></div>
      </div>

      {/* RIGHT PANEL - Form */}
      <div className="flex-1 lg:w-[55%] flex items-center justify-center p-6 sm:p-12 overflow-y-auto">
        <div className="w-full max-w-md my-auto">
          <div className="lg:hidden mb-4 flex justify-center">
            <Link href="/" className="inline-flex items-center">
              <Image
                src="/assets/logo/screen-removebg-preview.png"
                alt="Examly Logo"
                width={300}
                height={300}
                className="w-48 sm:w-56 h-auto object-contain dark:hidden"
                priority
              />
              <Image
                src="/assets/logo/ChatGPT Image Aug 11, 2026, 03_55_47 AM.png"
                alt="Examly Logo"
                width={300}
                height={200}
                className="w-48 sm:w-56 h-auto object-contain hidden dark:block"
                priority
              />
            </Link>
          </div>

          <div className="bg-white dark:bg-dark-surface rounded-2xl p-8 shadow-2xl border border-gray-100 dark:border-light-mint/10">
            <h1 className="text-3xl font-bold font-poppins text-deep-teal dark:text-white mb-2">
              Create your account
            </h1>
            <p className="text-text-dark/60 dark:text-light-mint/70 mb-6">
              Start building AI-graded oral exams with your custom portal URL.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {errors.general && (
                <div className="p-3.5 rounded-card bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-start gap-2">
                  <svg className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{errors.general}</span>
                </div>
              )}

              <Input
                name="name"
                type="text"
                label="Full Name"
                placeholder="e.g. Ahmed Hassan"
                value={form.name}
                onChange={(e) => handleNameChange(e.target.value)}
                error={errors.name}
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                }
              />

              {/* Subdomain Selection Field */}
              <div>
                <label className="block text-sm font-semibold text-deep-teal dark:text-light-mint mb-1.5">
                  Your Examly link
                </label>
                <div className="flex items-center rounded-card border border-gray-300 dark:border-white/15 bg-white dark:bg-deep-teal focus-within:ring-2 focus-within:ring-primary-teal/50 overflow-hidden transition">
                  <input
                    type="text"
                    name="subdomain"
                    value={form.subdomain}
                    onChange={(e) => handleSubdomainChange(e.target.value)}
                    placeholder="ahmedhassan"
                    className="flex-1 px-3 py-2.5 text-sm bg-transparent text-text-dark dark:text-white font-mono focus:outline-none min-w-0"
                  />
                  <span className="px-3 py-2.5 bg-gray-100 dark:bg-white/10 text-xs font-semibold text-text-dark/70 dark:text-light-mint/80 font-mono border-l border-gray-200 dark:border-white/10 select-none">
                    .examly.site
                  </span>
                </div>

                {/* Subdomain Status Indicator */}
                <div className="mt-1.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    {subdomainStatus === 'checking' && (
                      <span className="text-amber-500 font-medium flex items-center gap-1">
                        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Checking availability...
                      </span>
                    )}

                    {subdomainStatus === 'available' && (
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                        Available
                      </span>
                    )}

                    {subdomainStatus === 'taken' && (
                      <span className="text-rose-500 font-semibold flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Already taken, try another
                      </span>
                    )}

                    {subdomainStatus === 'invalid' && (
                      <span className="text-rose-500 font-medium">
                        {statusMessage}
                      </span>
                    )}
                  </div>

                  <span className="text-[11px] text-text-dark/40 dark:text-light-mint/40">
                    3-30 chars (a-z, 0-9, -)
                  </span>
                </div>

                {suggestedSlugNotice && (
                  <p className="mt-1 text-xs text-amber-600 dark:text-amber-400 font-medium">
                    💡 {suggestedSlugNotice}
                  </p>
                )}

                {errors.subdomain && (
                  <p className="mt-1 text-xs text-rose-500 font-medium">{errors.subdomain}</p>
                )}
              </div>

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

              <Input
                name="school"
                type="text"
                label="School / Institution name (optional)"
                placeholder="St. Jude Academy"
                value={form.school}
                onChange={(e) => setForm({ ...form, school: e.target.value })}
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                }
              />

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
                      ></div>
                    </div>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs">
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
                label="Confirm Password"
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

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  className="text-xs text-primary-teal hover:text-deep-teal dark:hover:text-light-mint transition-colors"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? 'Hide password' : 'Show password'}
                </button>
              </div>

              <div className="pt-2">
                <label className="flex items-start gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={form.agreeTerms}
                    onChange={(e) => setForm({ ...form, agreeTerms: e.target.checked })}
                    className="mt-1 rounded border-gray-300 text-primary-teal focus:ring-primary-teal cursor-pointer"
                  />
                  <span className="text-xs text-text-dark/70 dark:text-light-mint/70 leading-normal">
                    I agree to the{' '}
                    <Link href="/terms" className="text-primary-teal hover:underline font-medium">
                      Terms of Service
                    </Link>{' '}
                    and{' '}
                    <Link href="/privacy" className="text-primary-teal hover:underline font-medium">
                      Privacy Policy
                    </Link>
                  </span>
                </label>
                {errors.agreeTerms && <p className="mt-1 text-xs text-error">{errors.agreeTerms}</p>}
              </div>

              <Button type="submit" className="w-full text-lg py-3.5 mt-2" disabled={submitting}>
                {submitting ? 'Creating account...' : 'Sign Up'}
              </Button>

              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200 dark:border-light-mint/15"></div>
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-white dark:bg-dark-surface px-4 text-xs text-text-dark/50 dark:text-light-mint/50 uppercase">or</span>
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

              <p className="text-center text-sm text-text-dark/60 dark:text-light-mint/60 pt-2">
                Already have an account?{' '}
                <Link href="/login" className="text-primary-teal font-semibold hover:text-deep-teal dark:hover:text-light-mint transition-colors">
                  Log in
                </Link>
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}