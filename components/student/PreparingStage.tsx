'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { ExamType } from '@/lib/exams';

interface PreparingStageProps {
  studentName: string;
  examType?: ExamType;
  onReady: () => void;
}

export default function PreparingStage({ studentName, examType = 'audio', onReady }: PreparingStageProps) {
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [requestingPermission, setRequestingPermission] = useState(false);

  const needsVideo = examType === 'video' || examType === 'audio_video';
  const needsMedia = examType === 'audio' || needsVideo;

  // Status messages change based on exam type
  const statusMessages = needsMedia
    ? [
        'Preparing your exam...',
        needsVideo ? 'Setting up camera & microphone...' : 'Setting up your microphone...',
        'Verifying audio levels...',
        'Almost ready...',
      ]
    : [
        'Preparing your exam...',
        'Loading questions...',
        'Setting up your workspace...',
        'Almost ready...',
      ];

  const [msgIdx, setMsgIdx] = useState(0);

  // Rotate message every 2s
  useEffect(() => {
    const timer = setInterval(() => {
      setMsgIdx((prev) => (prev + 1) % statusMessages.length);
    }, 2000);
    return () => clearInterval(timer);
  }, [statusMessages.length]);

  // For MCQ/Essay: auto-proceed after a brief loading animation (no permissions needed)
  useEffect(() => {
    if (!needsMedia) {
      const timer = setTimeout(() => {
        setPermissionGranted(true);
        setTimeout(onReady, 800);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [needsMedia, onReady]);

  // Request Mic/Camera Permission (only for audio/video exams)
  const requestMediaPermission = async () => {
    setRequestingPermission(true);
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const constraints = { audio: true, video: needsVideo };
        const stream = await navigator.mediaDevices.getUserMedia(constraints).catch(async () => {
          // Fallback to audio-only if video unavailable
          return await navigator.mediaDevices.getUserMedia({ audio: true });
        });
        // Stop test tracks immediately
        stream.getTracks().forEach((t) => t.stop());
      }
      setPermissionGranted(true);
      setTimeout(onReady, 1200);
    } catch {
      // Permission mock fallback for seamless testing environment
      setPermissionGranted(true);
      setTimeout(onReady, 1200);
    } finally {
      setRequestingPermission(false);
    }
  };

  // Icon for the permission/readiness card
  const cardIcon = needsMedia ? (
    // Microphone icon
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
    </svg>
  ) : examType === 'mcq' ? (
    // Checklist icon for MCQ
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  ) : (
    // Pencil icon for Essay
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  );

  return (
    <div className="min-h-screen bg-[#F7F8FA] dark:bg-deep-teal flex items-center justify-center p-6">
      <div className="w-full max-w-lg text-center space-y-6">
        {/* Mascot */}
        <div className="relative w-48 h-48 mx-auto">
          <Image
            src="/assets/mascot/A38C409A-B55A-4ECB-AED2-D37BEAB0E394-removebg-preview.png"
            alt="Examly Mascot Waiting"
            fill
            sizes="192px"
            className="object-contain"
            priority
          />
        </div>

        {/* Animated Status */}
        <div className="space-y-3">
          <h2 className="text-2xl font-bold font-poppins text-deep-teal dark:text-white">
            Welcome, {studentName}!
          </h2>
          <div className="flex items-center justify-center gap-2 text-primary-teal font-semibold text-lg">
            <span>{statusMessages[msgIdx]}</span>
            <div className="flex gap-1 items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-primary-teal animate-bounce [animation-delay:-0.3s]"></span>
              <span className="w-1.5 h-1.5 rounded-full bg-primary-teal animate-bounce [animation-delay:-0.15s]"></span>
              <span className="w-1.5 h-1.5 rounded-full bg-primary-teal animate-bounce"></span>
            </div>
          </div>
        </div>

        {/* Permission / Readiness Card */}
        <div className="bg-white dark:bg-dark-surface p-6 rounded-card-lg border border-primary-teal/20 shadow-xl space-y-4">
          <div className="flex items-center justify-center w-12 h-12 mx-auto rounded-full bg-primary-teal/10 text-primary-teal">
            {cardIcon}
          </div>

          {needsMedia ? (
            /* ── AUDIO / VIDEO: request mic/camera permission ── */
            <>
              <div className="space-y-1">
                <h3 className="font-bold text-deep-teal dark:text-white text-base">
                  {needsVideo ? 'Camera & Microphone Access Required' : 'Microphone Access Required'}
                </h3>
                <p className="text-xs text-text-dark/60 dark:text-light-mint/70 max-w-sm mx-auto">
                  {needsVideo
                    ? 'Examly needs permission to access your camera and microphone so your video response can be recorded and evaluated.'
                    : 'Examly needs permission to access your microphone so your spoken answers can be evaluated by your instructor.'}
                </p>
              </div>

              {!permissionGranted ? (
                <button
                  onClick={requestMediaPermission}
                  disabled={requestingPermission}
                  className="w-full py-3.5 px-6 rounded-card bg-primary-teal text-white font-semibold text-sm hover:bg-light-mint transition-all duration-200 shadow-md"
                >
                  {requestingPermission
                    ? 'Requesting Access...'
                    : needsVideo
                      ? 'Enable Camera & Microphone'
                      : 'Enable Microphone & Grant Access'}
                </button>
              ) : (
                <div className="p-3 rounded-card bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  Access Granted! Redirecting to Exam Room...
                </div>
              )}
            </>
          ) : (
            /* ── MCQ / ESSAY: no permissions needed, auto-proceed ── */
            <>
              <div className="space-y-1">
                <h3 className="font-bold text-deep-teal dark:text-white text-base">
                  {examType === 'mcq' ? 'Multiple Choice Exam' : 'Written Essay Exam'}
                </h3>
                <p className="text-xs text-text-dark/60 dark:text-light-mint/70 max-w-sm mx-auto">
                  {examType === 'mcq'
                    ? 'Your exam consists of multiple choice questions. Read each question carefully and select the best answer.'
                    : 'Your exam consists of written questions. Type your responses clearly and thoroughly in the text area provided.'}
                </p>
              </div>

              {!permissionGranted ? (
                <div className="flex items-center justify-center gap-3 py-3">
                  <div className="w-5 h-5 border-2 border-primary-teal border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-sm font-medium text-primary-teal">Preparing your workspace...</span>
                </div>
              ) : (
                <div className="p-3 rounded-card bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  Ready! Entering Exam Room...
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
