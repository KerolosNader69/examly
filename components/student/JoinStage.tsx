'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Input from '@/components/ui/Input';
import { Exam } from '@/lib/exams';

export interface TeacherBrandingData {
  id?: string;
  name: string;
  subdomain?: string;
  logo_url?: string | null;
  brand_color?: string | null;
}

interface JoinStageProps {
  initialCode: string;
  exam: Exam | null;
  onJoin: (fullName: string, code: string) => void;
  errorMsg?: string;
  teacherBranding?: TeacherBrandingData | null;
}

export default function JoinStage({
  initialCode,
  exam,
  onJoin,
  errorMsg,
  teacherBranding,
}: JoinStageProps) {
  const [name, setName] = useState('');
  const [code, setCode] = useState(initialCode || '');
  const [validationError, setValidationError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setValidationError('Please enter your full name');
      return;
    }
    if (!code.trim()) {
      setValidationError('Please enter your exam code');
      return;
    }
    setValidationError('');
    onJoin(name.trim(), code.trim());
  };

  const primaryColor = teacherBranding?.brand_color || '#0D9488';
  const teacherName = teacherBranding?.name || 'Alex Morgan';

  return (
    <div className="min-h-screen bg-[#F7F8FA] dark:bg-deep-teal flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md my-auto">
        {/* Subdomain Branding / Logo Header */}
        <div className="flex flex-col items-center justify-center mb-6 text-center space-y-2">
          <Image
            src="/assets/logo/ChatGPT Image Aug 11, 2026, 03_55_47 AM.png"
            alt="Examly Logo"
            width={130}
            height={52}
            className="object-contain"
            priority
          />

          {teacherBranding && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-teal/10 dark:bg-primary-teal/20 text-primary-teal text-xs font-semibold">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <span>{teacherBranding.subdomain ? `${teacherBranding.subdomain}.examly.site` : 'Teacher Portal'}</span>
            </div>
          )}
        </div>


        {/* Join Card */}
        <div className="bg-white dark:bg-dark-surface rounded-2xl p-6 sm:p-8 shadow-2xl border border-gray-100 dark:border-light-mint/10 text-center space-y-6">
          {/* Exam / Teacher Info Header */}
          <div className="p-4 rounded-card bg-bg-light dark:bg-dark-elevated border border-primary-teal/15">
            <span className="text-xs font-semibold text-primary-teal uppercase tracking-wider block mb-1">
              {teacherBranding ? `Exam by ${teacherName}` : 'Exam Session'}
            </span>
            <h2 className="text-lg font-bold font-poppins text-deep-teal dark:text-white">
              {exam ? exam.title : 'Oral Assessment'}
            </h2>
            <p className="text-xs text-text-dark/60 dark:text-light-mint/70 mt-0.5">
              Instructor: {teacherName} {exam ? `· ${exam.subject}` : ''}
            </p>
          </div>

          {(validationError || errorMsg) && (
            <div className="p-3 rounded-card bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs font-medium">
              {validationError || errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-left" noValidate>
            <Input
              name="name"
              label="Full Name"
              placeholder="e.g. Jordan Lee"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setValidationError('');
              }}
            />

            <div>
              <label className="block text-sm font-medium text-deep-teal dark:text-light-mint mb-1.5">
                Student Code
              </label>
              <input
                type="text"
                maxLength={36}
                placeholder="Student Code or Exam Code"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  setValidationError('');
                }}
                className="w-full px-4 py-3 rounded-card border border-gray-200 dark:border-light-mint/15 bg-white dark:bg-dark-surface font-mono font-bold text-center tracking-widest text-primary-teal outline-none focus:ring-2 focus:ring-primary-teal/30"
              />
            </div>

            <button
              type="submit"
              style={{ backgroundColor: primaryColor }}
              className="w-full py-3.5 px-6 rounded-card text-white font-semibold text-base hover:opacity-90 transition-all duration-200 shadow-md flex items-center justify-center gap-2 mt-2"
            >
              <span>Join Exam</span>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>

            <p className="text-xs text-center text-text-dark/50 dark:text-light-mint/50 pt-2">
              {teacherBranding
                ? `You're joining an exam hosted by ${teacherName}.`
                : "Ask your instructor if you don't have a code."}
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

