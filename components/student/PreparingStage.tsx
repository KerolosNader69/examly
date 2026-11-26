'use client';

import React, { useState, useEffect, useRef } from 'react';
import { QUIET_RMS, describeMediaError, rmsLevel } from '@/lib/mediaCapture';
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

  // Mic check (audio/video exams): real permission + a live level meter. The student
  // continues only once their voice was detected (or explicitly chooses to continue).
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [level, setLevel] = useState(0);
  const [voiceDetected, setVoiceDetected] = useState(false);
  const [checkStartedAt, setCheckStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const previewRef = useRef<HTMLVideoElement | null>(null);

  const stopCheck = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };
  useEffect(() => stopCheck, []);
  useEffect(() => {
    if (!checkStartedAt || voiceDetected) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [checkStartedAt, voiceDetected]);

  const requestMediaPermission = async () => {
    setRequestingPermission(true);
    setMediaError(null);
    stopCheck();
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
        throw Object.assign(new Error('unsupported'), { name: 'NotSupportedError' });
      }
      // No silent audio-only fallback for video exams: the camera is required.
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: needsVideo });
      if (stream.getAudioTracks().length === 0) {
        stream.getTracks().forEach((t) => t.stop());
        throw Object.assign(new Error('no mic'), { name: 'NotFoundError' });
      }
      streamRef.current = stream;
      if (needsVideo && previewRef.current) {
        previewRef.current.srcObject = stream;
        previewRef.current.play().catch(() => {});
      }
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        ctxRef.current = ctx;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        ctx.createMediaStreamSource(stream).connect(analyser);
        const data = new Uint8Array(analyser.fftSize);
        const tick = () => {
          analyser.getByteTimeDomainData(data);
          const rms = rmsLevel(data);
          setLevel(rms);
          if (rms >= QUIET_RMS) setVoiceDetected(true);
          rafRef.current = requestAnimationFrame(tick);
        };
        tick();
      } else {
        setVoiceDetected(true); // can't measure: don't block
      }
      setCheckStartedAt(Date.now());
      setPermissionGranted(true);
    } catch (err) {
      setPermissionGranted(false);
      setMediaError(describeMediaError(err, needsVideo).message);
    } finally {
      setRequestingPermission(false);
    }
  };

  const startExam = () => {
    stopCheck();
    onReady();
  };

  const canSkipCheck = checkStartedAt !== null && now - checkStartedAt > 8000;

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

              {mediaError && (
                <div role="alert" className="p-3 rounded-card bg-red-50 border border-red-200 text-red-700 text-xs font-medium text-left">
                  {mediaError}
                </div>
              )}

              {needsVideo && (
                <video ref={previewRef} autoPlay muted playsInline className={`w-full h-40 rounded-card bg-gray-900 object-cover ${permissionGranted ? '' : 'hidden'}`} />
              )}

              {!permissionGranted ? (
                <button
                  onClick={requestMediaPermission}
                  disabled={requestingPermission}
                  className="w-full py-3.5 px-6 rounded-card bg-primary-teal text-white font-semibold text-sm hover:bg-light-mint transition-all duration-200 shadow-md"
                >
                  {requestingPermission
                    ? 'Requesting Access...'
                    : mediaError
                      ? 'Try again'
                      : needsVideo
                        ? 'Enable Camera & Microphone'
                        : 'Enable Microphone & Grant Access'}
                </button>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-deep-teal dark:text-white">Microphone check: say a few words out loud</p>
                  <div className="h-3 w-full rounded-full bg-gray-100 dark:bg-dark-elevated overflow-hidden" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Math.min(1, level * 8) * 100)} aria-label="Microphone level">
                    <div
                      className={`h-full transition-[width] duration-75 ${level >= QUIET_RMS ? 'bg-emerald-500' : 'bg-amber-400'}`}
                      style={{ width: `${Math.min(100, Math.round(level * 800))}%` }}
                    />
                  </div>
                  <p className={`text-xs font-semibold ${voiceDetected ? 'text-emerald-600' : 'text-amber-600'}`} aria-live="polite">
                    {voiceDetected ? '✓ We can hear you.' : 'Waiting for your voice… if the bar does not move, check that your microphone is not muted.'}
                  </p>
                  <button
                    onClick={startExam}
                    disabled={!voiceDetected}
                    className="w-full py-3.5 px-6 rounded-card bg-primary-teal text-white font-semibold text-sm shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Start exam
                  </button>
                  {!voiceDetected && canSkipCheck && (
                    <button onClick={startExam} className="w-full text-xs text-gray-500 underline">
                      My microphone works, start anyway
                    </button>
                  )}
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
