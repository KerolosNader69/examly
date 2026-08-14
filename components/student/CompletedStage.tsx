'use client';

import React from 'react';
import Image from 'next/image';

interface CompletedStageProps {
  studentName: string;
}

export default function CompletedStage({ studentName }: CompletedStageProps) {
  return (
    <div className="min-h-screen bg-[#F7F8FA] dark:bg-deep-teal flex items-center justify-center p-6">
      <div className="w-full max-w-md text-center space-y-6">
        {/* Mascot in Thumbs-Up / Celebrating Pose */}
        <div className="relative w-52 h-52 mx-auto">
          <Image
            src="/assets/mascot/ChatGPT Image Aug 11, 2026, 03_05_50 AM.png"
            alt="Examly Mascot Celebrating"
            fill
            className="object-contain"
            priority
          />
        </div>

        {/* Confirmation Card */}
        <div className="bg-white dark:bg-dark-surface p-8 rounded-card-lg border border-primary-teal/20 shadow-2xl space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 flex items-center justify-center">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold font-poppins text-deep-teal dark:text-white">
            Your exam has been submitted!
          </h1>

          <p className="text-sm text-text-dark/70 dark:text-light-mint/70 leading-relaxed max-w-xs mx-auto">
            Great job, <span className="font-semibold text-deep-teal dark:text-light-mint">{studentName || 'Student'}</span>! Your teacher will review your results soon.
          </p>
        </div>
      </div>
    </div>
  );
}
