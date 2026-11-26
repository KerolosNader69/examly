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
import { authedFetch } from '@/lib/authedFetch';
import { withRetry } from '@/lib/mediaCapture';

type StudentStage = 'join' | 'preparing' | 'exam_room' | 'completed';

/** Per-tab storage of the session secret so a page refresh can resume the same session. */
interface StoredExamSession {
  sessionId: string;
  token: string;
  studentName: string;
}
const sessionStorageKey = (examId: string) => `examly:session:${examId}`;
function readStoredSession(examId: string): StoredExamSession | null {
  try {
    const raw = window.sessionStorage.getItem(sessionStorageKey(examId));
    const parsed = raw ? (JSON.parse(raw) as StoredExamSession) : null;
    return parsed?.sessionId && parsed?.token ? parsed : null;
  } catch {
    return null;
  }
}
function writeStoredSession(examId: string, value: StoredExamSession | null) {
  try {
    if (value) window.sessionStorage.setItem(sessionStorageKey(examId), JSON.stringify(value));
    else window.sessionStorage.removeItem(sessionStorageKey(examId));
  } catch {
    // storage unavailable (private mode): resume after refresh just won't work
  }
}

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
  // Secret returned once by /api/exam/join; required by transcribe/evaluate/submit.
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isSubmittingJoin, setIsSubmittingJoin] = useState(false);
  // Teacher previewing their own unpublished exam (owner-checked server-side).
  const [isPreview, setIsPreview] = useState(false);
  // Submit that could not reach the server: keep the payload and let the student retry.
  const [submitFailed, setSubmitFailed] = useState(false);
  const [retryingSubmit, setRetryingSubmit] = useState(false);
  const pendingSubmitRef = React.useRef<Record<string, unknown> | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      // 1. Resolve subdomain teacher branding if request is on a subdomain
      let hasSubdomainBranding = false;
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
                hasSubdomainBranding = true;
              }
            }
          } catch {
            // Ignore fetch error and allow page to fall back
          }
        }
      }

      // 2. Load student-safe exam info from the server (the anon key can't read exams).
      //    Unknown, malformed, draft and closed exams all come back as 404.
      try {
        const res = await fetch(`/api/exam/info?id=${encodeURIComponent(params.code)}`, { cache: 'no-store' });
        const data = res.ok ? await res.json() : null;
        let info = data?.found ? data.exam : null;

        // Not open to students (e.g. a draft): if a teacher is signed in, try the
        // owner-only preview so they can see their own exam's student view.
        if (!info) {
          const { data: auth } = await supabase.auth.getSession();
          if (auth.session) {
            const previewRes = await authedFetch(`/api/teacher/exam-preview?id=${encodeURIComponent(params.code)}`, { cache: 'no-store' });
            const previewData = previewRes.ok ? await previewRes.json() : null;
            if (previewData?.found) {
              info = previewData.exam;
              if (isMounted) {
                setIsPreview(true);
                setErrorMessage('Preview only: this exam is not open to students yet. Publish it to let students join.');
              }
            }
          }
        }

        if (info && isMounted) {
          setExam({
            id: info.id,
            title: info.title,
            subject: 'Oral Assessment',
            description: 'Oral Exam',
            type: info.type || 'audio',
            status: info.status === 'published' ? 'published' : 'draft',
            code: info.id,
            studentCount: 0,
            averageScore: 0,
            createdAt: info.startTime || '',
            questions: [],
          });
          // Off a teacher subdomain, show the exam owner's real branding instead of
          // the JoinStage placeholder name.
          if (!hasSubdomainBranding && info.teacher?.name) {
            setTeacherBranding({
              name: info.teacher.name,
              logo_url: info.teacher.logoUrl,
              brand_color: info.teacher.brandColor,
            });
          }
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
    if (isPreview) {
      setErrorMessage('Preview only: this exam is not open to students yet. Publish it to let students join.');
      return;
    }
    setIsSubmittingJoin(true);
    setErrorMessage('');

    try {
      const examIdToUse = exam?.id || code || params.code;
      // Same tab + same name: present the stored token to resume that session.
      const stored = readStoredSession(examIdToUse);
      const resume = stored && stored.studentName === fullName ? { sessionId: stored.sessionId, token: stored.token } : undefined;

      const res = await fetch('/api/exam/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          examId: examIdToUse,
          studentName: fullName,
          studentCode: code,
          resume,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        if (data?.code === 'not_started' && data.opensAt) {
          setErrorMessage(`This exam opens on ${new Date(data.opensAt).toLocaleString()}. Please come back then.`);
          setIsSubmittingJoin(false);
          return;
        }
        setErrorMessage(data.error || 'Failed to join exam. Please check code.');
        setIsSubmittingJoin(false);
        return;
      }

      const token: string | null = data.sessionToken || (data.resumed ? resume?.token ?? null : null);
      setSessionId(data.sessionId);
      setSessionToken(token);
      setStudentName(fullName);
      if (token) writeStoredSession(examIdToUse, { sessionId: data.sessionId, token, studentName: fullName });

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

      // Resumed after a refresh: continue at the first question without a server result.
      const answered = new Set<string>(Array.isArray(data.answeredQuestionIds) ? data.answeredQuestionIds : []);
      const qs: Question[] = data.questions || [];
      const firstOpen = qs.findIndex((q) => !answered.has(q.id));
      setCurrentIdx(firstOpen === -1 ? Math.max(0, qs.length - 1) : firstOpen);
      setStage('preparing');
    } catch (err: any) {
      console.error('Error joining exam:', err);
      setErrorMessage(err.message || 'Failed to join exam.');
    } finally {
      setIsSubmittingJoin(false);
    }
  };

  /** POSTs the final submission with retries. true = the server has it (or already had it). */
  const sendSubmission = async (payload: Record<string, unknown>): Promise<boolean> => {
    try {
      const res = await withRetry(
        () => fetch('/api/exam/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }),
        { delaysMs: [1000, 3000, 6000], shouldRetry: (r) => r.status >= 500 }
      );
      if (res.ok || res.status === 409) {
        // Done (or already submitted from another attempt): forget the session secret.
        writeStoredSession(exam?.id || params.code, null);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error submitting exam session:', err);
      return false;
    }
  };

  // The server computes the score from its own stored results; only answers are sent
  // (MCQ choices, essay text and the tab-switch count). Never scores. Recordings were
  // already uploaded per question.
  const handleFinishExam = async (_submittedTranscript?: string, submissionData?: ExamSubmissionData) => {
    if (!sessionId || !sessionToken) {
      setSubmitFailed(true);
      return;
    }
    const submitPayload: Record<string, unknown> = { sessionId, token: sessionToken };
    if (submissionData) {
      if (submissionData.mcqItems && submissionData.mcqItems.length > 0) submitPayload.mcqItems = submissionData.mcqItems;
      if (submissionData.essayAnswers && submissionData.essayAnswers.length > 0) submitPayload.essayAnswers = submissionData.essayAnswers;
      if (submissionData.tabSwitchCount != null) submitPayload.tabSwitchCount = submissionData.tabSwitchCount;
    }
    pendingSubmitRef.current = submitPayload;
    if (await sendSubmission(submitPayload)) {
      pendingSubmitRef.current = null;
      setStage('completed');
    } else {
      // Never show "submitted" when the server didn't confirm it.
      setSubmitFailed(true);
    }
  };

  const retrySubmit = async () => {
    if (!pendingSubmitRef.current || retryingSubmit) return;
    setRetryingSubmit(true);
    const ok = await sendSubmission(pendingSubmitRef.current);
    setRetryingSubmit(false);
    if (ok) {
      pendingSubmitRef.current = null;
      setSubmitFailed(false);
      setStage('completed');
    }
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
    if (sessionId && sessionToken) {
      try {
        // Finalises the session server-side with whatever was already answered.
        const res = await fetch('/api/exam/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            token: sessionToken,
            tabSwitchCount: count,
            flaggedReason: reason,
          }),
        });
        if (res.ok || res.status === 409) writeStoredSession(exam?.id || params.code, null);
      } catch (err) {
        console.error('Error submitting early terminated session:', err);
      }
    }
  };

  if (submitFailed && stage === 'exam_room') {
    return (
      <div className="min-h-screen bg-[#F7F8FA] flex items-center justify-center p-6">
        <div role="alert" className="text-center max-w-md bg-white p-8 rounded-2xl shadow-xl space-y-4">
          <h1 className="text-2xl font-bold font-poppins text-deep-teal">Your exam has not been submitted yet</h1>
          <p className="text-sm text-gray-600">
            We could not reach the server. Your answers are kept in this tab. Check your internet connection and press Retry. Don&apos;t close this tab.
          </p>
          <button
            type="button"
            onClick={retrySubmit}
            disabled={retryingSubmit}
            className="w-full py-3 rounded-xl bg-primary-teal text-white font-bold text-sm disabled:opacity-50"
          >
            {retryingSubmit ? 'Submitting…' : 'Retry submit'}
          </button>
        </div>
      </div>
    );
  }

  // Render distinct component for each stage
  switch (stage) {
    case 'join':
      return (
        <JoinStage
          initialCode={params.code}
          initialName={typeof window !== 'undefined' ? readStoredSession(exam?.id || params.code)?.studentName : undefined}
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
          sessionAuth={sessionId && sessionToken ? { sessionId, token: sessionToken } : null}
        />
      );

    case 'completed':
      return <CompletedStage studentName={studentName} />;

    default:
      return null;
  }
}

