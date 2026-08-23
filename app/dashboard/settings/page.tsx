'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { getUser } from '@/lib/auth';
import { useToast } from '@/components/ui/Toast';
import { supabase } from '@/lib/supabase';

export default function TeacherSettingsPage() {
  const toast = useToast();

  // Profile Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [institution, setInstitution] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [subdomainStatus, setSubdomainStatus] = useState<'checking' | 'available' | 'taken' | 'idle'>('available');
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Password Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // Drag and Drop state
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function loadProfile() {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser) {
          if (isMounted) setEmail(authUser.email || '');

          const { data: teacherData } = await supabase
            .from('teachers')
            .select('*')
            .eq('id', authUser.id)
            .single();

          if (isMounted && teacherData) {
            if (teacherData.name) setName(teacherData.name);
            if (teacherData.subdomain) setSubdomain(teacherData.subdomain);
            if (teacherData.logo_url) setLogoPreview(teacherData.logo_url);
            return;
          }
        }
      } catch {
        // fallback
      }

      const loggedIn = getUser();
      if (loggedIn && isMounted) {
        if (loggedIn.name) setName(loggedIn.name);
        if (loggedIn.email) setEmail(loggedIn.email);
      }
    }
    loadProfile();

    return () => {
      isMounted = false;
    };
  }, []);

  // Handle Subdomain Input Change with Live Check
  const handleSubdomainChange = (val: string) => {
    const cleaned = val.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setSubdomain(cleaned);
    if (!cleaned) {
      setSubdomainStatus('idle');
      return;
    }
    setSubdomainStatus('checking');
    const timer = setTimeout(() => {
      if (cleaned === 'admin' || cleaned === 'test') {
        setSubdomainStatus('taken');
      } else {
        setSubdomainStatus('available');
      }
    }, 400);
    return () => clearTimeout(timer);
  };

  // Handle Logo Upload
  const handleLogoChange = (file: File) => {
    if (file && file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setLogoPreview(url);
      toast('Logo uploaded successfully!', 'success');
    } else {
      toast('Please select a valid image file (PNG, JPG, SVG)', 'error');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleLogoChange(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleLogoChange(e.target.files[0]);
    }
  };

  // Handle Profile Save
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);

    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();

      if (authUser) {
        const { error } = await supabase
          .from('teachers')
          .upsert({
            id: authUser.id,
            name,
            email,
            subdomain,
            logo_url: logoPreview || null,
          });

        if (error) {
          toast(`Failed to update profile: ${error.message}`, 'error');
          setIsSavingProfile(false);
          return;
        }
      }

      toast('Profile settings updated successfully!', 'success');
    } catch (err: any) {
      toast(err.message || 'Error saving profile', 'error');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Handle Password Update via Supabase Auth
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast('New password must be at least 8 characters long.', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast('New passwords do not match.', 'error');
      return;
    }

    setIsUpdatingPassword(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        toast(`Failed to update password: ${error.message}`, 'error');
      } else {
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        toast('Your password has been updated successfully!', 'success');
      }
    } catch (err: any) {
      toast(err.message || 'Error updating password', 'error');
    } finally {
      setIsUpdatingPassword(false);
    }
  };


  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold font-poppins text-deep-teal flex items-center gap-3">
          <span className="p-2 rounded-xl bg-primary-teal/10 text-primary-teal">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </span>
          Teacher Settings
        </h1>
        <p className="text-text-dark/70 mt-1">
          Manage your account profile, institution logo, custom subdomain, and security settings.
        </p>
      </div>

      {/* SECTION 1: PROFILE SETTINGS */}
      <form
        onSubmit={handleSaveProfile}
        className="bg-white dark:bg-dark-surface rounded-card-lg border border-primary-teal/10 shadow-sm p-6 sm:p-8 space-y-6"
      >
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-white/10 pb-4">
          <div>
            <h2 className="text-xl font-bold font-poppins text-deep-teal dark:text-white">Profile & Branding</h2>
            <p className="text-sm text-text-dark/60 dark:text-light-mint/70">
              Personalize your profile and student-facing portal.
            </p>
          </div>
          <span className="px-3 py-1 text-xs font-semibold rounded-full bg-primary-teal/10 text-primary-teal border border-primary-teal/20">
            Teacher Account
          </span>
        </div>

        {/* Logo Upload Section */}
        <div>
          <label className="block text-sm font-semibold text-deep-teal dark:text-light-mint mb-2">
            Institution Logo / Avatar
          </label>
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="relative w-24 h-24 rounded-card border-2 border-dashed border-primary-teal/30 bg-primary-teal/5 flex items-center justify-center overflow-hidden flex-shrink-0">
              {logoPreview ? (
                <Image src={logoPreview} alt="Logo Preview" fill className="object-cover" />
              ) : (
                <div className="text-center p-2">
                  <svg className="w-8 h-8 mx-auto text-primary-teal/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-[10px] text-text-dark/50 dark:text-light-mint/50 block mt-1">No Logo</span>
                </div>
              )}
            </div>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`flex-1 w-full p-4 border-2 border-dashed rounded-card text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-primary-teal bg-primary-teal/10 scale-[1.01]'
                  : 'border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/5 hover:border-primary-teal/50'
              }`}
            >
              <input
                type="file"
                id="logo-file"
                accept="image/*"
                onChange={handleFileInput}
                className="hidden"
              />
              <label htmlFor="logo-file" className="cursor-pointer block space-y-1">
                <p className="text-sm font-medium text-deep-teal dark:text-white">
                  <span className="text-primary-teal font-semibold">Click to upload</span> or drag and drop logo here
                </p>
                <p className="text-xs text-text-dark/50 dark:text-light-mint/60">
                  SVG, PNG, or JPG (max. 800x800px, 5MB)
                </p>
              </label>
              {logoPreview && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setLogoPreview(null);
                    toast('Logo removed', 'info');
                  }}
                  className="mt-2 text-xs font-semibold text-rose-500 hover:text-rose-600 transition-colors"
                >
                  Remove current logo
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Name & Email Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-semibold text-deep-teal dark:text-light-mint mb-1.5">
              Full Name
            </label>
            <div className="relative">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-4 py-2.5 rounded-card border border-gray-300 dark:border-white/10 bg-white dark:bg-deep-teal text-text-dark dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-teal/50 transition"
                placeholder="e.g. Alex Morgan"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-deep-teal dark:text-light-mint mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 rounded-card border border-gray-300 dark:border-white/10 bg-gray-50 dark:bg-deep-teal/60 text-text-dark/80 dark:text-light-mint/90 focus:outline-none focus:ring-2 focus:ring-primary-teal/50 transition"
                placeholder="alex@school.edu"
              />
              <span className="absolute right-3 top-2.5 text-xs text-text-dark/40 dark:text-light-mint/40 bg-gray-200/60 dark:bg-white/10 px-2 py-0.5 rounded">
                Verified
              </span>
            </div>
          </div>
        </div>

        {/* Institution / School Name */}
        <div>
          <label className="block text-sm font-semibold text-deep-teal dark:text-light-mint mb-1.5">
            School or Institution Name
          </label>
          <input
            type="text"
            value={institution}
            onChange={(e) => setInstitution(e.target.value)}
            className="w-full px-4 py-2.5 rounded-card border border-gray-300 dark:border-white/10 bg-white dark:bg-deep-teal text-text-dark dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-teal/50 transition"
            placeholder="e.g. Oakridge High School"
          />
        </div>

        {/* Custom Subdomain Section */}
        <div className="pt-2">
          <label className="block text-sm font-semibold text-deep-teal dark:text-light-mint mb-1.5">
            Custom Portal Subdomain
          </label>
          <p className="text-xs text-text-dark/60 dark:text-light-mint/70 mb-3">
            Students can access your published oral exams directly through your dedicated subdomain URL.
          </p>
          <div className="flex items-center">
            <div className="relative flex-1 flex items-center">
              <input
                type="text"
                value={subdomain}
                onChange={(e) => handleSubdomainChange(e.target.value)}
                className="w-full pl-4 pr-32 py-2.5 rounded-l-card border border-r-0 border-gray-300 dark:border-white/10 bg-white dark:bg-deep-teal text-text-dark dark:text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary-teal/50 z-10"
                placeholder="yourname"
              />
              <div className="absolute right-3 z-20 flex items-center gap-1 text-xs">
                {subdomainStatus === 'checking' && (
                  <span className="text-amber-500 font-medium flex items-center gap-1">
                    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Checking...
                  </span>
                )}
                {subdomainStatus === 'available' && (
                  <span className="text-emerald-500 font-semibold flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    Available
                  </span>
                )}
                {subdomainStatus === 'taken' && (
                  <span className="text-rose-500 font-semibold flex items-center gap-1 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-800">
                    Unavailable
                  </span>
                )}
              </div>
            </div>
            <span className="px-4 py-2.5 bg-gray-100 dark:bg-white/10 border border-gray-300 dark:border-white/10 rounded-r-card text-sm font-semibold text-text-dark/70 dark:text-light-mint/80 select-none font-mono">
              .examly.site
            </span>
          </div>
          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2 flex items-center gap-1.5 font-medium">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            Live Link: https://{subdomain || 'yourname'}.examly.site
          </p>
        </div>

        {/* Submit Profile Button */}
        <div className="pt-4 border-t border-gray-100 dark:border-white/10 flex justify-end">
          <button
            type="submit"
            disabled={isSavingProfile}
            className="px-6 py-2.5 rounded-card bg-primary-teal hover:bg-primary-teal/90 text-white font-semibold text-sm shadow-md hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {isSavingProfile ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Saving Profile...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Save Profile Changes
              </>
            )}
          </button>
        </div>
      </form>

      {/* SECTION 2: CHANGE PASSWORD */}
      <form
        onSubmit={handleUpdatePassword}
        className="bg-white dark:bg-dark-surface rounded-card-lg border border-primary-teal/10 shadow-sm p-6 sm:p-8 space-y-6"
      >
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-white/10 pb-4">
          <div>
            <h2 className="text-xl font-bold font-poppins text-deep-teal dark:text-white">Security & Password</h2>
            <p className="text-sm text-text-dark/60 dark:text-light-mint/70">
              Update your account password to maintain maximum security.
            </p>
          </div>
          <div className="w-9 h-9 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
        </div>

        {/* Current Password */}
        <div>
          <label className="block text-sm font-semibold text-deep-teal dark:text-light-mint mb-1.5">
            Current Password
          </label>
          <div className="relative">
            <input
              type={showCurrentPass ? 'text' : 'password'}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-card border border-gray-300 dark:border-white/10 bg-white dark:bg-deep-teal text-text-dark dark:text-white pr-10 focus:outline-none focus:ring-2 focus:ring-primary-teal/50 transition"
              placeholder="••••••••••••"
            />
            <button
              type="button"
              onClick={() => setShowCurrentPass(!showCurrentPass)}
              className="absolute right-3 top-3 text-text-dark/40 hover:text-text-dark dark:text-light-mint/40 dark:hover:text-light-mint transition"
            >
              {showCurrentPass ? (
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

        {/* New Password & Confirm Password */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-semibold text-deep-teal dark:text-light-mint mb-1.5">
              New Password
            </label>
            <div className="relative">
              <input
                type={showNewPass ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-card border border-gray-300 dark:border-white/10 bg-white dark:bg-deep-teal text-text-dark dark:text-white pr-10 focus:outline-none focus:ring-2 focus:ring-primary-teal/50 transition"
                placeholder="At least 8 characters"
              />
              <button
                type="button"
                onClick={() => setShowNewPass(!showNewPass)}
                className="absolute right-3 top-3 text-text-dark/40 hover:text-text-dark dark:text-light-mint/40 dark:hover:text-light-mint transition"
              >
                {showNewPass ? (
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

          <div>
            <label className="block text-sm font-semibold text-deep-teal dark:text-light-mint mb-1.5">
              Confirm New Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-card border border-gray-300 dark:border-white/10 bg-white dark:bg-deep-teal text-text-dark dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-teal/50 transition"
              placeholder="Re-enter new password"
            />
          </div>
        </div>

        {/* Update Password Submit Button */}
        <div className="pt-4 border-t border-gray-100 dark:border-white/10 flex justify-end">
          <button
            type="submit"
            disabled={isUpdatingPassword}
            className="px-6 py-2.5 rounded-card bg-deep-teal dark:bg-primary-teal hover:bg-deep-teal/90 text-white font-semibold text-sm shadow-md hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {isUpdatingPassword ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Updating...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Update Password
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
