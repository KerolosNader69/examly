'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Exam, Question } from '@/lib/exams';
import JoinStage, { TeacherBrandingData } from '@/components/student/JoinStage';
import PreparingStage from '@/components/student/PreparingStage';
import ExamRoomStage, { ExamSubmissionData } from '@/components/student/ExamRoomStage';
import CompletedStage from '@/components/student/CompletedStage';
import TeacherNotFoundState from '@/components/ui/TeacherNotFoundState';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

type StudentStage = 'join' | 'preparing' | 'exam_room' | 'completed';

function getSubdomainFromHostname(hostname: string): string | null {
  if (
    !hostname ||
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    /^\d+\.\d+\.\d+\.\d+$/.test(hostname) ||
    hostname.endsWith('.vercel.app')
  ) {
    return null;
  }
  const parts = hostname.split('.');
  if (parts.length <= 2) return null;
  if (parts[0] === 'www') return null;
  return parts[0];
}

export default function StudentExamPage() {
  const params = useParams<{ code: string }>();

  const [exam, setExam] = useState<Exam | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [teacherBranding, setTeacherBranding] = useState<TeacherBrandingData | null>(null);
  const [subdomainError, setSubdomainError] = useState(false);
  const [detectedSubdomain, setDetectedSubdomain] = useState('');

  const [stage, setStage] = useState<StudentStage>('join');
  const [studentName, setStudentName] = useState<string>('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isSubmittingJoin, setIsSubmittingJoin] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      // 1. Resolve subdomain teacher branding if request is on a subdomain
      if (typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        const subdomain = getSubdomainFromHostname(hostname);

        if (subdomain) {
          try {
            const res = await fetch(`/api/teacher/by-subdomain?subdomain=${encodeURIComponent(subdomain)}`);
            const data = await res.json();

            if (isMounted) {
              if (!res.ok || !data.found) {
                setSubdomainError(true);
                setDetectedSubdomain(subdomain);
                setIsLoaded(true);
                return;
              } else {
                setTeacherBranding(data.teacher);
              }
            }
          } catch {
            // Ignore fetch error and allow page to fall back
          }
        }
      }

      // 2. Query Supabase for exam matching ID or code
      try {
        const { data: dbExam } = await supabase
          .from('exams')
          .select('*')
          .or(`id.eq.${params.code},id.eq.${params.code}`)
          .single();

        if (dbExam && isMounted) {
          setExam({
            id: dbExam.id,
            title: dbExam.title,
            subject: 'Oral Assessment',
            description: 'Oral Exam',
            type: dbExam.exam_type || 'audio',
            status: dbExam.status === 'published' ? 'published' : 'draft',
            code: dbExam.id,
            studentCount: 0,
            averageScore: 0,
            createdAt: dbExam.created_at,
            questions: [],
          });
          setIsLoaded(true);
          return;
        }
      } catch (err) {
        console.error('Error fetching exam for student:', err);
      }

      if (isMounted) {
        setExam(null);
        setIsLoaded(true);
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [params.code]);

  const handleJoin = async (fullName: string, code: string) => {
    setIsSubmittingJoin(true);
    setErrorMessage('');

    try {
      const examIdToUse = exam?.id || code || params.code;

      const res = await fetch('/api/exam/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          examId: examIdToUse,
          studentName: fullName,
          studentCode: code,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setErrorMessage(data.error || 'Failed to join exam. Please check code.');
        setIsSubmittingJoin(false);
        return;
      }

      setSessionId(data.sessionId);
      setStudentName(fullName);

      if (data.questions && data.questions.length > 0) {
        setQuestions(data.questions);
      }

      if (data.exam && data.exam.type) {
        setExam({
          id: data.exam.id,
          title: data.exam.title,
          subject: 'Oral Assessment',
          description: 'Oral Exam',
          type: data.exam.type,
          status: 'published',
          code: data.exam.id,
          studentCount: 0,
          averageScore: 0,
          createdAt: new Date().toISOString(),
          questions: data.questions || [],
        });
      }

      setCurrentIdx(0);
      setStage('preparing');
    } catch (err: any) {
      console.error('Error joining exam:', err);
      setErrorMessage(err.message || 'Failed to join exam.');
    } finally {
      setIsSubmittingJoin(false);
    }
  };

  const handleFinishExam = async (submittedTranscript?: string, submissionData?: ExamSubmissionData) => {
    if (sessionId) {
      try {
        const submitPayload: Record<string, any> = {
          sessionId,
          transcript: submittedTranscript || 'Response submitted by student.',
        };

        // If we have real structured data from audio/video transcription+evaluation
        if (submissionData) {
          submitPayload.transcript = submissionData.combinedTranscript;
          submitPayload.aiScore = submissionData.aggregatedScore;
          submitPayload.aiScoreBreakdown = submissionData.aggregatedBreakdown;

          // Send the combined recording for upload to Supabase Storage
          if (submissionData.combinedAudioBase64) {
            submitPayload.audioBase64 = submissionData.combinedAudioBase64;
            submitPayload.mimeType = submissionData.combinedMimeType;
          }
        }

        await fetch('/api/exam/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(submitPayload),
        });
      } catch (err) {
        console.error('Error submitting exam session:', err);
      }
    }
    setStage('completed');
  };

  // Show a clean loading state during first render
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-[#F7F8FA] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-3 border-primary-teal border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-sm text-gray-500 font-medium">Loading exam...</p>
        </div>
      </div>
    );
  }

  // If subdomain is invalid, show distinct teacher 404 screen
  if (subdomainError) {
    return <TeacherNotFoundState subdomain={detectedSubdomain} />;
  }

  // If exam code from URL is invalid after load
  if (!exam && stage === 'join') {
    return (
      <div className="min-h-screen bg-[#F7F8FA] dark:bg-deep-teal flex items-center justify-center p-6">
        <div className="text-center max-w-md bg-white dark:bg-dark-surface p-8 rounded-card-lg border border-primary-teal/20 shadow-xl space-y-4">
          <h1 className="text-2xl font-bold font-poppins text-deep-teal dark:text-white">Exam Not Found</h1>
          <p className="text-sm text-text-dark/60 dark:text-light-mint/70">
            The exam code <span className="font-mono font-bold text-primary-teal">{params.code}</span> was not found.
          </p>
          <Link
            href="/"
            className="inline-block px-6 py-3 rounded-card bg-primary-teal text-white font-semibold text-sm hover:bg-light-mint transition-colors"
          >
            Return to Homepage
          </Link>
        </div>
      </div>
    );
  }

  if (!exam && stage !== 'join') {
    return (
      <div className="min-h-screen bg-[#F7F8FA] dark:bg-deep-teal flex items-center justify-center p-6">
        <div className="text-center max-w-md bg-white dark:bg-dark-surface p-8 rounded-card-lg border border-primary-teal/20 shadow-xl space-y-4">
          <h1 className="text-2xl font-bold font-poppins text-deep-teal dark:text-white">Exam Not Found</h1>
          <p className="text-sm text-text-dark/60 dark:text-light-mint/70">
            The exam code <span className="font-mono font-bold text-primary-teal">{params.code}</span> was not found.
          </p>
          <Link
            href="/"
            className="inline-block px-6 py-3 rounded-card bg-primary-teal text-white font-semibold text-sm hover:bg-light-mint transition-colors"
          >
            Return to Homepage
          </Link>
        </div>
      </div>
    );
  }

  const handleEarlyTerminate = async (reason: string, count: number) => {
    if (sessionId) {
      try {
        await fetch('/api/exam/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            transcript: 'Exam terminated early due to multiple tab switches.',
            recordingUrl: null,
            tabSwitchCount: count,
            flaggedReason: reason,
          }),
        });
      } catch (err) {
        console.error('Error submitting early terminated session:', err);
      }
    }
  };

  // Render distinct component for each stage
  switch (stage) {
    case 'join':
      return (
        <JoinStage
          initialCode={params.code}
          exam={exam || null}
          onJoin={handleJoin}
          errorMsg={errorMessage}
          teacherBranding={teacherBranding}
        />
      );

    case 'preparing':
      return (
        <PreparingStage
          studentName={studentName}
          examType={exam?.type || 'audio'}
          onReady={() => setStage('exam_room')}
        />
      );

    case 'exam_room':
      return (
        <ExamRoomStage
          questions={questions.length > 0 ? questions : (exam?.questions || [])}
          examType={exam?.type || 'audio'}
          currentIdx={currentIdx}
          onNext={() => setCurrentIdx((prev) => prev + 1)}
          onFinish={handleFinishExam}
          onEarlyTerminate={handleEarlyTerminate}
        />
      );

    case 'completed':
      return <CompletedStage studentName={studentName} />;

    default:
      return null;
  }
}

